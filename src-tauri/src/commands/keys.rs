//! API Key 管理命令——加密存储、掩码查询、删除。
//! Key 经 AES-256-GCM 加密后存入 tauri-plugin-store，前端只能获取掩码状态。

use crate::crypto;
use crate::AppState;
use super::helpers::get_api_key_internal;
use tauri::State;
use tauri_plugin_store::StoreExt;

/// 保存 API Key——AES-256-GCM 加密后持久化到 quillforge-secrets.json
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

/// 获取掩码 API Key——仅返回 sk-****xxxx 格式的掩码，不暴露完整 Key
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

/// 检测是否已配置指定提供商的 API Key
#[tauri::command]
pub fn has_api_key(
    state: State<'_, AppState>,
    provider: String,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let api_key = get_api_key_internal(&state, &provider, &app_handle)?;
    Ok(api_key.is_some())
}

/// 删除指定提供商的 API Key
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
