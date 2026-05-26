import { invoke } from '@tauri-apps/api/core'
import type { AiRequest, ModelConfig, GeneratedBookInfo } from '@/types'
import { useTemplateStore } from '@/stores/templates'

export async function sendAiMessage(
  config: ModelConfig,
  request: AiRequest,
): Promise<string> {
  // Prepend template system prompt as user instruction (not system prompt override)
  // so the built-in action-specific system prompt is preserved for output format
  const templateStore = useTemplateStore()
  let content = request.content
  if (templateStore.activeTemplate?.systemPrompt) {
    content = `【额外要求】${templateStore.activeTemplate.systemPrompt}\n\n---\n\n${content}`
  }
  return invoke('send_ai_message', { config, request: { ...request, content } })
}

export async function checkProviderConnection(
  config: ModelConfig,
): Promise<string> {
  return invoke('check_provider_connection', { config })
}

export async function generateBookInfo(
  prompt: string,
  config: ModelConfig,
): Promise<GeneratedBookInfo> {
  return invoke('generate_book_info', { prompt, config })
}
