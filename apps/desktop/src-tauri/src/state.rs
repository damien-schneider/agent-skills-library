use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::watcher::WatcherHandle;

pub struct RunningScan {
    pub id: i64,
    pub cancel: Arc<AtomicBool>,
}

pub struct AppState {
    pub db: Arc<Db>,
    scan: Mutex<Option<RunningScan>>,
    watcher: Mutex<Option<WatcherHandle>>,
}

impl AppState {
    pub fn new(db: Db) -> Self {
        Self {
            db: Arc::new(db),
            scan: Mutex::new(None),
            watcher: Mutex::new(None),
        }
    }

    pub fn set_watcher(&self, handle: WatcherHandle) {
        if let Ok(mut slot) = self.watcher.lock() {
            *slot = Some(handle);
        }
    }

    /// Dropping the handle stops the debouncer thread and releases the OS watches.
    pub fn clear_watcher(&self) {
        if let Ok(mut slot) = self.watcher.lock() {
            *slot = None;
        }
    }

    pub fn watcher_running(&self) -> bool {
        self.watcher
            .lock()
            .map(|slot| slot.is_some())
            .unwrap_or(false)
    }

    /// Refuses a second scan rather than queueing it: two walkers would fight over the writer.
    pub fn begin_scan(&self, id: i64) -> AppResult<Arc<AtomicBool>> {
        let mut slot = self
            .scan
            .lock()
            .map_err(|_| AppError::internal("scan mutex poisoned"))?;
        if slot.is_some() {
            return Err(AppError::ScanBusy);
        }
        let cancel = Arc::new(AtomicBool::new(false));
        *slot = Some(RunningScan {
            id,
            cancel: Arc::clone(&cancel),
        });
        Ok(cancel)
    }

    pub fn end_scan(&self) {
        if let Ok(mut slot) = self.scan.lock() {
            *slot = None;
        }
    }

    pub fn cancel_scan(&self) -> AppResult<Option<i64>> {
        let slot = self
            .scan
            .lock()
            .map_err(|_| AppError::internal("scan mutex poisoned"))?;
        Ok(slot.as_ref().map(|running| {
            running.cancel.store(true, Ordering::Relaxed);
            running.id
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> AppState {
        AppState::new(Db::open_in_memory().unwrap())
    }

    #[test]
    fn a_second_scan_is_refused_while_one_runs() {
        let state = state();
        state.begin_scan(1).unwrap();

        assert_eq!(state.begin_scan(2).unwrap_err().code(), "scan_busy");
    }

    #[test]
    fn a_scan_can_start_again_once_the_previous_one_ends() {
        let state = state();
        state.begin_scan(1).unwrap();
        state.end_scan();

        assert!(state.begin_scan(2).is_ok());
    }

    #[test]
    fn cancelling_flips_the_flag_of_the_running_scan() {
        let state = state();
        let cancel = state.begin_scan(9).unwrap();

        let cancelled_id = state.cancel_scan().unwrap();

        assert_eq!(cancelled_id, Some(9));
        assert!(cancel.load(Ordering::Relaxed));
    }

    #[test]
    fn cancelling_without_a_scan_is_a_no_op() {
        assert_eq!(state().cancel_scan().unwrap(), None);
    }
}
