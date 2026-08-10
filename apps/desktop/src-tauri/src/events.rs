use serde::Serialize;
use tauri::{AppHandle, Emitter as _};

use crate::scanner::ScanStats;

pub const SCAN_PROGRESS: &str = "scan:progress";
pub const SCAN_DONE: &str = "scan:done";
pub const SCAN_ERROR: &str = "scan:error";
pub const INDEX_UPDATED: &str = "index:updated";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub scan_id: i64,
    #[serde(flatten)]
    pub stats: ScanStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanDone {
    pub scan_id: i64,
    pub cancelled: bool,
    #[serde(flatten)]
    pub stats: ScanStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanError {
    pub scan_id: i64,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexUpdated {
    pub file_ids: Vec<i64>,
}

pub fn emit_scan_progress(app: &AppHandle, payload: ScanProgress) {
    let _ = app.emit(SCAN_PROGRESS, payload);
}

pub fn emit_scan_done(app: &AppHandle, payload: ScanDone) {
    let _ = app.emit(SCAN_DONE, payload);
}

pub fn emit_scan_error(app: &AppHandle, payload: ScanError) {
    let _ = app.emit(SCAN_ERROR, payload);
}

pub fn emit_index_updated(app: &AppHandle, file_ids: Vec<i64>) {
    if file_ids.is_empty() {
        return;
    }
    let _ = app.emit(INDEX_UPDATED, IndexUpdated { file_ids });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_progress_flattens_its_stats_in_camel_case() {
        let json = serde_json::to_value(ScanProgress {
            scan_id: 7,
            stats: ScanStats {
                seen: 3,
                hashed: 2,
                added: 1,
                changed: 0,
                removed: 0,
            },
        })
        .unwrap();

        assert_eq!(json["scanId"], 7);
        assert_eq!(json["seen"], 3);
        assert_eq!(json["hashed"], 2);
    }

    #[test]
    fn index_updated_uses_camel_case_ids() {
        let json = serde_json::to_value(IndexUpdated {
            file_ids: vec![1, 2],
        })
        .unwrap();

        assert_eq!(json["fileIds"], serde_json::json!([1, 2]));
    }
}
