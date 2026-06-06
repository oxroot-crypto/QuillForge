//! 内部辅助函数——供 commands 模块内复用的工具函数。

use crate::crypto;
use crate::AppState;
use tauri::State;
use tauri_plugin_store::StoreExt;

/// 从加密存储中读取并解密 API Key。
/// 返回 `None` 表示该提供商未配置 Key，`Some(plaintext)` 为解密后的明文。
pub fn get_api_key_internal(
    state: &State<'_, AppState>,
    provider: &str,
    app_handle: &tauri::AppHandle,
) -> Result<Option<String>, String> {
    let store = app_handle
        .store("quillforge-secrets.json")
        .map_err(|e| format!("Store open failed: {e}"))?;

    let encrypted = store.get(format!("apikey_{provider}"));

    match encrypted {
        Some(val) => {
            let encrypted_str = val.as_str().unwrap_or("");
            if encrypted_str.is_empty() {
                return Ok(None);
            }
            let encryption_key = state
                .encryption_key
                .lock()
                .map_err(|e| format!("Lock failed: {e}"))?;
            let key = encryption_key.ok_or("Encryption key not initialized")?;
            let decrypted = crypto::decrypt(encrypted_str, &key)?;
            Ok(Some(decrypted))
        }
        None => Ok(None),
    }
}
