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

export type ChapterStatus = 'draft' | 'revising' | 'completed' | 'frozen'

export interface DailyStats {
  date: string
  wordsWritten: number
  writingSeconds: number
}

export interface Snapshot {
  timestamp: string
  label: string
  word_count: number
  title: string
  content: string
}

export interface Chapter {
  id: string
  title: string
  content: string
  status: ChapterStatus
  createdAt: string
  updatedAt: string
  snapshots: Snapshot[]
  outlineItemId?: string
}

export interface Character {
  id: string
  name: string
  role: string
  description: string
  notes: string
}

export interface OutlineItem {
  id: string
  title: string
  description: string
  order: number
  chapterId?: string
}

export interface Book {
  id: string
  title: string
  description: string
  worldSetting: string
  storySetting: string
  outline: OutlineItem[]
  characters: Character[]
  chapters: Chapter[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  name: string
  chapters: Chapter[]
}

export interface GeneratedCharacter {
  name: string
  role: string
  description: string
}

export interface GeneratedBookInfo {
  title: string
  description: string
  world_setting: string
  story_setting: string
  characters: GeneratedCharacter[]
}

export type AiAction = 'review' | 'idea' | 'continue' | 'consistency' | 'gen_chapter' | 'rewrite'

export interface AiActionConfig {
  action: AiAction
  label: string
  description: string
  needsContext: boolean
  icon: string
}

/** 模态对话框交互——resolve 回调，用于 prompt / confirm / alert 三种模式 */
export interface ModalAction {
  resolve: (value: string | boolean) => void
}

/** 提示词模板编辑态——tags 由数组展开为逗号分隔字符串方便编辑 */
export interface EditingTemplate {
  id: string
  name: string
  description: string
  action: string
  systemPrompt: string
  tagsStr: string
}

/** AI 一致性检查发现的问题——角色名、问题类型、严重程度、描述 */
export interface ConsistencyIssue {
  character: string
  type: string
  severity: string
  desc: string
}

/** 提示词模板——关联特定 AI action，提供 system/user 提示词覆盖 */
export interface PromptTemplate {
  id: string
  name: string
  description: string
  action: string
  systemPrompt: string
  userPrompt?: string
  tags: string[]
  locale: string
  builtIn: boolean
}

/** 主题偏好——亮色/暗色两种模式，持久化到 localStorage */
export type Theme = 'dark' | 'light'

/** 界面语言——中文/英文两种，默认 zh-CN */
export type Locale = 'zh-CN' | 'en-US'

