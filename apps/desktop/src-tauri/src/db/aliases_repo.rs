use rusqlite::{Connection, OptionalExtension as _};

use crate::error::AppResult;

/// A path that reaches an indexed file through a symlink without being its row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AliasRecord {
    pub path: String,
    pub root_id: i64,
}

pub fn owner_of(conn: &Connection, path: &str) -> AppResult<Option<i64>> {
    let owner = conn
        .prepare_cached("SELECT file_id FROM file_aliases WHERE path = ?1")?
        .query_row([path], |row| row.get(0))
        .optional()?;
    Ok(owner)
}

/// Points `alias` at `file_id`; true when that is news, so the caller can report the file.
pub fn record(
    conn: &Connection,
    file_id: i64,
    alias: &AliasRecord,
    scan_id: i64,
) -> AppResult<bool> {
    let is_news = owner_of(conn, &alias.path)? != Some(file_id);
    conn.prepare_cached(
        "INSERT INTO file_aliases (path, file_id, root_id, last_seen_scan_id)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(path) DO UPDATE SET
             file_id = excluded.file_id,
             root_id = excluded.root_id,
             last_seen_scan_id = excluded.last_seen_scan_id",
    )?
    .execute(rusqlite::params![
        alias.path,
        file_id,
        alias.root_id,
        scan_id
    ])?;
    Ok(is_news)
}

/// The path stopped being an alias — it vanished, or it now carries a row of its own.
/// Answers with the file it used to reach.
pub fn forget(conn: &Connection, path: &str) -> AppResult<Option<i64>> {
    let owner = conn
        .prepare_cached("DELETE FROM file_aliases WHERE path = ?1 RETURNING file_id")?
        .query_row([path], |row| row.get(0))
        .optional()?;
    Ok(owner)
}

/// Detaches every alias of a file whose row is going away, handing the paths back.
pub fn take_of(conn: &Connection, file_id: i64) -> AppResult<Vec<String>> {
    let mut stmt = conn.prepare("DELETE FROM file_aliases WHERE file_id = ?1 RETURNING path")?;
    let mut paths = stmt
        .query_map([file_id], |row| row.get(0))?
        .collect::<Result<Vec<String>, _>>()?;
    paths.sort_unstable();
    Ok(paths)
}

/// Drops the aliases a scan of `root_id` did not walk over; the owning file ids
/// are returned so the UI can refresh them.
pub fn prune_unseen(conn: &Connection, root_id: i64, scan_id: i64) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "DELETE FROM file_aliases
         WHERE root_id = ?1 AND (last_seen_scan_id IS NULL OR last_seen_scan_id != ?2)
         RETURNING file_id",
    )?;
    let owners = stmt
        .query_map((root_id, scan_id), |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(owners)
}

