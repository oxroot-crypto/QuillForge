import { invoke } from '@tauri-apps/api/core'

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
