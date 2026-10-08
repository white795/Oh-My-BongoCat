mod core;
mod utils;

use core::{
    ambient::{parse_dispatch_request, DispatchRequest},
    ambient_runtime::AmbientRuntime,
    device::start_device_listening,
    gamepad::{start_gamepad_listing, stop_gamepad_listing},
    prevent_default, setup, statistics,
};
use tauri::{generate_handler, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_custom_window::{
    show_preference_window, MAIN_WINDOW_LABEL, PREFERENCE_WINDOW_LABEL,
};
use utils::fs_extra::copy_dir;

#[tauri::command]
fn set_codex_ambient_enabled(app_handle: tauri::AppHandle, enabled: bool) {
    app_handle
        .state::<AmbientRuntime>()
        .set_indicator_enabled(&app_handle, enabled);
}

#[tauri::command]
fn set_agent_model_control_enabled(app_handle: tauri::AppHandle, enabled: bool) {
    app_handle
        .state::<AmbientRuntime>()
        .set_presentation_enabled(&app_handle, enabled);
}

#[tauri::command]
fn get_codex_ambient_snapshot(app_handle: tauri::AppHandle) -> core::ambient::AmbientSnapshot {
    app_handle.state::<AmbientRuntime>().snapshot()
}

#[tauri::command]
fn complete_agent_ambient_alert(app_handle: tauri::AppHandle, generation: u64) {
    app_handle
        .state::<AmbientRuntime>()
        .complete_alert(&app_handle, generation);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AmbientRuntime::default())
        .setup(|app| {
            let app_handle = app.handle();

            let main_window = app.get_webview_window(MAIN_WINDOW_LABEL).unwrap();

            let preference_window = app.get_webview_window(PREFERENCE_WINDOW_LABEL).unwrap();

            setup::default(&app_handle, main_window.clone(), preference_window.clone());

            #[cfg(target_os = "windows")]
            core::ambient_pipe::start(app_handle.clone());

            Ok(())
        })
        .invoke_handler(generate_handler![
            complete_agent_ambient_alert,
            copy_dir,
            get_codex_ambient_snapshot,
            set_agent_model_control_enabled,
            set_codex_ambient_enabled,
            start_device_listening,
            start_gamepad_listing,
            stop_gamepad_listing
        ])
        .plugin(tauri_plugin_admin_status::init())
        .plugin(tauri_plugin_custom_window::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(statistics::init())
        .plugin(tauri_plugin_pinia::init())
        .plugin(prevent_default::init())
        .plugin(tauri_plugin_single_instance::init(
            |app_handle, argv, _cwd| match parse_dispatch_request(&argv) {
                DispatchRequest::Ambient(event) => {
                    app_handle
                        .state::<AmbientRuntime>()
                        .ingest(app_handle, event);
                }
                DispatchRequest::InvalidAmbient => {}
                DispatchRequest::NotAmbient => {
                    show_preference_window(app_handle);
                }
            },
        ))
        .plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .filter(|metadata| !metadata.target().contains("gilrs"))
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_locale::init())
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();

                api.prevent_close();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => {
            show_preference_window(app_handle);
        }
        _ => {
            let _ = app_handle;
        }
    });
}
