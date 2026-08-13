mod capture;
mod commands;
mod db;
mod error;
mod events;
mod fsops;
mod paths;
mod scanner;
mod state;
mod sync;
mod watcher;

use tauri::Manager as _;

use db::Db;
use state::AppState;

const DB_FILE: &str = "index.db";

pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            }))
            .plugin(tauri_plugin_window_state::Builder::default().build())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let db = Db::open(&app_data_dir.join(DB_FILE))?;
            commands::roots::seed_default_roots(&db)?;
            app.manage(AppState::new(db, app_data_dir.join("prompt-attachments")));

            let handle = app.handle().clone();
            let state = handle.state::<AppState>();
            commands::watcher::start_if_enabled(&handle, &state.db.clone(), &state)?;
            if let Some(window) = app.get_webview_window("capture-overlay") {
                window.set_ignore_cursor_events(true)?;
            }
            capture::start(&handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::roots::list_roots,
            commands::roots::add_root,
            commands::roots::set_root_enabled,
            commands::roots::remove_root,
            commands::favorite_projects::list_favorite_projects,
            commands::favorite_projects::set_project_favorite,
            commands::prompts::list_prompt_history,
            commands::prompts::create_prompt,
            commands::prompts::read_prompt_attachment,
            capture::capture_access_status,
            capture::request_capture_access,
            commands::scan::start_scan,
            commands::scan::cancel_scan,
            commands::files::list_files,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::list_duplicates,
            commands::watcher::get_watcher_status,
            commands::watcher::set_watcher_enabled,
            commands::sync::list_sync_groups,
            commands::sync::create_sync_group,
            commands::sync::set_canonical,
            commands::sync::add_members,
            commands::sync::remove_member,
            commands::sync::delete_sync_group,
            commands::sync::preview_sync,
            commands::sync::apply_sync,
            commands::sync::list_backups,
            commands::sync::restore_backup,
            commands::sync::diff_files,
            commands::registry::install_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
