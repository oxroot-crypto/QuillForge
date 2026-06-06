// Agent 系统类型定义——工具参数、Agent 上下文、消息结构。
// 与 Pinia store 桥接的运行时上下文定义在 tools.ts 的 ToolContext 接口中。

/** 工具参数元数据——描述单个参数的类型、是否必填、可选枚举值 */
export interface ToolParam {
  type: 'string' | 'number' | 'boolean'
  description: string
  required?: boolean
  enum?: string[]
}

/** 工具静态定义——不含 execute 函数，用于文档生成 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParam>
}

/**
 * Agent 可调用工具——包含参数元数据和执行函数。
 * execute 的 args 为 AI 解析出的键值对（值均为字符串，由工具内部做类型转换）。
 */
export interface AgentTool extends ToolDefinition {
  execute: (args: Record<string, string>) => Promise<string>
}

/** Agent 会话中的一条消息——用户输入、AI 响应、工具调用/结果 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCall?: {
    name: string
    args: Record<string, string>
    result?: string
  }
}

/** Agent CLI 界面中的一条消息——用户输入、AI 回复、工具调用/结果、错误 */
export interface CliMessage {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error' | 'raw'
  content: string
  toolCall?: { name: string; args: Record<string, string> }
  status?: 'running' | 'done'
}

/** Agent 请求上下文——携带当前书籍元信息注入到 system prompt */
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
