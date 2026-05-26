import { invoke } from '@tauri-apps/api/core'

export interface SpellError {
  start: number
  end: number
  word: string
  suggestions: string[]
}

export async function spellCheckText(text: string): Promise<SpellError[]> {
  return invoke('spell_check_text', { text })
}
