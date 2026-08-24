use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::db::files_repo::{self, DuplicateGroup, FileFilter, FileRow};
use crate::db::links_repo::{self, FileLinks};
use crate::db::roots_repo;
use crate::error::{AppError, AppResult};
use crate::events;
use crate::fsops;
use crate::paths::{canonicalize, ensure_openable};
use crate::scanner::hash::hash_bytes;
use crate::scanner::refs;
use crate::scanner::targets::FileKind;
use crate::state::AppState;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFilesArgs {
    pub kinds: Option<Vec<FileKind>>,
    pub root_id: Option<i64>,
    pub search: Option<String>,
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub file_id: i64,
    pub path: String,
    pub content: String,
    pub hash: String,
    pub mtime_ms: i64,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
    pub file_id: i64,
    pub hash: String,
    pub mtime_ms: i64,
    pub size: i64,
}

/// The row's path is re-resolved and re-checked on every call: the index may be
/// stale and a command must never touch a file the user has not rooted.
fn resolve(state: &AppState, file_id: i64) -> AppResult<(FileRow, PathBuf)> {
    state.db.with_conn(|conn| {
        let row = files_repo::require(conn, file_id)?;
        let roots = roots_repo::list_enabled(conn)?;
        let resolved = canonicalize(Path::new(&row.path))?;
        ensure_openable(Path::new(&row.path), &resolved, &roots)?;
        Ok((row, resolved))
    })
}

#[tauri::command]
pub fn list_files(
    state: State<'_, AppState>,
    args: Option<ListFilesArgs>,
) -> AppResult<Vec<FileRow>> {
    let args = args.unwrap_or_default();
    let filter = FileFilter {
        kinds: args.kinds,
        root_id: args.root_id,
        search: args.search,
        include_deleted: args.include_deleted.unwrap_or(false),
    };
    state.db.with_conn(|conn| files_repo::list(conn, &filter))
}

#[tauri::command]
pub fn read_file(state: State<'_, AppState>, file_id: i64) -> AppResult<FileContent> {
    let (row, path) = resolve(&state, file_id)?;
    let (content, bytes) = fsops::read_text(&path)?;
    let stat = fsops::stat(&path)?;

    Ok(FileContent {
        file_id: row.id,
        path: row.path,
        content,
        hash: hash_bytes(&bytes),
        mtime_ms: stat.mtime_ms(),
        is_symlink: row.is_symlink,
        symlink_target: row.symlink_target,
    })
}

#[tauri::command]
pub fn write_file(
    app: AppHandle,
    state: State<'_, AppState>,
    file_id: i64,
    content: String,
    expected_hash: String,
) -> AppResult<WriteResult> {
    let (row, path) = resolve(&state, file_id)?;

    let (_, current_bytes) = fsops::read_text(&path)?;
    if hash_bytes(&current_bytes) != expected_hash {
        return Err(AppError::Conflict(row.rel_path));
    }

    fsops::atomic_write(&path, &content)?;
    let stat = fsops::stat(&path)?;
    let hash = hash_bytes(content.as_bytes());

    state.db.with_tx(|tx| {
        files_repo::touch_after_write(tx, row.id, stat.size, stat.mtime_ns, &hash)?;
        links_repo::replace_refs(tx, row.id, &hash, &refs::extract(&content))
    })?;
    events::emit_index_updated(&app, vec![row.id]);

    Ok(WriteResult {
        file_id: row.id,
        hash,
        mtime_ms: stat.mtime_ms(),
        size: stat.size,
    })
}

#[tauri::command]
pub fn list_file_links(state: State<'_, AppState>, file_id: i64) -> AppResult<FileLinks> {
    state
        .db
        .with_conn(|conn| links_repo::links_of(conn, file_id))
}

#[tauri::command]
pub fn list_duplicates(state: State<'_, AppState>) -> AppResult<Vec<DuplicateGroup>> {
    state.db.with_conn(files_repo::duplicates)
}
