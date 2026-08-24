use std::collections::HashMap;

use rusqlite::{Connection, OptionalExtension as _, Row};
use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::scanner::incremental::Stat;
use crate::scanner::targets::FileKind;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRow {
    pub id: i64,
    pub root_id: i64,
    pub path: String,
    pub rel_path: String,
    pub kind: FileKind,
    /// The name other files reference this one by; `None` for CLAUDE.md-style files.
    pub name: Option<String>,
    pub project_dir: Option<String>,
    pub size: i64,
    pub mtime_ns: i64,
    pub hash: String,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub first_seen_at: i64,
    pub last_seen_scan_id: Option<i64>,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct FileRecord {
    pub root_id: i64,
    pub path: String,
    pub rel_path: String,
    pub kind: FileKind,
    pub name: Option<String>,
    pub project_dir: Option<String>,
    pub size: i64,
    pub mtime_ns: i64,
    pub hash: String,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct FileFilter {
    pub kinds: Option<Vec<FileKind>>,
    pub root_id: Option<i64>,
    pub search: Option<String>,
    pub include_deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub hash: String,
    pub files: Vec<FileRow>,
}

pub const SELECT: &str = "SELECT id, root_id, path, rel_path, kind, name, project_dir, size,
                             mtime_ns, hash, is_symlink, symlink_target, first_seen_at,
                             last_seen_scan_id, deleted_at
                      FROM files";

pub fn map_row(row: &Row) -> rusqlite::Result<FileRow> {
    let raw_kind: String = row.get(4)?;
    let kind = FileKind::from_str(&raw_kind).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            4,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("unknown file kind {raw_kind}"),
            )),
        )
    })?;

    Ok(FileRow {
        id: row.get(0)?,
        root_id: row.get(1)?,
        path: row.get(2)?,
        rel_path: row.get(3)?,
        kind,
        name: row.get(5)?,
        project_dir: row.get(6)?,
        size: row.get(7)?,
        mtime_ns: row.get(8)?,
        hash: row.get(9)?,
        is_symlink: row.get::<_, i64>(10)? != 0,
        symlink_target: row.get(11)?,
        first_seen_at: row.get(12)?,
        last_seen_scan_id: row.get(13)?,
        deleted_at: row.get(14)?,
    })
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Option<FileRow>> {
    let file = conn
        .query_row(&format!("{SELECT} WHERE id = ?1"), [id], map_row)
        .optional()?;
    Ok(file)
}

pub fn require(conn: &Connection, id: i64) -> AppResult<FileRow> {
    get(conn, id)?.ok_or_else(|| AppError::NotFound(format!("file {id} is not indexed")))
}

pub fn find_by_path(conn: &Connection, path: &str) -> AppResult<Option<FileRow>> {
    let file = conn
        .query_row(&format!("{SELECT} WHERE path = ?1"), [path], map_row)
        .optional()?;
    Ok(file)
}

pub fn mark_deleted_by_path(conn: &Connection, path: &str, now_ms: i64) -> AppResult<Option<i64>> {
    let Some(row) = find_by_path(conn, path)? else {
        return Ok(None);
    };
    if row.deleted_at.is_some() {
        return Ok(None);
    }
    conn.execute(
        "UPDATE files SET deleted_at = ?2 WHERE id = ?1",
        (row.id, now_ms),
    )?;
    Ok(Some(row.id))
}

pub fn latest_scan_id(conn: &Connection) -> AppResult<i64> {
    let id = conn.query_row("SELECT COALESCE(MAX(id), 0) FROM scans", [], |row| {
        row.get::<_, i64>(0)
    })?;
    Ok(id)
}

pub fn list(conn: &Connection, filter: &FileFilter) -> AppResult<Vec<FileRow>> {
    let mut sql = String::from(SELECT);
    let mut clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if !filter.include_deleted {
        clauses.push("deleted_at IS NULL".to_string());
    }
    if let Some(root_id) = filter.root_id {
        params.push(Box::new(root_id));
        clauses.push(format!("root_id = ?{}", params.len()));
    }
    if let Some(kinds) = &filter.kinds {
        if kinds.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders: Vec<String> = kinds
            .iter()
            .map(|kind| {
                params.push(Box::new(kind.as_str().to_string()));
                format!("?{}", params.len())
            })
            .collect();
        clauses.push(format!("kind IN ({})", placeholders.join(", ")));
    }
    if let Some(search) = &filter.search {
        let trimmed = search.trim();
        if !trimmed.is_empty() {
            params.push(Box::new(format!("%{trimmed}%")));
            clauses.push(format!("path LIKE ?{} ESCAPE '\\'", params.len()));
        }
    }

    if !clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&clauses.join(" AND "));
    }
    sql.push_str(" ORDER BY path");

    let mut stmt = conn.prepare(&sql)?;
    let refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let files = stmt
        .query_map(refs.as_slice(), map_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(files)
}

