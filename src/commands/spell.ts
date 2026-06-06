// 拼写检查命令封装——将文本发送给 Rust 后端，返回错误词列表及纠错建议。
import { invoke } from '@tauri-apps/api/core'

/** 拼写错误项——与 Rust 端 SpellError 结构镜像 */
export interface SpellError {
  start: number
  end: number
  word: string
  suggestions: string[]
}

export async function spellCheckText(text: string): Promise<SpellError[]> {
  return invoke('spell_check_text', { text })
}
