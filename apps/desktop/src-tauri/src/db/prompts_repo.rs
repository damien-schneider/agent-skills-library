use rusqlite::{Connection, OptionalExtension as _, Row};
use serde::Serialize;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptAttachment {
    pub id: i64,
    pub prompt_id: i64,
    pub path: String,
    pub mime_type: String,
    pub width: i64,
    pub height: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptHistoryEntry {
    pub id: i64,
    pub content: String,
    pub destination_path: Option<String>,
    pub created_at: i64,
    pub attachments: Vec<PromptAttachment>,
}

const SELECT: &str = "SELECT id, content, destination_path, created_at FROM prompt_history";

fn map_row(row: &Row) -> rusqlite::Result<PromptHistoryEntry> {
    Ok(PromptHistoryEntry {
        id: row.get(0)?,
        content: row.get(1)?,
        destination_path: row.get(2)?,
        created_at: row.get(3)?,
        attachments: Vec::new(),
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<PromptHistoryEntry>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY created_at DESC, id DESC"))?;
    let mut prompts = stmt
        .query_map([], map_row)?
        .collect::<Result<Vec<_>, _>>()?;
    for prompt in &mut prompts {
        prompt.attachments = list_attachments(conn, prompt.id)?;
    }
    Ok(prompts)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Option<PromptHistoryEntry>> {
    let prompt = conn
        .query_row(&format!("{SELECT} WHERE id = ?1"), [id], map_row)
        .optional()?;
    prompt
        .map(|mut prompt| {
            prompt.attachments = list_attachments(conn, id)?;
            Ok(prompt)
        })
        .transpose()
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

fn map_attachment(row: &Row) -> rusqlite::Result<PromptAttachment> {
    Ok(PromptAttachment {
        id: row.get(0)?,
        prompt_id: row.get(1)?,
        path: row.get(2)?,
        mime_type: row.get(3)?,
        width: row.get(4)?,
        height: row.get(5)?,
    })
}

pub fn list_attachments(conn: &Connection, prompt_id: i64) -> AppResult<Vec<PromptAttachment>> {
    let mut stmt = conn.prepare(
        "SELECT id, prompt_id, path, mime_type, width, height
         FROM prompt_attachments WHERE prompt_id = ?1 ORDER BY id",
    )?;
    let attachments = stmt
        .query_map([prompt_id], map_attachment)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(attachments)
}

pub fn insert_attachment(
    conn: &Connection,
    prompt_id: i64,
    path: &str,
    mime_type: &str,
    width: i64,
    height: i64,
    created_at: i64,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO prompt_attachments
         (prompt_id, path, mime_type, width, height, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (prompt_id, path, mime_type, width, height, created_at),
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_attachment(conn: &Connection, id: i64) -> AppResult<Option<PromptAttachment>> {
    let attachment = conn
        .query_row(
            "SELECT id, prompt_id, path, mime_type, width, height
             FROM prompt_attachments WHERE id = ?1",
            [id],
            map_attachment,
        )
        .optional()?;
    Ok(attachment)
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM prompt_history WHERE id = ?1", [id])?;
    Ok(())
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

    #[test]
    fn lists_attachments_with_their_prompt() {
        let db = Db::open_in_memory().unwrap();
        let prompt_id = db
            .with_conn(|conn| insert(conn, "Inspect this screenshot", None, 1))
            .unwrap();
        db.with_conn(|conn| {
            insert_attachment(
                conn,
                prompt_id,
                "/tmp/attachment.png",
                "image/png",
                120,
                80,
                1,
            )?;
            Ok(())
        })
        .unwrap();

        let prompt = db.with_conn(|conn| get(conn, prompt_id)).unwrap().unwrap();

        assert_eq!(prompt.attachments.len(), 1);
        assert_eq!(prompt.attachments[0].prompt_id, prompt_id);
        assert_eq!(prompt.attachments[0].width, 120);
    }
}
