// API Key 命令封装——保存/获取掩码/检测是否存在/删除，Key 经 Rust AES-256-GCM 加密。
import { invoke } from '@tauri-apps/api/core'

/** 加密保存指定提供商的 API Key 到 quillforge-secrets.json */
export async function saveApiKey(
  provider: string,
  apiKey: string,
): Promise<void> {
  return invoke('save_api_key', { provider, apiKey })
}

export async function getApiKeyMasked(provider: string): Promise<string> {
  return invoke('get_api_key_masked', { provider })
}

export async function hasApiKey(provider: string): Promise<boolean> {
  return invoke('has_api_key', { provider })
}

export async function deleteApiKey(provider: string): Promise<void> {
  return invoke('delete_api_key', { provider })
}
