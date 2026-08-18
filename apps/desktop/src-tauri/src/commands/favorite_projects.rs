use tauri::State;

use crate::db::favorite_projects_repo::{self, FavoriteProject};
use crate::db::now_ms;
use crate::error::AppResult;
use crate::paths::resolve_directory;
use crate::state::AppState;

#[tauri::command]
pub fn list_favorite_projects(state: State<'_, AppState>) -> AppResult<Vec<FavoriteProject>> {
    state.db.with_conn(favorite_projects_repo::list)
}

#[tauri::command]
pub fn set_project_favorite(
    state: State<'_, AppState>,
    path: String,
    favorite: bool,
) -> AppResult<()> {
    let normalized = resolve_directory(&path)?.to_string_lossy().into_owned();
    state
        .db
        .with_conn(|conn| favorite_projects_repo::set(conn, &normalized, favorite, now_ms()))
}
