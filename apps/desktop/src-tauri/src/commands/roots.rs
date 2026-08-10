use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::db::roots_repo::{self, Root};
use crate::db::{now_ms, set_meta, Db, META_DEFAULT_ROOTS_SEEDED};
use crate::error::{AppError, AppResult};
use crate::paths::{canonicalize, conflicts_with_existing_root};
use crate::state::AppState;

use super::watcher::restart as restart_watcher;

#[tauri::command]
pub fn list_roots(state: State<'_, AppState>) -> AppResult<Vec<Root>> {
    state.db.with_conn(roots_repo::list)
}

#[tauri::command]
pub fn add_root(app: AppHandle, state: State<'_, AppState>, path: String) -> AppResult<Root> {
    let resolved = canonicalize(&PathBuf::from(&path))?;
    if !resolved.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "{} is not a directory",
            resolved.display()
        )));
    }

    let root = state.db.with_conn(|conn| {
        let existing = roots_repo::list(conn)?;
        if let Some(conflict) = conflicts_with_existing_root(&resolved, &existing) {
            return Err(AppError::InvalidPath(format!(
                "{} overlaps the root {conflict}",
                resolved.display()
            )));
        }

        let stored = resolved.to_string_lossy().into_owned();
        let id = roots_repo::insert(conn, &stored, now_ms())?;
        roots_repo::get(conn, id)?
            .ok_or_else(|| AppError::internal("root vanished right after insert"))
    })?;

    restart_watcher(&app, &state)?;
    Ok(root)
}

#[tauri::command]
pub fn set_root_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    enabled: bool,
) -> AppResult<()> {
    state.db.with_conn(|conn| {
        roots_repo::get(conn, id)?
            .ok_or_else(|| AppError::NotFound(format!("root {id} does not exist")))?;
        roots_repo::set_enabled(conn, id, enabled)
    })?;
    restart_watcher(&app, &state)
}

#[tauri::command]
pub fn remove_root(app: AppHandle, state: State<'_, AppState>, id: i64) -> AppResult<()> {
    state.db.with_conn(|conn| roots_repo::remove(conn, id))?;
    restart_watcher(&app, &state)
}

/// `~/Documents/GitHub` and `~/.claude` on first launch — silently skipped when absent.
pub fn seed_default_roots(db: &Db) -> AppResult<()> {
    db.with_conn(|conn| {
        if crate::db::get_meta(conn, META_DEFAULT_ROOTS_SEEDED)?.is_some() {
            return Ok(());
        }

        let home = dirs::home_dir();
        let candidates = home
            .map(|home| vec![home.join("Documents/GitHub"), home.join(".claude")])
            .unwrap_or_default();

        for candidate in candidates {
            if !candidate.is_dir() {
                continue;
            }
            let Ok(resolved) = candidate.canonicalize() else {
                continue;
            };
            let existing = roots_repo::list(conn)?;
            if conflicts_with_existing_root(&resolved, &existing).is_some() {
                continue;
            }
            roots_repo::insert(conn, &resolved.to_string_lossy(), now_ms())?;
        }

        set_meta(conn, META_DEFAULT_ROOTS_SEEDED, "true")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn seeding_runs_once() {
        let db = Db::open_in_memory().unwrap();

        seed_default_roots(&db).unwrap();
        let after_first = db.with_conn(roots_repo::list).unwrap().len();
        seed_default_roots(&db).unwrap();

        assert_eq!(db.with_conn(roots_repo::list).unwrap().len(), after_first);
    }

    #[test]
    fn a_nested_directory_is_refused_as_a_second_root() {
        let db = Db::open_in_memory().unwrap();
        let dir = tempdir().unwrap();
        let parent = dir.path().canonicalize().unwrap();
        std::fs::create_dir_all(parent.join("child")).unwrap();

        db.with_conn(|conn| roots_repo::insert(conn, &parent.to_string_lossy(), 0))
            .unwrap();

        let existing = db.with_conn(roots_repo::list).unwrap();
        assert!(conflicts_with_existing_root(&parent.join("child"), &existing).is_some());
    }
}
