use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager as _, State};

use crate::db::backups_repo::{self, Backup};
use crate::db::files_repo::{self, FileRow};
use crate::db::groups_repo::{self, Strategy, SyncGroup};
use crate::db::{now_ms, roots_repo};
use crate::error::{AppError, AppResult};
use crate::events;
use crate::fsops;
use crate::paths::{canonicalize, ensure_within_roots};
use crate::state::AppState;
use crate::sync::apply::{self, ApplyResult, SyncPreview};
use crate::sync::diff::{diff_text, DiffResult};

const BACKUPS_DIR: &str = "backups";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncGroupView {
    #[serde(flatten)]
    pub group: SyncGroup,
    pub canonical: Option<FileRow>,
    pub members: Vec<SyncMemberView>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMemberView {
    pub file: FileRow,
    pub strategy: Strategy,
    pub baseline_hash: Option<String>,
    pub status: apply::MemberStatus,
}

fn backups_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::internal(format!("no app data dir: {error}")))?
        .join(BACKUPS_DIR);
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Every member path is re-resolved against the enabled roots before any write.
fn ensure_group_within_roots(state: &AppState, group_id: i64) -> AppResult<()> {
    state.db.with_conn(|conn| {
        let roots = roots_repo::list_enabled(conn)?;
        let group = groups_repo::require(conn, group_id)?;
        let mut file_ids: Vec<i64> = groups_repo::members(conn, group_id)?
            .into_iter()
            .map(|member| member.file_id)
            .collect();
        if let Some(canonical) = group.canonical_file_id {
            file_ids.push(canonical);
        }

        for file_id in file_ids {
            let row = files_repo::require(conn, file_id)?;
            let path = PathBuf::from(&row.path);
            // a member may legitimately be missing; only resolvable paths are checked
            if path.exists() {
                ensure_within_roots(&canonicalize(&path)?, &roots)?;
            } else {
                ensure_within_roots(&path, &roots)?;
            }
        }
        Ok(())
    })
}

#[tauri::command]
pub fn list_sync_groups(state: State<'_, AppState>) -> AppResult<Vec<SyncGroupView>> {
    let groups = state.db.with_conn(groups_repo::list)?;
    let mut views = Vec::with_capacity(groups.len());

    for group in groups {
        let canonical = match group.canonical_file_id {
            Some(id) => state.db.with_conn(|conn| files_repo::get(conn, id))?,
            None => None,
        };
        let canonical_text = canonical
            .as_ref()
            .and_then(|row| fsops::read_text(&PathBuf::from(&row.path)).ok())
            .map(|(text, _)| text);

        let members = state
            .db
            .with_conn(|conn| groups_repo::members(conn, group.id))?;
        let mut member_views = Vec::with_capacity(members.len());
        for member in members {
            let Some(file) = state
                .db
                .with_conn(|conn| files_repo::get(conn, member.file_id))?
            else {
                continue;
            };
            let status = member_status(&file, canonical.as_ref(), canonical_text.as_deref());
            member_views.push(SyncMemberView {
                file,
                strategy: member.strategy,
                baseline_hash: member.baseline_hash,
                status,
            });
        }

        views.push(SyncGroupView {
            group,
            canonical,
            members: member_views,
        });
    }

    Ok(views)
}

fn member_status(
    file: &FileRow,
    canonical: Option<&FileRow>,
    canonical_text: Option<&str>,
) -> apply::MemberStatus {
    let path = PathBuf::from(&file.path);
    if !path.exists() {
        return apply::MemberStatus::Missing;
    }
    let is_symlink = std::fs::symlink_metadata(&path).is_ok_and(|meta| meta.is_symlink());
    if is_symlink {
        if let Some(canonical) = canonical {
            let target = PathBuf::from(&canonical.path);
            if path.canonicalize().ok() == target.canonicalize().ok() {
                return apply::MemberStatus::Symlinked;
            }
        }
    }
    match (fsops::read_text(&path).ok(), canonical_text) {
        (Some((text, _)), Some(canonical_text)) if text == canonical_text => {
            apply::MemberStatus::InSync
        }
        _ => apply::MemberStatus::Drifted,
    }
}

