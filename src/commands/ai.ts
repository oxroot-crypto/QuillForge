import { invoke } from '@tauri-apps/api/core'
import type { AiRequest, ModelConfig } from '@/types'

export async function sendAiMessage(
  config: ModelConfig,
  request: AiRequest,
): Promise<string> {
  return invoke('send_ai_message', { config, request })
}

export async function checkProviderConnection(
  config: ModelConfig,
): Promise<string> {
  return invoke('check_provider_connection', { config })
}
