// AI 命令封装——sendAiMessage（核心 AI 操作）、checkProviderConnection（连通检测）、
// generateBookInfo（AI 一键生成书籍信息）。模板提示词在此拼接为【额外要求】注入。
import { invoke } from '@tauri-apps/api/core'
import type { AiRequest, ModelConfig, GeneratedBookInfo } from '@/types'
import { useTemplateStore } from '@/stores/templates'

/**
 * 发送 AI 消息——前端核心入口，所有 action（审阅/续写/脑暴等）均走此函数。
 * 自动从 templateStore 选取当前 action 的活跃模板，将其 systemPrompt 作为【额外要求】拼接。
 */
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
  charCount?: number,
): Promise<GeneratedBookInfo> {
  return invoke('generate_book_info', { prompt, config, charCount })
}
