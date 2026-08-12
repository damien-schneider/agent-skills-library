use rusqlite::{Connection, OptionalExtension as _, Row};
use serde::Serialize;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptHistoryEntry {
    pub id: i64,
    pub content: String,
    pub destination_path: Option<String>,
    pub created_at: i64,
}

const SELECT: &str = "SELECT id, content, destination_path, created_at FROM prompt_history";

fn map_row(row: &Row) -> rusqlite::Result<PromptHistoryEntry> {
    Ok(PromptHistoryEntry {
        id: row.get(0)?,
        content: row.get(1)?,
        destination_path: row.get(2)?,
        created_at: row.get(3)?,
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<PromptHistoryEntry>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY created_at DESC, id DESC"))?;
    let prompts = stmt
        .query_map([], map_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(prompts)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Option<PromptHistoryEntry>> {
    let prompt = conn
        .query_row(&format!("{SELECT} WHERE id = ?1"), [id], map_row)
        .optional()?;
    Ok(prompt)
}

pub fn insert(
    conn: &Connection,
    content: &str,
    destination_path: Option<&str>,
    created_at: i64,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO prompt_history (content, destination_path, created_at)
         VALUES (?1, ?2, ?3)",
        (content, destination_path, created_at),
    )?;
    Ok(conn.last_insert_rowid())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn lists_newest_prompts_first_with_their_destination() {
        let db = Db::open_in_memory().unwrap();

        db.with_conn(|conn| {
            insert(conn, "First prompt", None, 1)?;
            insert(conn, "Second prompt\nwith context", Some("/repo"), 2)?;
            Ok(())
        })
        .unwrap();

        let prompts = db.with_conn(list).unwrap();

        assert_eq!(prompts.len(), 2);
        assert_eq!(prompts[0].content, "Second prompt\nwith context");
        assert_eq!(prompts[0].destination_path.as_deref(), Some("/repo"));
        assert_eq!(prompts[1].content, "First prompt");
    }

    #[test]
    fn retrieves_a_prompt_by_id() {
        let db = Db::open_in_memory().unwrap();
        let id = db
            .with_conn(|conn| insert(conn, "Stored locally", None, 1))
            .unwrap();

        let prompt = db.with_conn(|conn| get(conn, id)).unwrap().unwrap();

        assert_eq!(prompt.id, id);
        assert_eq!(prompt.content, "Stored locally");
    }
}
