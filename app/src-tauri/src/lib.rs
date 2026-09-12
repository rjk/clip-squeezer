pub mod commands;
pub mod errors;
pub mod files;
pub mod media;

use std::sync::Arc;
use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState::new());

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            files::temp::purge_app_cache_on_startup(&app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::probe_media,
            commands::start_compression,
            commands::check_conversion,
            commands::estimate_gif,
            commands::start_conversion,
            commands::start_audio_extraction,
            commands::start_trim,
            commands::ensure_preview_proxy,
            commands::cancel_job,
            commands::show_in_folder,
            commands::open_file_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