/// What the index already knows about a path, feeding the incremental short-circuit.
#[derive(Debug, Clone)]
pub struct IndexedFile {
    pub stat: Stat,
    pub hash: String,
    /// Content hash the references were extracted from; `None` until the file is read once.
    pub refs_hash: Option<String>,
}

pub fn indexed_by_path(conn: &Connection, root_id: i64) -> AppResult<HashMap<String, IndexedFile>> {
    let mut stmt =
        conn.prepare("SELECT path, size, mtime_ns, hash, refs_hash FROM files WHERE root_id = ?1")?;
    let rows = stmt.query_map([root_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            IndexedFile {
                stat: Stat {
                    size: row.get(1)?,
                    mtime_ns: row.get(2)?,
                },
                hash: row.get(3)?,
                refs_hash: row.get(4)?,
            },
        ))
    })?;

    let mut map = HashMap::new();
    for row in rows {
        let (path, value) = row?;
        map.insert(path, value);
    }
    Ok(map)
}

pub fn upsert(conn: &Connection, record: &FileRecord, scan_id: i64, now_ms: i64) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO files (root_id, path, rel_path, kind, name, project_dir, size, mtime_ns,
                            hash, is_symlink, symlink_target, first_seen_at, last_seen_scan_id,
                            deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)
         ON CONFLICT(path) DO UPDATE SET
             root_id = excluded.root_id,
             rel_path = excluded.rel_path,
             kind = excluded.kind,
             name = excluded.name,
             project_dir = excluded.project_dir,
             size = excluded.size,
             mtime_ns = excluded.mtime_ns,
             hash = excluded.hash,
             is_symlink = excluded.is_symlink,
             symlink_target = excluded.symlink_target,
             last_seen_scan_id = excluded.last_seen_scan_id,
             deleted_at = NULL",
        rusqlite::params![
            record.root_id,
            record.path,
            record.rel_path,
            record.kind.as_str(),
            record.name,
            record.project_dir,
            record.size,
            record.mtime_ns,
            record.hash,
            i64::from(record.is_symlink),
            record.symlink_target,
            now_ms,
            scan_id,
        ],
    )?;

    let id = conn.query_row(
        "SELECT id FROM files WHERE path = ?1",
        [&record.path],
        |row| row.get(0),
    )?;
    Ok(id)
}

/// Marks rows the scan did not walk over; ids are returned so the UI can refresh them.
pub fn mark_missing_deleted(
    conn: &Connection,
    root_id: i64,
    scan_id: i64,
    now_ms: i64,
) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM files
         WHERE root_id = ?1 AND deleted_at IS NULL
           AND (last_seen_scan_id IS NULL OR last_seen_scan_id != ?2)",
    )?;
    let ids = stmt
        .query_map((root_id, scan_id), |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    if !ids.is_empty() {
        conn.execute(
            "UPDATE files SET deleted_at = ?3
             WHERE root_id = ?1 AND deleted_at IS NULL
               AND (last_seen_scan_id IS NULL OR last_seen_scan_id != ?2)",
            (root_id, scan_id, now_ms),
        )?;
    }
    Ok(ids)
}

pub fn touch_after_write(
    conn: &Connection,
    id: i64,
    size: i64,
    mtime_ns: i64,
    hash: &str,
) -> AppResult<()> {
    conn.execute(
        "UPDATE files SET size = ?2, mtime_ns = ?3, hash = ?4, deleted_at = NULL WHERE id = ?1",
        rusqlite::params![id, size, mtime_ns, hash],
    )?;
    Ok(())
}

