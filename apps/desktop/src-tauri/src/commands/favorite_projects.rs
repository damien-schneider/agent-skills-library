use std::path::PathBuf;

use tauri::State;

use crate::db::favorite_projects_repo::{self, FavoriteProject};
use crate::db::now_ms;
use crate::error::{AppError, AppResult};
use crate::paths::canonicalize;
use crate::state::AppState;

fn normalize_project_path(path: &str) -> AppResult<String> {
    let resolved = canonicalize(&PathBuf::from(path))?;
    if !resolved.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "{} is not a directory",
            resolved.display()
        )));
    }
    Ok(resolved.to_string_lossy().into_owned())
}

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
    let normalized = normalize_project_path(&path)?;
    state
        .db
        .with_conn(|conn| favorite_projects_repo::set(conn, &normalized, favorite, now_ms()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn normalizes_an_existing_project_directory() {
        let project = tempdir().unwrap();
        let expected = project.path().canonicalize().unwrap();

        let normalized = normalize_project_path(&project.path().to_string_lossy()).unwrap();

        assert_eq!(PathBuf::from(normalized), expected);
    }

    #[test]
    fn rejects_a_missing_project_directory() {
        let error = normalize_project_path("/missing/favorite/project").unwrap_err();

        assert_eq!(error.code(), "invalid_path");
    }
}
