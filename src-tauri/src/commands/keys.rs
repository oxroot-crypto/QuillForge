use crate::crypto;
use crate::AppState;
use super::helpers::get_api_key_internal;
use tauri::State;
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub fn save_api_key(
    state: State<'_, AppState>,
    provider: String,
    api_key: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let encryption_key = state
        .encryption_key
        .lock()
        .map_err(|e| format!("Lock failed: {e}"))?;

    let key = encryption_key.ok_or("Encryption key not initialized")?;
    let encrypted = crypto::encrypt(&api_key, &key)?;

    let store = app_handle
        .store("quillforge-secrets.json")
        .map_err(|e| format!("Store open failed: {e}"))?;
    store.set(format!("apikey_{provider}"), serde_json::Value::String(encrypted));
    store.save().map_err(|e| format!("Persist failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_api_key_masked(
    state: State<'_, AppState>,
    provider: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let api_key = get_api_key_internal(&state, &provider, &app_handle)?;
    match api_key {
        Some(key) => Ok(mask_key(&key)),
        None => Ok("N/A".into()),
    }
}

#[tauri::command]
pub fn has_api_key(
    state: State<'_, AppState>,
    provider: String,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let api_key = get_api_key_internal(&state, &provider, &app_handle)?;
    Ok(api_key.is_some())
}

#[tauri::command]
pub fn delete_api_key(
    _state: State<'_, AppState>,
    provider: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let store = app_handle
        .store("quillforge-secrets.json")
        .map_err(|e| format!("Store open failed: {e}"))?;
    store.delete(format!("apikey_{provider}"));
    store.save().map_err(|e| format!("Persist failed: {e}"))?;
    Ok(())
}

fn mask_key(key: &str) -> String {
    if key.len() <= 8 {
        return "***".into();
    }
    let prefix: String = key.chars().take(4).collect();
    let suffix: String = key.chars().rev().take(4).collect::<String>().chars().rev().collect();
    format!("{prefix}****{suffix}")
}
