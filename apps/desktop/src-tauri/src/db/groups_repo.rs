use rusqlite::{Connection, OptionalExtension as _, Row};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Strategy {
    Copy,
    Symlink,
}

impl Strategy {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Copy => "copy",
            Self::Symlink => "symlink",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "copy" => Some(Self::Copy),
            "symlink" => Some(Self::Symlink),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncGroup {
    pub id: i64,
    pub name: String,
    pub canonical_file_id: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMember {
    pub group_id: i64,
    pub file_id: i64,
    pub strategy: Strategy,
    pub baseline_hash: Option<String>,
}

const SELECT_GROUP: &str = "SELECT id, name, canonical_file_id, created_at FROM sync_groups";

fn map_group(row: &Row) -> rusqlite::Result<SyncGroup> {
    Ok(SyncGroup {
        id: row.get(0)?,
        name: row.get(1)?,
        canonical_file_id: row.get(2)?,
        created_at: row.get(3)?,
    })
}

fn map_member(row: &Row) -> rusqlite::Result<SyncMember> {
    let raw: String = row.get(2)?;
    let strategy = Strategy::from_str(&raw).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            2,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("unknown strategy {raw}"),
            )),
        )
    })?;

    Ok(SyncMember {
        group_id: row.get(0)?,
        file_id: row.get(1)?,
        strategy,
        baseline_hash: row.get(3)?,
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<SyncGroup>> {
    let mut stmt = conn.prepare(&format!("{SELECT_GROUP} ORDER BY name"))?;
    let groups = stmt
        .query_map([], map_group)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(groups)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Option<SyncGroup>> {
    let group = conn
        .query_row(&format!("{SELECT_GROUP} WHERE id = ?1"), [id], map_group)
        .optional()?;
    Ok(group)
}

pub fn require(conn: &Connection, id: i64) -> AppResult<SyncGroup> {
    get(conn, id)?.ok_or_else(|| AppError::NotFound(format!("sync group {id} does not exist")))
}

pub fn create(
    conn: &Connection,
    name: &str,
    canonical_file_id: i64,
    created_at: i64,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO sync_groups (name, canonical_file_id, created_at) VALUES (?1, ?2, ?3)",
        (name, canonical_file_id, created_at),
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn set_canonical(conn: &Connection, group_id: i64, file_id: i64) -> AppResult<()> {
    require(conn, group_id)?;
    conn.execute(
        "UPDATE sync_groups SET canonical_file_id = ?2 WHERE id = ?1",
        (group_id, file_id),
    )?;
    // the new source of truth is never its own target
    conn.execute(
        "DELETE FROM sync_members WHERE group_id = ?1 AND file_id = ?2",
        (group_id, file_id),
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, group_id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM sync_groups WHERE id = ?1", [group_id])?;
    Ok(())
}

pub fn members(conn: &Connection, group_id: i64) -> AppResult<Vec<SyncMember>> {
    let mut stmt = conn.prepare(
        "SELECT group_id, file_id, strategy, baseline_hash FROM sync_members
         WHERE group_id = ?1 ORDER BY file_id",
    )?;
    let members = stmt
        .query_map([group_id], map_member)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(members)
}

pub fn add_member(
    conn: &Connection,
    group_id: i64,
    file_id: i64,
    strategy: Strategy,
) -> AppResult<()> {
    let group = require(conn, group_id)?;
    if group.canonical_file_id == Some(file_id) {
        return Err(AppError::InvalidPath(
            "the canonical file cannot also be a member".to_string(),
        ));
    }
    conn.execute(
        "INSERT INTO sync_members (group_id, file_id, strategy, baseline_hash)
         VALUES (?1, ?2, ?3, NULL)
         ON CONFLICT(group_id, file_id) DO UPDATE SET strategy = excluded.strategy",
        (group_id, file_id, strategy.as_str()),
    )?;
    Ok(())
}

pub fn remove_member(conn: &Connection, group_id: i64, file_id: i64) -> AppResult<()> {
    conn.execute(
        "DELETE FROM sync_members WHERE group_id = ?1 AND file_id = ?2",
        (group_id, file_id),
    )?;
    Ok(())
}

pub fn set_baseline(
    conn: &Connection,
    group_id: i64,
    file_id: i64,
    baseline_hash: &str,
) -> AppResult<()> {
    conn.execute(
        "UPDATE sync_members SET baseline_hash = ?3 WHERE group_id = ?1 AND file_id = ?2",
        (group_id, file_id, baseline_hash),
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::{self, FileRecord};
    use crate::db::{roots_repo, Db};
    use crate::scanner::targets::FileKind;

    fn seeded() -> (Db, i64, i64) {
        let db = Db::open_in_memory().unwrap();
        let (canonical, member) = db
            .with_conn(|conn| {
                let root_id = roots_repo::insert(conn, "/repo", 0)?;
                let record = |path: &str| FileRecord {
                    root_id,
                    path: path.to_string(),
                    rel_path: path.to_string(),
                    kind: FileKind::AgentsMd,
                    project_dir: None,
                    size: 1,
                    mtime_ns: 1,
                    hash: "h".to_string(),
                    is_symlink: false,
                    symlink_target: None,
                };
                let canonical = files_repo::upsert(conn, &record("/repo/a/AGENTS.md"), 1, 0)?;
                let member = files_repo::upsert(conn, &record("/repo/b/AGENTS.md"), 1, 0)?;
                Ok((canonical, member))
            })
            .unwrap();
        (db, canonical, member)
    }

    #[test]
    fn creates_a_group_with_members() {
        let (db, canonical, member) = seeded();

        let group_id = db
            .with_conn(|conn| {
                let id = create(conn, "agents", canonical, 0)?;
                add_member(conn, id, member, Strategy::Copy)?;
                Ok(id)
            })
            .unwrap();

        let group = db.with_conn(|conn| require(conn, group_id)).unwrap();
        let members = db.with_conn(|conn| members(conn, group_id)).unwrap();
        assert_eq!(group.canonical_file_id, Some(canonical));
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].strategy, Strategy::Copy);
    }

    #[test]
    fn refuses_the_canonical_file_as_a_member() {
        let (db, canonical, _) = seeded();
        let group_id = db
            .with_conn(|conn| create(conn, "agents", canonical, 0))
            .unwrap();

        let err = db
            .with_conn(|conn| add_member(conn, group_id, canonical, Strategy::Copy))
            .unwrap_err();

        assert_eq!(err.code(), "invalid_path");
    }

    #[test]
    fn adding_a_member_twice_updates_its_strategy() {
        let (db, canonical, member) = seeded();
        let group_id = db
            .with_conn(|conn| create(conn, "agents", canonical, 0))
            .unwrap();

        db.with_conn(|conn| {
            add_member(conn, group_id, member, Strategy::Copy)?;
            add_member(conn, group_id, member, Strategy::Symlink)
        })
        .unwrap();

        let members = db.with_conn(|conn| members(conn, group_id)).unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].strategy, Strategy::Symlink);
    }

    #[test]
    fn promoting_a_member_to_canonical_drops_it_from_the_members() {
        let (db, canonical, member) = seeded();
        let group_id = db
            .with_conn(|conn| {
                let id = create(conn, "agents", canonical, 0)?;
                add_member(conn, id, member, Strategy::Copy)?;
                Ok(id)
            })
            .unwrap();

        db.with_conn(|conn| set_canonical(conn, group_id, member))
            .unwrap();

        let group = db.with_conn(|conn| require(conn, group_id)).unwrap();
        assert_eq!(group.canonical_file_id, Some(member));
        assert!(db
            .with_conn(|conn| members(conn, group_id))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn deleting_a_group_cascades_to_its_members() {
        let (db, canonical, member) = seeded();
        let group_id = db
            .with_conn(|conn| {
                let id = create(conn, "agents", canonical, 0)?;
                add_member(conn, id, member, Strategy::Copy)?;
                Ok(id)
            })
            .unwrap();

        db.with_conn(|conn| delete(conn, group_id)).unwrap();

        let remaining: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row("SELECT COUNT(*) FROM sync_members", [], |row| row.get(0))?)
            })
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn removing_a_file_cascades_to_its_membership() {
        let (db, canonical, member) = seeded();
        let group_id = db
            .with_conn(|conn| {
                let id = create(conn, "agents", canonical, 0)?;
                add_member(conn, id, member, Strategy::Copy)?;
                Ok(id)
            })
            .unwrap();

        db.with_conn(|conn| {
            conn.execute("DELETE FROM files WHERE id = ?1", [member])?;
            Ok(())
        })
        .unwrap();

        assert!(db
            .with_conn(|conn| members(conn, group_id))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn records_a_baseline_hash() {
        let (db, canonical, member) = seeded();
        let group_id = db
            .with_conn(|conn| {
                let id = create(conn, "agents", canonical, 0)?;
                add_member(conn, id, member, Strategy::Copy)?;
                set_baseline(conn, id, member, "abc")?;
                Ok(id)
            })
            .unwrap();

        let members = db.with_conn(|conn| members(conn, group_id)).unwrap();
        assert_eq!(members[0].baseline_hash.as_deref(), Some("abc"));
    }

    #[test]
    fn reports_a_missing_group() {
        let (db, _, _) = seeded();

        assert_eq!(
            db.with_conn(|conn| require(conn, 42)).unwrap_err().code(),
            "not_found"
        );
    }
}