/// Every indexed path known to reach `real_path`: the live row's own, then its aliases.
pub fn paths_reaching(conn: &Connection, real_path: &str) -> AppResult<Vec<AliasRecord>> {
    let mut stmt = conn.prepare_cached(
        "SELECT path, root_id FROM files WHERE real_path = ?1 AND deleted_at IS NULL
         UNION
         SELECT file_aliases.path, file_aliases.root_id FROM file_aliases
         JOIN files ON files.id = file_aliases.file_id
         WHERE files.real_path = ?1 AND files.deleted_at IS NULL",
    )?;
    let paths = stmt
        .query_map([real_path], |row| {
            Ok(AliasRecord {
                path: row.get(0)?,
                root_id: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::{self, FileFilter, FileRecord};
    use crate::db::{roots_repo, Db};
    use crate::scanner::targets::FileKind;

    const REAL: &str = "/repo/.agents/skills/a/SKILL.md";
    const ALIAS: &str = "/repo/.claude/skills/a/SKILL.md";

    fn seeded() -> (Db, i64, i64) {
        let db = Db::open_in_memory().unwrap();
        let (root_id, file_id) = db
            .with_conn(|conn| {
                let root_id = roots_repo::insert(conn, "/repo", 0)?;
                let record = FileRecord {
                    root_id,
                    path: REAL.to_string(),
                    real_path: REAL.to_string(),
                    rel_path: ".agents/skills/a/SKILL.md".to_string(),
                    kind: FileKind::Skill,
                    name: Some("a".to_string()),
                    project_dir: None,
                    size: 1,
                    mtime_ns: 1,
                    hash: "h".to_string(),
                    is_symlink: false,
                    symlink_target: None,
                };
                Ok((root_id, files_repo::upsert(conn, &record, 1, 0)?))
            })
            .unwrap();
        (db, root_id, file_id)
    }

    fn alias(path: &str, root_id: i64) -> AliasRecord {
        AliasRecord {
            path: path.to_string(),
            root_id,
        }
    }

    fn aliases_of(db: &Db, file_id: i64) -> Vec<String> {
        db.with_conn(|conn| files_repo::require(conn, file_id))
            .unwrap()
            .aliases
    }

    #[test]
    fn a_recorded_alias_shows_on_its_file_sorted() {
        let (db, root_id, file_id) = seeded();

        db.with_conn(|conn| {
            record(conn, file_id, &alias("/repo/z/SKILL.md", root_id), 1)?;
            record(conn, file_id, &alias(ALIAS, root_id), 1)
        })
        .unwrap();

        assert_eq!(aliases_of(&db, file_id), [ALIAS, "/repo/z/SKILL.md"]);
        let listed = db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap();
        assert_eq!(listed.len(), 1, "an alias is never a row of its own");
    }

    #[test]
    fn recording_is_news_only_the_first_time() {
        let (db, root_id, file_id) = seeded();

        let first = db
            .with_conn(|conn| record(conn, file_id, &alias(ALIAS, root_id), 1))
            .unwrap();
        let again = db
            .with_conn(|conn| record(conn, file_id, &alias(ALIAS, root_id), 2))
            .unwrap();

        assert!(first);
        assert!(!again);
    }

    #[test]
    fn a_scan_prunes_only_the_aliases_of_its_root_it_did_not_see() {
        let (db, root_id, file_id) = seeded();
        let other_root = db
            .with_conn(|conn| roots_repo::insert(conn, "/home", 0))
            .unwrap();
        db.with_conn(|conn| {
            record(conn, file_id, &alias(ALIAS, root_id), 1)?;
            record(conn, file_id, &alias("/repo/kept/SKILL.md", root_id), 2)?;
            record(conn, file_id, &alias("/home/a/SKILL.md", other_root), 1)
        })
        .unwrap();

        let owners = db.with_conn(|conn| prune_unseen(conn, root_id, 2)).unwrap();

        assert_eq!(owners, [file_id]);
        assert_eq!(
            aliases_of(&db, file_id),
            ["/home/a/SKILL.md", "/repo/kept/SKILL.md"]
        );
    }

    #[test]
    fn forgetting_an_alias_names_the_file_it_reached() {
        let (db, root_id, file_id) = seeded();
        db.with_conn(|conn| record(conn, file_id, &alias(ALIAS, root_id), 1))
            .unwrap();

        let owner = db.with_conn(|conn| forget(conn, ALIAS)).unwrap();
        let unknown = db.with_conn(|conn| forget(conn, ALIAS)).unwrap();

        assert_eq!(owner, Some(file_id));
        assert_eq!(unknown, None);
        assert!(aliases_of(&db, file_id).is_empty());
    }

    #[test]
    fn removing_the_root_of_an_alias_leaves_no_orphan() {
        let (db, _, file_id) = seeded();
        let other_root = db
            .with_conn(|conn| roots_repo::insert(conn, "/home", 0))
            .unwrap();
        db.with_conn(|conn| record(conn, file_id, &alias("/home/a/SKILL.md", other_root), 1))
            .unwrap();

        db.with_conn(|conn| roots_repo::remove(conn, other_root))
            .unwrap();

        assert!(aliases_of(&db, file_id).is_empty());
    }

    #[test]
    fn removing_the_root_of_the_file_takes_its_aliases_along() {
        let (db, root_id, file_id) = seeded();
        let other_root = db
            .with_conn(|conn| roots_repo::insert(conn, "/home", 0))
            .unwrap();
        db.with_conn(|conn| record(conn, file_id, &alias("/home/a/SKILL.md", other_root), 1))
            .unwrap();

        db.with_conn(|conn| roots_repo::remove(conn, root_id))
            .unwrap();

        let left: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row("SELECT COUNT(*) FROM file_aliases", [], |row| row.get(0))?)
            })
            .unwrap();
        assert_eq!(left, 0);
    }

    #[test]
    fn lists_every_path_reaching_a_real_file() {
        let (db, root_id, file_id) = seeded();
        db.with_conn(|conn| record(conn, file_id, &alias(ALIAS, root_id), 1))
            .unwrap();

        let mut paths = db.with_conn(|conn| paths_reaching(conn, REAL)).unwrap();
        paths.sort_by(|a, b| a.path.cmp(&b.path));

        assert_eq!(paths, [alias(REAL, root_id), alias(ALIAS, root_id)]);
    }

    #[test]
    fn taking_the_aliases_of_a_file_detaches_them() {
        let (db, root_id, file_id) = seeded();
        db.with_conn(|conn| record(conn, file_id, &alias(ALIAS, root_id), 1))
            .unwrap();

        let taken = db.with_conn(|conn| take_of(conn, file_id)).unwrap();

        assert_eq!(taken, [ALIAS]);
        assert!(aliases_of(&db, file_id).is_empty());
    }
}
