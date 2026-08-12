use rusqlite::{Connection, Row};
use serde::Serialize;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteProject {
    pub path: String,
    pub created_at: i64,
}

const SELECT: &str = "SELECT path, created_at FROM favorite_projects";

fn map_row(row: &Row) -> rusqlite::Result<FavoriteProject> {
    Ok(FavoriteProject {
        path: row.get(0)?,
        created_at: row.get(1)?,
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<FavoriteProject>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY created_at DESC, path"))?;
    let favorites = stmt
        .query_map([], map_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(favorites)
}

pub fn set(conn: &Connection, path: &str, favorite: bool, created_at: i64) -> AppResult<()> {
    if favorite {
        conn.execute(
            "INSERT INTO favorite_projects (path, created_at) VALUES (?1, ?2)
             ON CONFLICT(path) DO NOTHING",
            (path, created_at),
        )?;
    } else {
        conn.execute("DELETE FROM favorite_projects WHERE path = ?1", [path])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn favorites_are_shared_by_project_path() {
        let db = Db::open_in_memory().unwrap();

        db.with_conn(|conn| {
            set(conn, "/repo/alpha", true, 1)?;
            set(conn, "/repo/beta", true, 2)?;
            set(conn, "/repo/alpha", true, 3)?;
            Ok(())
        })
        .unwrap();

        let favorites = db.with_conn(list).unwrap();

        assert_eq!(favorites.len(), 2);
        assert_eq!(favorites[0].path, "/repo/beta");
        assert_eq!(favorites[1].path, "/repo/alpha");
    }

    #[test]
    fn removes_a_favorite_without_touching_the_project() {
        let db = Db::open_in_memory().unwrap();

        db.with_conn(|conn| {
            set(conn, "/repo/alpha", true, 1)?;
            set(conn, "/repo/alpha", false, 2)
        })
        .unwrap();

        assert!(db.with_conn(list).unwrap().is_empty());
    }
}
