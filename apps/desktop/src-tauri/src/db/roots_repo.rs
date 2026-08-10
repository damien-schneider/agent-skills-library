use rusqlite::{Connection, OptionalExtension as _, Row};
use serde::Serialize;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Root {
    pub id: i64,
    pub path: String,
    pub enabled: bool,
    pub added_at: i64,
}

const SELECT: &str = "SELECT id, path, enabled, added_at FROM roots";

fn map_row(row: &Row) -> rusqlite::Result<Root> {
    Ok(Root {
        id: row.get(0)?,
        path: row.get(1)?,
        enabled: row.get::<_, i64>(2)? != 0,
        added_at: row.get(3)?,
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Root>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY path"))?;
    let roots = stmt
        .query_map([], map_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(roots)
}

pub fn list_enabled(conn: &Connection) -> AppResult<Vec<Root>> {
    let mut stmt = conn.prepare(&format!("{SELECT} WHERE enabled = 1 ORDER BY path"))?;
    let roots = stmt
        .query_map([], map_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(roots)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Option<Root>> {
    let root = conn
        .query_row(&format!("{SELECT} WHERE id = ?1"), [id], map_row)
        .optional()?;
    Ok(root)
}

pub fn insert(conn: &Connection, path: &str, added_at: i64) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO roots (path, enabled, added_at) VALUES (?1, 1, ?2)",
        (path, added_at),
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn set_enabled(conn: &Connection, id: i64, enabled: bool) -> AppResult<()> {
    conn.execute(
        "UPDATE roots SET enabled = ?2 WHERE id = ?1",
        (id, i64::from(enabled)),
    )?;
    Ok(())
}

pub fn remove(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM roots WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn inserts_and_lists_roots_by_path() {
        let db = Db::open_in_memory().unwrap();

        db.with_conn(|conn| {
            insert(conn, "/b/repo", 2)?;
            insert(conn, "/a/repo", 1)?;
            Ok(())
        })
        .unwrap();

        let roots = db.with_conn(list).unwrap();

        assert_eq!(roots.len(), 2);
        assert_eq!(roots[0].path, "/a/repo");
        assert!(roots[0].enabled);
    }

    #[test]
    fn rejects_a_duplicate_path() {
        let db = Db::open_in_memory().unwrap();

        db.with_conn(|conn| insert(conn, "/repo", 1)).unwrap();
        let second = db.with_conn(|conn| insert(conn, "/repo", 2));

        assert!(second.is_err());
    }

    #[test]
    fn disabled_roots_drop_out_of_the_enabled_list() {
        let db = Db::open_in_memory().unwrap();

        let id = db.with_conn(|conn| insert(conn, "/repo", 1)).unwrap();
        db.with_conn(|conn| set_enabled(conn, id, false)).unwrap();

        assert!(db.with_conn(list_enabled).unwrap().is_empty());
        assert_eq!(db.with_conn(list).unwrap().len(), 1);
    }

    #[test]
    fn removing_a_root_cascades_to_its_files() {
        let db = Db::open_in_memory().unwrap();
        let id = db.with_conn(|conn| insert(conn, "/repo", 1)).unwrap();

        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO files (root_id, path, rel_path, kind, size, mtime_ns, hash, first_seen_at)
                 VALUES (?1, '/repo/CLAUDE.md', 'CLAUDE.md', 'claude-md', 1, 1, 'h', 1)",
                [id],
            )?;
            remove(conn, id)?;
            Ok(())
        })
        .unwrap();

        let files: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))?)
            })
            .unwrap();
        assert_eq!(files, 0);
    }
}
