// 编辑器状态 Store——文档内容、选区文本、AI 操作加载/取消/结果、action handler 注册。
// 光标位置实时追踪供续写功能使用，wordCount 为计算属性。
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AiAction } from '@/types'
import { countWords } from '@/utils/content'

export const useEditorStore = defineStore('editor', () => {
  // ===== 核心状态 =====
  const content = ref('')
  const selectedText = ref('')
  /** ProseMirror 文档位置（from），供续写等 AI 功能实时读取光标位置 */
  const cursorPosition = ref(0)
  const activeAction = ref<AiAction>('review')
  const aiResults = ref<Record<string, string>>({})
  const errors = ref<Record<string, string>>({})
  /** 加载计数器——支持并行 action，>0 即表示有 AI 操作进行中 */
  const loadingCount = ref(0)
  /** 取消标记——设为 true 后前端中止对应 AI 操作（请求继续在后台运行） */
  const cancelRequested = ref<Record<string, boolean>>({})

  // ===== 计算属性 =====
  /** 当前编辑器内容的总字数（通过 countWords 排除 HTML 标签和空白） */
  const wordCount = computed(() => {
    return countWords(content.value)
  })
  /** 是否有选中文本 */
  const hasSelection = computed(() => selectedText.value.length > 0)
  /** 编辑器是否有非空内容 */
  const hasContent = computed(() => {
    const text = content.value.replace(/<[^>]*>/g, '').trim()
    return text.length > 0
  })
  /** 当前活跃 action 的 AI 结果 */
  const activeResult = computed(() => aiResults.value[activeAction.value] || '')
  /** 当前活跃 action 的错误信息 */
  const activeError = computed(() => errors.value[activeAction.value] || '')
  /** 是否有 AI 操作加载中 */
  const isLoading = computed(() => loadingCount.value > 0)

  // ===== 编辑器状态操作 =====
  /** 更新编辑器全部内容 */
  function updateContent(newContent: string) {
    content.value = newContent
  }

  /** 更新当前选中文本 */
  function updateSelection(text: string) {
    selectedText.value = text
  }

  /** 更新光标在 ProseMirror 文档中的位置 */
  function updateCursorPosition(pos: number) {
    cursorPosition.value = pos
  }

  /** 切换当前活跃的 AI action */
  function setActiveAction(action: AiAction) {
    activeAction.value = action
  }

  // ===== AI 操作状态管理 =====
  /** 设置 AI 操作结果，默认存入当前 activeAction 对应的 key */
  function setAiResult(result: string, action?: AiAction) {
    const key = action || activeAction.value
    aiResults.value[key] = result
  }

  /** 递增/递减加载计数器，负数自动清零防止状态错误 */
  function setLoading(loading: boolean) {
    loadingCount.value += loading ? 1 : -1
    if (loadingCount.value < 0) loadingCount.value = 0
  }

  /** 设置 AI 操作错误信息 */
  function setError(err: string, action?: AiAction) {
    const key = action || activeAction.value
    errors.value[key] = err
  }

  /** 清除指定 action 的结果和错误 */
  function clearResult(action?: AiAction) {
    const key = action || activeAction.value
    aiResults.value[key] = ''
    errors.value[key] = ''
  }

  // ===== 取消机制 =====
  /** 请求取消指定 AI 操作 */
  function cancelAction(action?: AiAction) {
    const key = action || activeAction.value
    cancelRequested.value[key] = true
  }

  /** 检查指定操作是否已请求取消 */
  function isCancelled(action?: AiAction): boolean {
    const key = action || activeAction.value
    return !!cancelRequested.value[key]
  }

  /** 重置取消标记 */
  function resetCancel(action?: AiAction) {
    const key = action || activeAction.value
    cancelRequested.value[key] = false
  }

  // ===== 快捷键执行 =====
  const actionHandlers: Partial<Record<AiAction, () => void>> = {}

  /** 注册 action 的快捷键回调 */
  function registerActionHandler(action: AiAction, handler: () => void) {
    actionHandlers[action] = handler
  }

  /** 移除 action 的快捷键回调 */
  function unregisterActionHandler(action: AiAction) {
    delete actionHandlers[action]
  }

  /** 通过快捷键触发 AI 操作 */
  function executeAction(action: AiAction) {
    setActiveAction(action)
    actionHandlers[action]?.()
  }

  // ===== 导出 =====
  return {
    // 状态
    content,
    selectedText,
    activeAction,
    aiResults,
    errors,
    cursorPosition,
    // 计算属性
    activeResult,
    activeError,
    isLoading,
    wordCount,
    hasSelection,
    hasContent,
    // 编辑器操作
    updateContent,
    updateSelection,
    updateCursorPosition,
    setActiveAction,
    // AI 状态管理
    setAiResult,
    setLoading,
    setError,
    clearResult,
    // 取消机制
    cancelAction,
    isCancelled,
    resetCancel,
    // 快捷键
    registerActionHandler,
    unregisterActionHandler,
    executeAction,
  }
})
