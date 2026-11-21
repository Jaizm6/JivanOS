mod keychain;
mod oauth;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;

const TRAY_ID: &str = "jivanos-tray";

#[tauri::command]
fn tray_set_tooltip(app: tauri::AppHandle, tooltip: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let safe_tooltip = tooltip.chars().take(128).collect::<String>();
        tray.set_tooltip(Some(safe_tooltip))
            .map_err(|e| format!("Failed to update tray tooltip: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn desktop_show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(oauth::OAuthLoopbackState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let sync_item = MenuItem::with_id(app, "sync_now", "Sync Now", true, None::<&str>)?;
            let open_item = MenuItem::with_id(app, "open_app", "Open JivanOS", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit_app", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&sync_item, &open_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
                .menu(&menu)
                .tooltip("JivanOS — Ready")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "sync_now" => {
                        let _ = app.emit("jivanos://tray-sync-now", ());
                    }
                    "open_app" => {
                        focus_main_window(app);
                        let _ = app.emit("jivanos://tray-open", ());
                    }
                    "quit_app" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        focus_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            keychain::keychain_set_token,
            keychain::keychain_get_token,
            keychain::keychain_delete_token,
            oauth::oauth_start_loopback,
            oauth::oauth_wait_callback,
            oauth::oauth_cancel_loopback,
            tray_set_tooltip,
            desktop_show_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running JivanOS desktop application");
}
