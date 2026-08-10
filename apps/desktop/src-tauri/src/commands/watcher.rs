use serde::Serialize;
use tauri::{AppHandle, State};

use crate::db::{get_meta_bool, roots_repo, set_meta, Db, META_WATCHER_ENABLED};
use crate::error::AppResult;
use crate::state::AppState;
use crate::watcher;

const WATCHER_DEFAULT: bool = true;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherStatus {
    pub enabled: bool,
    pub running: bool,
}

#[tauri::command]
pub fn get_watcher_status(state: State<'_, AppState>) -> AppResult<WatcherStatus> {
    let enabled = state
        .db
        .with_conn(|conn| get_meta_bool(conn, META_WATCHER_ENABLED, WATCHER_DEFAULT))?;
    Ok(WatcherStatus {
        enabled,
        running: state.watcher_running(),
    })
}

#[tauri::command]
pub fn set_watcher_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> AppResult<WatcherStatus> {
    state.db.with_conn(|conn| {
        set_meta(
            conn,
            META_WATCHER_ENABLED,
            if enabled { "true" } else { "false" },
        )
    })?;

    if enabled {
        restart(&app, &state)?;
    } else {
        state.clear_watcher();
    }

    Ok(WatcherStatus {
        enabled,
        running: state.watcher_running(),
    })
}

/// Roots changed or the toggle flipped: the debouncer watches a fixed path list.
pub fn restart(app: &AppHandle, state: &AppState) -> AppResult<()> {
    state.clear_watcher();

    let enabled = state
        .db
        .with_conn(|conn| get_meta_bool(conn, META_WATCHER_ENABLED, WATCHER_DEFAULT))?;
    if !enabled {
        return Ok(());
    }

    let roots = state.db.with_conn(roots_repo::list_enabled)?;
    if roots.is_empty() {
        return Ok(());
    }

    let handle = watcher::start(app.clone(), std::sync::Arc::clone(&state.db), roots)?;
    state.set_watcher(handle);
    Ok(())
}

pub fn start_if_enabled(app: &AppHandle, db: &Db, state: &AppState) -> AppResult<()> {
    let enabled =
        db.with_conn(|conn| get_meta_bool(conn, META_WATCHER_ENABLED, WATCHER_DEFAULT))?;
    if enabled {
        restart(app, state)?;
    }
    Ok(())
}
