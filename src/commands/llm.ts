import { invoke } from '@tauri-apps/api/core'
import type { AiRequest, ModelConfig, ProviderInfo } from '@/types'

export async function sendAiMessage(
  config: ModelConfig,
  request: AiRequest,
): Promise<string> {
  return invoke('send_ai_message', { config, request })
}

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

export async function getSupportedProviders(): Promise<ProviderInfo[]> {
  return invoke('get_supported_providers')
}

export async function checkProviderConnection(
  config: ModelConfig,
): Promise<string> {
  return invoke('check_provider_connection', { config })
}

// ── Project persistence ──

export async function saveAllBooks(data: string): Promise<void> {
  return invoke('save_all_books', { data })
}

export async function loadAllBooks(): Promise<string> {
  return invoke('load_all_books')
}

export async function deleteBookDir(bookId: string): Promise<void> {
  return invoke('delete_book_dir', { bookId })
}

export async function exportBookMarkdown(
  bookTitle: string,
  chaptersJson: string,
): Promise<string> {
  return invoke('export_book_markdown', { bookTitle, chaptersJson })
}
