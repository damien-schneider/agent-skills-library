use rusqlite::{Connection, OptionalExtension as _, Row};

use crate::error::AppResult;

/// A folder the user can send a prompt to, merged from the three places one can
/// come from: starred projects, folders already used by a prompt, and the
/// project directories the scanner indexed.
#[derive(Debug, Clone)]
pub struct DestinationRow {
    pub path: String,
    pub favorite: bool,
    pub last_used_at: Option<i64>,
    pub file_count: i64,
}

const SELECT: &str = "
SELECT
    candidate.path,
    EXISTS (SELECT 1 FROM favorite_projects WHERE path = candidate.path),
    (SELECT MAX(created_at) FROM prompt_history WHERE destination_path = candidate.path),
    (SELECT COUNT(*) FROM files WHERE project_dir = candidate.path AND deleted_at IS NULL)
FROM (
    SELECT path FROM favorite_projects
    UNION
    SELECT destination_path FROM prompt_history WHERE destination_path IS NOT NULL
    UNION
    SELECT project_dir FROM files WHERE project_dir IS NOT NULL AND deleted_at IS NULL
) AS candidate";

fn map_row(row: &Row) -> rusqlite::Result<DestinationRow> {
    Ok(DestinationRow {
        path: row.get(0)?,
        favorite: row.get(1)?,
        last_used_at: row.get(2)?,
        file_count: row.get(3)?,
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<DestinationRow>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY candidate.path"))?;
    let destinations = stmt
        .query_map([], map_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(destinations)
}

pub fn get(conn: &Connection, path: &str) -> AppResult<Option<DestinationRow>> {
    let destination = conn
        .query_row(
            &format!("{SELECT} WHERE candidate.path = ?1"),
            [path],
            map_row,
        )
        .optional()?;
    Ok(destination)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn seed(conn: &Connection) -> AppResult<()> {
        conn.execute(
            "INSERT INTO roots (id, path, enabled, added_at) VALUES (1, '/repo', 1, 0)",
            [],
        )?;
        for (id, project_dir, deleted_at) in [
            (1, "/repo/alpha", None),
            (2, "/repo/alpha", None),
            (3, "/repo/gone", Some(7_i64)),
        ] {
            conn.execute(
                "INSERT INTO files (id, root_id, path, rel_path, kind, project_dir, size, mtime_ns, hash, first_seen_at, deleted_at)
                 VALUES (?1, 1, ?2, 'skill.md', 'skill', ?3, 0, 0, 'hash', 0, ?4)",
                (id, format!("{project_dir}/{id}.md"), project_dir, deleted_at),
            )?;
        }
        conn.execute(
            "INSERT INTO prompt_history (content, destination_path, created_at)
             VALUES ('older', '/repo/beta', 10), ('newer', '/repo/beta', 20)",
            [],
        )?;
        conn.execute(
            "INSERT INTO favorite_projects (path, created_at) VALUES ('/repo/starred', 5)",
            [],
        )?;
        Ok(())
    }

    #[test]
    fn merges_favorites_used_folders_and_indexed_projects() {
        let db = Db::open_in_memory().unwrap();
        db.with_conn(seed).unwrap();

        let destinations = db.with_conn(list).unwrap();

        let paths: Vec<_> = destinations.iter().map(|row| row.path.as_str()).collect();
        assert_eq!(paths, ["/repo/alpha", "/repo/beta", "/repo/starred"]);
        assert_eq!(destinations[0].file_count, 2);
        assert_eq!(destinations[0].last_used_at, None);
        assert_eq!(destinations[1].last_used_at, Some(20));
        assert!(!destinations[1].favorite);
        assert!(destinations[2].favorite);
    }

    #[test]
    fn reads_a_single_destination() {
        let db = Db::open_in_memory().unwrap();
        db.with_conn(seed).unwrap();

        let starred = db
            .with_conn(|conn| get(conn, "/repo/starred"))
            .unwrap()
            .unwrap();

        assert!(starred.favorite);
        assert_eq!(starred.file_count, 0);
        assert!(db
            .with_conn(|conn| get(conn, "/repo/unknown"))
            .unwrap()
            .is_none());
    }
}
