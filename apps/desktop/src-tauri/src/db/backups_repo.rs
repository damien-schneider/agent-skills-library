use rusqlite::{Connection, OptionalExtension as _, Row};
use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub id: i64,
    pub file_id: Option<i64>,
    pub original_path: String,
    pub backup_path: String,
    pub hash: String,
    pub created_at: i64,
}

const SELECT: &str =
    "SELECT id, file_id, original_path, backup_path, hash, created_at FROM backups";

fn map_row(row: &Row) -> rusqlite::Result<Backup> {
    Ok(Backup {
        id: row.get(0)?,
        file_id: row.get(1)?,
        original_path: row.get(2)?,
        backup_path: row.get(3)?,
        hash: row.get(4)?,
        created_at: row.get(5)?,
    })
}

pub fn insert(
    conn: &Connection,
    file_id: Option<i64>,
    original_path: &str,
    backup_path: &str,
    hash: &str,
    created_at: i64,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO backups (file_id, original_path, backup_path, hash, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![file_id, original_path, backup_path, hash, created_at],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list(conn: &Connection, file_id: Option<i64>) -> AppResult<Vec<Backup>> {
    let sql = match file_id {
        Some(_) => format!("{SELECT} WHERE file_id = ?1 ORDER BY created_at DESC"),
        None => format!("{SELECT} ORDER BY created_at DESC"),
    };
    let mut stmt = conn.prepare(&sql)?;
    let backups = match file_id {
        Some(id) => stmt
            .query_map([id], map_row)?
            .collect::<Result<Vec<_>, _>>()?,
        None => stmt
            .query_map([], map_row)?
            .collect::<Result<Vec<_>, _>>()?,
    };
    Ok(backups)
}

pub fn require(conn: &Connection, id: i64) -> AppResult<Backup> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], map_row)
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("backup {id} does not exist")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn lists_backups_newest_first() {
        let db = Db::open_in_memory().unwrap();

        db.with_conn(|conn| {
            insert(conn, None, "/repo/AGENTS.md", "/backups/1", "h1", 10)?;
            insert(conn, None, "/repo/AGENTS.md", "/backups/2", "h2", 20)?;
            Ok(())
        })
        .unwrap();

        let backups = db.with_conn(|conn| list(conn, None)).unwrap();

        assert_eq!(backups.len(), 2);
        assert_eq!(backups[0].hash, "h2");
    }

    #[test]
    fn filters_by_file() {
        let db = Db::open_in_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute("INSERT INTO roots (path, enabled, added_at) VALUES ('/repo', 1, 0)", [])?;
            conn.execute(
                "INSERT INTO files (id, root_id, path, rel_path, kind, size, mtime_ns, hash, first_seen_at)
                 VALUES (7, 1, '/repo/AGENTS.md', 'AGENTS.md', 'agents-md', 1, 1, 'h', 0)",
                [],
            )?;
            insert(conn, Some(7), "/repo/AGENTS.md", "/backups/1", "h1", 10)?;
            insert(conn, None, "/other/AGENTS.md", "/backups/2", "h2", 20)?;
            Ok(())
        })
        .unwrap();

        let backups = db.with_conn(|conn| list(conn, Some(7))).unwrap();

        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].backup_path, "/backups/1");
    }

    #[test]
    fn reports_a_missing_backup() {
        let db = Db::open_in_memory().unwrap();

        assert_eq!(
            db.with_conn(|conn| require(conn, 1)).unwrap_err().code(),
            "not_found"
        );
    }

    #[test]
    fn a_deleted_file_keeps_its_backups() {
        let db = Db::open_in_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute("INSERT INTO roots (path, enabled, added_at) VALUES ('/repo', 1, 0)", [])?;
            conn.execute(
                "INSERT INTO files (id, root_id, path, rel_path, kind, size, mtime_ns, hash, first_seen_at)
                 VALUES (7, 1, '/repo/AGENTS.md', 'AGENTS.md', 'agents-md', 1, 1, 'h', 0)",
                [],
            )?;
            insert(conn, Some(7), "/repo/AGENTS.md", "/backups/1", "h1", 10)?;
            conn.execute("DELETE FROM files WHERE id = 7", [])?;
            Ok(())
        })
        .unwrap();

        let backups = db.with_conn(|conn| list(conn, None)).unwrap();

        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].file_id, None);
    }
}
