use std::path::Path;

use serde::Serialize;
use tauri::State;

use crate::db::destinations_repo::{self, DestinationRow};
use crate::error::AppResult;
use crate::paths::resolve_directory;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DestinationFolder {
    pub path: String,
    pub favorite: bool,
    pub last_used_at: Option<i64>,
    pub file_count: i64,
    /// Starred and previously used folders outlive the disk: a renamed or deleted
    /// one still has to be listed so it can be recognised and unstarred.
    pub available: bool,
}

impl From<DestinationRow> for DestinationFolder {
    fn from(row: DestinationRow) -> Self {
        Self {
            available: Path::new(&row.path).is_dir(),
            path: row.path,
            favorite: row.favorite,
            last_used_at: row.last_used_at,
            file_count: row.file_count,
        }
    }
}

#[tauri::command]
pub fn list_destination_folders(state: State<'_, AppState>) -> AppResult<Vec<DestinationFolder>> {
    list_destination_folders_in(state.inner())
}

#[tauri::command]
pub fn resolve_destination_folder(
    state: State<'_, AppState>,
    path: String,
) -> AppResult<DestinationFolder> {
    resolve_destination_folder_in(state.inner(), &path)
}

fn list_destination_folders_in(state: &AppState) -> AppResult<Vec<DestinationFolder>> {
    let rows = state.db.with_conn(destinations_repo::list)?;
    Ok(rows.into_iter().map(DestinationFolder::from).collect())
}

fn resolve_destination_folder_in(state: &AppState, path: &str) -> AppResult<DestinationFolder> {
    let resolved = resolve_directory(path)?.to_string_lossy().into_owned();
    let known = state
        .db
        .with_conn(|conn| destinations_repo::get(conn, &resolved))?;
    Ok(known.map_or_else(
        || DestinationFolder {
            path: resolved,
            favorite: false,
            last_used_at: None,
            file_count: 0,
            available: true,
        },
        DestinationFolder::from,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::favorite_projects_repo;
    use crate::db::Db;
    use tempfile::tempdir;

    fn state() -> AppState {
        AppState::new(Db::open_in_memory().unwrap(), tempdir().unwrap().keep())
    }

    #[test]
    fn keeps_a_starred_folder_that_no_longer_exists_and_flags_it() {
        let state = state();
        let missing = tempdir().unwrap();
        let missing_path = missing.path().canonicalize().unwrap();
        drop(missing);
        state
            .db
            .with_conn(|conn| {
                favorite_projects_repo::set(conn, &missing_path.to_string_lossy(), true, 0)
            })
            .unwrap();

        let folders = list_destination_folders_in(&state).unwrap();

        assert_eq!(folders.len(), 1);
        assert!(folders[0].favorite);
        assert!(!folders[0].available);
    }

    #[test]
    fn resolves_a_folder_the_index_never_saw() {
        let state = state();
        let directory = tempdir().unwrap();

        let resolved =
            resolve_destination_folder_in(&state, &directory.path().to_string_lossy()).unwrap();

        assert_eq!(
            Path::new(&resolved.path),
            directory.path().canonicalize().unwrap()
        );
        assert!(resolved.available);
        assert!(!resolved.favorite);
    }

    #[test]
    fn carries_the_starred_state_of_a_resolved_folder() {
        let state = state();
        let directory = tempdir().unwrap();
        let path = directory.path().canonicalize().unwrap();
        state
            .db
            .with_conn(|conn| favorite_projects_repo::set(conn, &path.to_string_lossy(), true, 0))
            .unwrap();

        let resolved =
            resolve_destination_folder_in(&state, &directory.path().to_string_lossy()).unwrap();

        assert!(resolved.favorite);
    }

    #[test]
    fn rejects_a_folder_that_does_not_exist() {
        let state = state();

        let error = resolve_destination_folder_in(&state, "/missing/destination").unwrap_err();

        assert_eq!(error.code(), "invalid_path");
    }
}
