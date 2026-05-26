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

    fn set_key(&self, key_bytes: [u8; 32]) {
        *self.encryption_key.lock().unwrap() = Some(key_bytes);
    }
}

/// Load existing key from store, or generate and persist a new one
fn init_encryption_key(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let store = app.store("quillforge-secrets.json")?;
    let state = app.state::<AppState>();

    let existing = store.get("encryption_key");
    let key_bytes: [u8; 32] = match existing {
        Some(val) => {
            let encoded = val.as_str().unwrap_or("");
            let decoded = base64::engine::general_purpose::STANDARD.decode(encoded)?;
            let mut key = [0u8; 32];
            let len = decoded.len().min(32);
            key[..len].copy_from_slice(&decoded[..len]);
            key
        }
        None => {
            let new_key = crypto::generate_key();
            let encoded = base64::engine::general_purpose::STANDARD.encode(&new_key);
            store.set("encryption_key", serde_json::Value::String(encoded));
            store.save()?;
            new_key
        }
    };

    state.set_key(key_bytes);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            app.manage(AppState::new());
            init_encryption_key(app)?;
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
            commands::generate_book_info,
            commands::save_all_books,
            commands::load_all_books,
            commands::delete_book_dir,
            commands::export_book_markdown,
            // Phase 1: Version History
            commands::save_snapshot,
            commands::list_snapshots,
            commands::get_snapshot_content,
            commands::restore_snapshot,
            // Phase 1: Spell Check
            commands::spell_check_text,
            // Phase 1: Full-Text Search
            commands::index_chapter,
            commands::remove_chapter_index,
            commands::search_chapters,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch");
}