pub fn duplicates(conn: &Connection) -> AppResult<Vec<DuplicateGroup>> {
    let mut stmt = conn.prepare(
        "SELECT hash FROM files
         WHERE deleted_at IS NULL
         GROUP BY hash HAVING COUNT(*) > 1
         ORDER BY COUNT(*) DESC, hash",
    )?;
    let hashes = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut groups = Vec::with_capacity(hashes.len());
    for hash in hashes {
        let mut files_stmt = conn.prepare(&format!(
            "{SELECT} WHERE hash = ?1 AND deleted_at IS NULL ORDER BY path"
        ))?;
        let files = files_stmt
            .query_map([&hash], map_row)?
            .collect::<Result<Vec<_>, _>>()?;
        groups.push(DuplicateGroup { hash, files });
    }
    Ok(groups)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{roots_repo, Db};

    fn record(root_id: i64, path: &str, kind: FileKind, hash: &str) -> FileRecord {
        FileRecord {
            root_id,
            path: path.to_string(),
            rel_path: path.trim_start_matches("/repo/").to_string(),
            kind,
            name: None,
            project_dir: Some("/repo".to_string()),
            size: 10,
            mtime_ns: 1_000,
            hash: hash.to_string(),
            is_symlink: false,
            symlink_target: None,
        }
    }

    fn seeded() -> (Db, i64) {
        let db = Db::open_in_memory().unwrap();
        let root_id = db
            .with_conn(|conn| roots_repo::insert(conn, "/repo", 0))
            .unwrap();
        (db, root_id)
    }

    #[test]
    fn upsert_inserts_then_updates_the_same_path() {
        let (db, root_id) = seeded();

        let first = db
            .with_conn(|conn| {
                upsert(
                    conn,
                    &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h1"),
                    1,
                    5,
                )
            })
            .unwrap();

        let mut changed = record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h2");
        changed.size = 20;
        let second = db.with_conn(|conn| upsert(conn, &changed, 2, 6)).unwrap();

        assert_eq!(first, second);
        let row = db.with_conn(|conn| require(conn, first)).unwrap();
        assert_eq!(row.hash, "h2");
        assert_eq!(row.size, 20);
        assert_eq!(row.last_seen_scan_id, Some(2));
        assert_eq!(row.first_seen_at, 5, "first_seen_at survives an update");
    }

    #[test]
    fn filters_by_kind_root_and_search() {
        let (db, root_id) = seeded();
        db.with_conn(|conn| {
            upsert(
                conn,
                &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h1"),
                1,
                0,
            )?;
            upsert(
                conn,
                &record(root_id, "/repo/AGENTS.md", FileKind::AgentsMd, "h2"),
                1,
                0,
            )?;
            Ok(())
        })
        .unwrap();

        let claude = db
            .with_conn(|conn| {
                list(
                    conn,
                    &FileFilter {
                        kinds: Some(vec![FileKind::ClaudeMd]),
                        ..Default::default()
                    },
                )
            })
            .unwrap();
        let searched = db
            .with_conn(|conn| {
                list(
                    conn,
                    &FileFilter {
                        search: Some("AGENTS".to_string()),
                        ..Default::default()
                    },
                )
            })
            .unwrap();
        let other_root = db
            .with_conn(|conn| {
                list(
                    conn,
                    &FileFilter {
                        root_id: Some(root_id + 1),
                        ..Default::default()
                    },
                )
            })
            .unwrap();

        assert_eq!(claude.len(), 1);
        assert_eq!(claude[0].kind, FileKind::ClaudeMd);
        assert_eq!(searched.len(), 1);
        assert_eq!(searched[0].rel_path, "AGENTS.md");
        assert!(other_root.is_empty());
    }

    #[test]
    fn an_empty_kind_filter_matches_nothing() {
        let (db, root_id) = seeded();
        db.with_conn(|conn| {
            upsert(
                conn,
                &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h"),
                1,
                0,
            )
        })
        .unwrap();

        let files = db
            .with_conn(|conn| {
                list(
                    conn,
                    &FileFilter {
                        kinds: Some(Vec::new()),
                        ..Default::default()
                    },
                )
            })
            .unwrap();

        assert!(files.is_empty());
    }

    #[test]
    fn missing_files_are_soft_deleted_and_hidden_by_default() {
        let (db, root_id) = seeded();
        let id = db
            .with_conn(|conn| {
                upsert(
                    conn,
                    &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h"),
                    1,
                    0,
                )
            })
            .unwrap();

        let removed = db
            .with_conn(|conn| mark_missing_deleted(conn, root_id, 2, 42))
            .unwrap();

        assert_eq!(removed, vec![id]);
        assert!(db
            .with_conn(|conn| list(conn, &FileFilter::default()))
            .unwrap()
            .is_empty());
        let with_deleted = db
            .with_conn(|conn| {
                list(
                    conn,
                    &FileFilter {
                        include_deleted: true,
                        ..Default::default()
                    },
                )
            })
            .unwrap();
        assert_eq!(with_deleted[0].deleted_at, Some(42));
    }

    #[test]
    fn re_indexing_a_deleted_path_revives_it() {
        let (db, root_id) = seeded();
        let id = db
            .with_conn(|conn| {
                upsert(
                    conn,
                    &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h"),
                    1,
                    0,
                )
            })
            .unwrap();
        db.with_conn(|conn| mark_missing_deleted(conn, root_id, 2, 42))
            .unwrap();

        db.with_conn(|conn| {
            upsert(
                conn,
                &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h"),
                3,
                43,
            )
        })
        .unwrap();

        assert_eq!(
            db.with_conn(|conn| require(conn, id)).unwrap().deleted_at,
            None
        );
    }

    #[test]
    fn indexed_by_path_feeds_the_incremental_check() {
        let (db, root_id) = seeded();
        db.with_conn(|conn| {
            upsert(
                conn,
                &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h"),
                1,
                0,
            )
        })
        .unwrap();

        let indexed = db.with_conn(|conn| indexed_by_path(conn, root_id)).unwrap();

        let entry = indexed.get("/repo/CLAUDE.md").unwrap();
        assert_eq!(entry.stat.size, 10);
        assert_eq!(entry.stat.mtime_ns, 1_000);
        assert_eq!(entry.hash, "h");
        assert_eq!(
            entry.refs_hash, None,
            "a freshly upserted row still owes its references"
        );
    }

    #[test]
    fn duplicates_group_live_files_sharing_a_hash() {
        let (db, root_id) = seeded();
        db.with_conn(|conn| {
            upsert(
                conn,
                &record(root_id, "/repo/a/AGENTS.md", FileKind::AgentsMd, "same"),
                1,
                0,
            )?;
            upsert(
                conn,
                &record(root_id, "/repo/b/AGENTS.md", FileKind::AgentsMd, "same"),
                1,
                0,
            )?;
            upsert(
                conn,
                &record(root_id, "/repo/c/AGENTS.md", FileKind::AgentsMd, "other"),
                1,
                0,
            )?;
            Ok(())
        })
        .unwrap();

        let groups = db.with_conn(duplicates).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].hash, "same");
        assert_eq!(groups[0].files.len(), 2);
    }

    #[test]
    fn deleted_files_never_count_as_duplicates() {
        let (db, root_id) = seeded();
        db.with_conn(|conn| {
            upsert(
                conn,
                &record(root_id, "/repo/a/AGENTS.md", FileKind::AgentsMd, "same"),
                1,
                0,
            )?;
            upsert(
                conn,
                &record(root_id, "/repo/b/AGENTS.md", FileKind::AgentsMd, "same"),
                1,
                0,
            )?;
            conn.execute(
                "UPDATE files SET deleted_at = 1 WHERE path = '/repo/b/AGENTS.md'",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        assert!(db.with_conn(duplicates).unwrap().is_empty());
    }

    #[test]
    fn touch_after_write_refreshes_the_stat_and_hash() {
        let (db, root_id) = seeded();
        let id = db
            .with_conn(|conn| {
                upsert(
                    conn,
                    &record(root_id, "/repo/CLAUDE.md", FileKind::ClaudeMd, "h"),
                    1,
                    0,
                )
            })
            .unwrap();

        db.with_conn(|conn| touch_after_write(conn, id, 99, 2_000, "next"))
            .unwrap();

        let row = db.with_conn(|conn| require(conn, id)).unwrap();
        assert_eq!(
            (row.size, row.mtime_ns, row.hash.as_str()),
            (99, 2_000, "next")
        );
    }

    #[test]
    fn require_reports_a_missing_file() {
        let (db, _) = seeded();

        let err = db.with_conn(|conn| require(conn, 404)).unwrap_err();

        assert_eq!(err.code(), "not_found");
    }
}
