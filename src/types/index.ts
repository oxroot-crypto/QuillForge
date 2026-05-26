export interface Message {
  role: string
  content: string
}

export interface ModelConfig {
  provider: string
  model: string
  api_base: string
  temperature: number
  max_tokens: number
  system_prompt: string
}

export interface ProviderSavedConfig {
  model: string
  api_base: string
}

export interface ModelPreset {
  id: string
  name: string
  config: ModelConfig
  providerConfigs: Record<string, ProviderSavedConfig>
}

export interface ProviderInfo {
  id: string
  name: string
  models: string[]
  default_api_base: string
  requires_api_key: boolean
}

export interface AiRequest {
  action: string
  content: string
  context?: string
}

export interface Snapshot {
  timestamp: string
  label: string
  word_count: number
  content: string
}

export interface Chapter {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  snapshots: Snapshot[]
}

export interface Character {
  id: string
  name: string
  role: string
  description: string
  notes: string
}

export interface Book {
  id: string
  title: string
  description: string
  worldSetting: string
  storySetting: string
  characters: Character[]
  chapters: Chapter[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  name: string
  chapters: Chapter[]
}

export type AiAction = 'review' | 'idea' | 'continue' | 'consistency' | 'gen_chapter'

export interface AiActionConfig {
  action: AiAction
  label: string
  description: string
  needsContext: boolean
  icon: string
}