#[tauri::command]
pub fn create_sync_group(
    state: State<'_, AppState>,
    name: String,
    canonical_file_id: i64,
    member_file_ids: Option<Vec<i64>>,
    strategy: Option<Strategy>,
) -> AppResult<i64> {
    let strategy = strategy.unwrap_or(Strategy::Copy);
    state.db.with_tx(|tx| {
        files_repo::require(tx, canonical_file_id)?;
        let group_id = groups_repo::create(tx, name.trim(), canonical_file_id, now_ms())?;
        for file_id in member_file_ids.unwrap_or_default() {
            if file_id == canonical_file_id {
                continue;
            }
            files_repo::require(tx, file_id)?;
            groups_repo::add_member(tx, group_id, file_id, strategy)?;
        }
        Ok(group_id)
    })
}

#[tauri::command]
pub fn set_canonical(state: State<'_, AppState>, group_id: i64, file_id: i64) -> AppResult<()> {
    state
        .db
        .with_tx(|tx| groups_repo::set_canonical(tx, group_id, file_id))
}

#[tauri::command]
pub fn add_members(
    state: State<'_, AppState>,
    group_id: i64,
    file_ids: Vec<i64>,
    strategy: Strategy,
) -> AppResult<()> {
    state.db.with_tx(|tx| {
        for file_id in file_ids {
            files_repo::require(tx, file_id)?;
            groups_repo::add_member(tx, group_id, file_id, strategy)?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn remove_member(state: State<'_, AppState>, group_id: i64, file_id: i64) -> AppResult<()> {
    state
        .db
        .with_conn(|conn| groups_repo::remove_member(conn, group_id, file_id))
}

#[tauri::command]
pub fn delete_sync_group(state: State<'_, AppState>, group_id: i64) -> AppResult<()> {
    state
        .db
        .with_conn(|conn| groups_repo::delete(conn, group_id))
}

#[tauri::command]
pub fn preview_sync(state: State<'_, AppState>, group_id: i64) -> AppResult<SyncPreview> {
    ensure_group_within_roots(&state, group_id)?;
    apply::preview(&state.db, group_id)
}

#[tauri::command]
pub fn apply_sync(
    app: AppHandle,
    state: State<'_, AppState>,
    group_id: i64,
    token: String,
) -> AppResult<ApplyResult> {
    ensure_group_within_roots(&state, group_id)?;
    let result = apply::apply(&state.db, group_id, &token, &backups_dir(&app)?)?;
    events::emit_index_updated(&app, result.updated_file_ids.clone());
    Ok(result)
}

#[tauri::command]
pub fn list_backups(state: State<'_, AppState>, file_id: Option<i64>) -> AppResult<Vec<Backup>> {
    state.db.with_conn(|conn| backups_repo::list(conn, file_id))
}

#[tauri::command]
pub fn restore_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    backup_id: i64,
) -> AppResult<i64> {
    let backup = state
        .db
        .with_conn(|conn| backups_repo::require(conn, backup_id))?;
    let original = PathBuf::from(&backup.original_path);
    state.db.with_conn(|conn| {
        let roots = roots_repo::list_enabled(conn)?;
        ensure_within_roots(&original, &roots)
    })?;

    let file_id = apply::restore(&state.db, backup_id)?;
    if file_id != 0 {
        events::emit_index_updated(&app, vec![file_id]);
    }
    Ok(file_id)
}

#[tauri::command]
pub fn diff_files(
    state: State<'_, AppState>,
    left_file_id: i64,
    right_file_id: i64,
) -> AppResult<DiffResult> {
    let read = |file_id: i64| -> AppResult<String> {
        let row = state
            .db
            .with_conn(|conn| files_repo::require(conn, file_id))?;
        let roots = state.db.with_conn(roots_repo::list_enabled)?;
        let path = canonicalize(&PathBuf::from(&row.path))?;
        ensure_within_roots(&path, &roots)?;
        Ok(fsops::read_text(&path)?.0)
    };

    Ok(diff_text(&read(left_file_id)?, &read(right_file_id)?))
}
