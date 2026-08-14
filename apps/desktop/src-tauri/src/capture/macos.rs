mod pasteboard;
mod shortcut;

use std::fmt::{self, Display, Formatter};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use axuielement::ax_attribute::attributes::AX_SELECTED_TEXT_ATTRIBUTE;
use axuielement::{is_process_trusted, is_process_trusted_with_prompt, system_wide};
use tauri::{AppHandle, Manager as _, PhysicalPosition};
use tauri_plugin_opener::OpenerExt as _;

use self::pasteboard::selected_text_from_clipboard;
use self::shortcut::{listen_for_double_shift, ShortcutProgress};

use super::CaptureAccessStatus;
use crate::commands::prompts::create_prompt_in;
use crate::error::{AppError, AppResult};
use crate::events;
use crate::state::AppState;

const ACCESSIBILITY_SETTINGS_URL: &str =
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
const ACCESS_RETRY_DELAY: Duration = Duration::from_secs(1);
const OVERLAY_TOP_INSET: f64 = 14.0;
const OVERLAY_WINDOW: &str = "capture-overlay";

#[derive(Debug)]
enum SelectionCaptureError {
    NoSelection(&'static str),
    ClipboardChanged,
    ClipboardUnavailable(String),
}

impl SelectionCaptureError {
    fn user_message(&self) -> &'static str {
        match self {
            Self::NoSelection(_) => "No text selected",
            Self::ClipboardChanged => "Clipboard changed during capture",
            Self::ClipboardUnavailable(_) => "Could not use clipboard safely",
        }
    }
}

impl Display for SelectionCaptureError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::NoSelection(detail) => formatter.write_str(detail),
            Self::ClipboardUnavailable(detail) => formatter.write_str(detail),
            Self::ClipboardChanged => {
                formatter.write_str("the clipboard changed before it could be restored")
            }
        }
    }
}

pub fn start(app: AppHandle) {
    position_overlay(&app);
    thread::Builder::new()
        .name("selection-capture".to_string())
        .spawn(move || monitor_access_and_shortcut(app))
        .expect("could not start selection capture thread");
}

pub fn access_status() -> CaptureAccessStatus {
    CaptureAccessStatus {
        supported: true,
        granted: is_process_trusted(),
    }
}

pub fn request_access(app: &AppHandle) -> AppResult<CaptureAccessStatus> {
    let granted = is_process_trusted_with_prompt();
    if !granted {
        app.opener()
            .open_url(ACCESSIBILITY_SETTINGS_URL, None::<&str>)
            .map_err(|error| {
                AppError::internal(format!("could not open Accessibility settings: {error}"))
            })?;
    }
    Ok(CaptureAccessStatus {
        supported: true,
        granted,
    })
}

fn monitor_access_and_shortcut(app: AppHandle) {
    let mut last_granted = None;

    loop {
        let granted = is_process_trusted();
        if last_granted != Some(granted) {
            events::emit_capture_access_changed(&app, access_status());
            last_granted = Some(granted);
        }
        if !granted {
            thread::sleep(ACCESS_RETRY_DELAY);
            continue;
        }

        let (sender, receiver) = mpsc::sync_channel(2);
        let worker_app = app.clone();
        let worker = thread::Builder::new()
            .name("selection-capture-worker".to_string())
            .spawn(move || {
                while let Ok(progress) = receiver.recv() {
                    match progress {
                        ShortcutProgress::FirstTap => show_shortcut_progress(&worker_app, 1),
                        ShortcutProgress::Complete => {
                            show_shortcut_progress(&worker_app, 2);
                            capture_selection(&worker_app);
                        }
                    }
                }
            });
        if let Err(error) = worker {
            log::error!("could not start selection capture worker: {error}");
            return;
        }

        if listen_for_double_shift(sender).is_err() {
            log::error!("global shortcut listener stopped; retrying");
            thread::sleep(ACCESS_RETRY_DELAY);
        }
    }
}

fn show_shortcut_progress(app: &AppHandle, completed_taps: u8) {
    position_overlay(app);
    events::emit_capture_shortcut_progress(app, completed_taps);
}

fn capture_selection(app: &AppHandle) {
    match selected_text() {
        Ok(content) => {
            let result = {
                let state = app.state::<AppState>();
                create_prompt_in(state.inner(), content, None, Vec::new())
            };
            match result {
                Ok(prompt) => {
                    position_overlay(app);
                    events::emit_capture_saved(app, prompt);
                }
                Err(error) => {
                    log::error!("could not save selected text: {error}");
                    show_capture_error(app, "Could not save selection");
                }
            }
        }
        Err(error) => {
            log::debug!("could not capture selected text: {error}");
            show_capture_error(app, error.user_message());
        }
    }
}

fn selected_text() -> Result<String, SelectionCaptureError> {
    if let Ok(Some(content)) = selected_text_from_accessibility() {
        if !content.trim().is_empty() {
            return Ok(content);
        }
    }

    selected_text_from_clipboard().and_then(|content| {
        if content.trim().is_empty() {
            Err(SelectionCaptureError::NoSelection(
                "the copied selection was empty",
            ))
        } else {
            Ok(content)
        }
    })
}

fn selected_text_from_accessibility() -> Result<Option<String>, String> {
    let system = system_wide().ok_or_else(|| "Accessibility API is unavailable".to_string())?;
    let focused = system
        .focused_ui_element()
        .map_err(|error| format!("could not read focused element: {error}"))?;
    focused
        .map(|element| {
            element
                .string_attribute(AX_SELECTED_TEXT_ATTRIBUTE)
                .map_err(|error| format!("could not read selected text: {error}"))
        })
        .transpose()
        .map(Option::flatten)
}

fn show_capture_error(app: &AppHandle, message: &str) {
    position_overlay(app);
    events::emit_capture_error(app, message.to_string());
}

fn position_overlay(app: &AppHandle) {
    let Some(window) = app.get_webview_window(OVERLAY_WINDOW) else {
        log::error!("capture overlay window is missing");
        return;
    };

    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|position| {
            app.monitor_from_point(position.x, position.y)
                .ok()
                .flatten()
        })
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        if let Ok(window_size) = window.outer_size() {
            let monitor_position = monitor.position();
            let monitor_size = monitor.size();
            let x = monitor_position.x + (monitor_size.width as i32 - window_size.width as i32) / 2;
            let y = monitor_position.y + (OVERLAY_TOP_INSET * monitor.scale_factor()) as i32;
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    }
}
