export interface ToolParam {
  type: 'string' | 'number' | 'boolean'
  description: string
  required?: boolean
  enum?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParam>
}

export interface AgentTool extends ToolDefinition {
  execute: (args: Record<string, any>) => Promise<string>
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCall?: {
    name: string
    args: Record<string, any>
    result?: string
  }
}

export interface AgentContext {
  bookTitle: string
  bookDescription: string
  chapterTitle: string
  chapterCount: number
  charCount: number
  wordCount: number
  worldSetting: string
  storySetting: string
  outline: string
  characters: { name: string; role: string; description: string }[]
}
