#[cfg(target_os = "macos")]
mod macos;

use serde::Serialize;
use tauri::AppHandle;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureAccessStatus {
    pub supported: bool,
    pub granted: bool,
}

pub fn start(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    macos::start(app.clone());

    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

#[tauri::command]
pub fn capture_access_status() -> CaptureAccessStatus {
    #[cfg(target_os = "macos")]
    {
        macos::access_status()
    }

    #[cfg(not(target_os = "macos"))]
    {
        CaptureAccessStatus {
            supported: false,
            granted: false,
        }
    }
}

#[tauri::command]
pub fn request_capture_access(app: AppHandle) -> AppResult<CaptureAccessStatus> {
    #[cfg(target_os = "macos")]
    {
        macos::request_access(&app)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(CaptureAccessStatus {
            supported: false,
            granted: false,
        })
    }
}
