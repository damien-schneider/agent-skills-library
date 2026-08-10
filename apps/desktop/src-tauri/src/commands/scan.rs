use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::{AppHandle, State};

use crate::db::roots_repo;
use crate::db::Db;
use crate::error::AppResult;
use crate::events::{self, ScanDone, ScanError, ScanProgress};
use crate::scanner::{self, ScanStats};
use crate::state::AppState;

const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);

#[tauri::command]
pub fn start_scan(
    app: AppHandle,
    state: State<'_, AppState>,
    root_ids: Option<Vec<i64>>,
) -> AppResult<i64> {
    let roots = state.db.with_conn(|conn| {
        let enabled = roots_repo::list_enabled(conn)?;
        Ok(match &root_ids {
            Some(ids) => enabled
                .into_iter()
                .filter(|root| ids.contains(&root.id))
                .collect(),
            None => enabled,
        })
    })?;

    let scan_id = scanner::create_scan_row(&state.db)?;
    let cancel = state.begin_scan(scan_id)?;
    let db = Arc::clone(&state.db);

    std::thread::spawn(move || {
        run_in_background(app, db, roots, scan_id, cancel);
    });

    Ok(scan_id)
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) -> AppResult<Option<i64>> {
    state.cancel_scan()
}

fn run_in_background(
    app: AppHandle,
    db: Arc<Db>,
    roots: Vec<roots_repo::Root>,
    scan_id: i64,
    cancel: Arc<AtomicBool>,
) {
    let mut last_emit = Instant::now() - PROGRESS_INTERVAL;
    let progress_app = app.clone();

    let outcome = scanner::run_scan(&db, &roots, scan_id, &cancel, move |stats: ScanStats| {
        if last_emit.elapsed() < PROGRESS_INTERVAL {
            return;
        }
        last_emit = Instant::now();
        events::emit_scan_progress(&progress_app, ScanProgress { scan_id, stats });
    });

    match outcome {
        Ok(outcome) => {
            let status = if outcome.cancelled {
                "cancelled"
            } else {
                "done"
            };
            let _ = scanner::finish_scan_row(&db, scan_id, status, &outcome.stats);
            events::emit_index_updated(&app, outcome.touched_ids);
            events::emit_scan_done(
                &app,
                ScanDone {
                    scan_id,
                    cancelled: outcome.cancelled,
                    stats: outcome.stats,
                },
            );
        }
        Err(error) => {
            let _ = scanner::finish_scan_row(&db, scan_id, "error", &ScanStats::default());
            events::emit_scan_error(
                &app,
                ScanError {
                    scan_id,
                    code: error.code().to_string(),
                    message: error.to_string(),
                },
            );
        }
    }

    if let Some(state) = tauri::Manager::try_state::<AppState>(&app) {
        state.end_scan();
    }
}
