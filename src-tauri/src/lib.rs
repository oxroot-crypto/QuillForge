mod commands;
mod crypto;
mod llm;

use std::sync::Mutex;
use base64::Engine;
use tauri::Manager;
use tauri_plugin_store::StoreExt;

pub struct AppState {
    pub encryption_key: Mutex<Option<[u8; 32]>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            encryption_key: Mutex::new(None),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            app.manage(AppState::new());

            let store = app.store("quillforge-secrets.json")?;
            let key = store.get("encryption_key");

            if key.is_none() {
                let new_key = crypto::generate_key();
                let encoded = base64::engine::general_purpose::STANDARD.encode(&new_key);
                store.set("encryption_key", serde_json::Value::String(encoded));
                store.save()?;
                let state = app.state::<AppState>();
                *state.encryption_key.lock().unwrap() = Some(new_key);
            } else {
                let encoded = key.unwrap().as_str().unwrap_or("").to_string();
                if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(&encoded) {
                    let mut key_bytes = [0u8; 32];
                    let len = decoded.len().min(32);
                    key_bytes[..len].copy_from_slice(&decoded[..len]);
                    let state = app.state::<AppState>();
                    *state.encryption_key.lock().unwrap() = Some(key_bytes);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_ai_message,
            commands::save_api_key,
            commands::get_api_key_masked,
            commands::has_api_key,
            commands::delete_api_key,
            commands::get_supported_providers,
            commands::check_provider_connection,
            commands::save_all_books,
            commands::load_all_books,
            commands::delete_book_dir,
            commands::export_book_markdown,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch");
}
