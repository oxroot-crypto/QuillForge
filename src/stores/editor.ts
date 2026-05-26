import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AiAction } from '@/types'

export const useEditorStore = defineStore('editor', () => {
  const content = ref('')
  const selectedText = ref('')
  const activeAction = ref<AiAction>('review')
  const aiResults = ref<Record<string, string>>({})
  const errors = ref<Record<string, string>>({})
  // Loading counter: supports parallel actions
  const loadingCount = ref(0)
  // Cancel flag: set to true to abort current AI request (frontend-side, request continues in background)
  const cancelRequested = ref<Record<string, boolean>>({})

  const wordCount = computed(() => {
    return content.value.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
  })
  const hasSelection = computed(() => selectedText.value.length > 0)
  const hasContent = computed(() => {
    const text = content.value.replace(/<[^>]*>/g, '').trim()
    return text.length > 0
  })

  function updateContent(newContent: string) {
    content.value = newContent
  }

  function updateSelection(text: string) {
    selectedText.value = text
  }

  function setActiveAction(action: AiAction) {
    activeAction.value = action
  }

  // ---- Per-action state ----

  const activeResult = computed(() => aiResults.value[activeAction.value] || '')
  const activeError = computed(() => errors.value[activeAction.value] || '')
  const isLoading = computed(() => loadingCount.value > 0)

  function setAiResult(result: string, action?: AiAction) {
    const key = action || activeAction.value
    aiResults.value[key] = result
  }

  function setLoading(loading: boolean) {
    loadingCount.value += loading ? 1 : -1
    if (loadingCount.value < 0) loadingCount.value = 0
  }

  function setError(err: string, action?: AiAction) {
    const key = action || activeAction.value
    errors.value[key] = err
  }

  function clearResult(action?: AiAction) {
    const key = action || activeAction.value
    aiResults.value[key] = ''
    errors.value[key] = ''
  }

  function cancelAction(action?: AiAction) {
    const key = action || activeAction.value
    cancelRequested.value[key] = true
  }

  function isCancelled(action?: AiAction): boolean {
    const key = action || activeAction.value
    return !!cancelRequested.value[key]
  }

  function resetCancel(action?: AiAction) {
    const key = action || activeAction.value
    cancelRequested.value[key] = false
  }

  // ---- Action execution (for keyboard shortcuts) ----
  const actionHandlers: Partial<Record<AiAction, () => void>> = {}

  function registerActionHandler(action: AiAction, handler: () => void) {
    actionHandlers[action] = handler
  }

  function unregisterActionHandler(action: AiAction) {
    delete actionHandlers[action]
  }

  function executeAction(action: AiAction) {
    setActiveAction(action)
    actionHandlers[action]?.()
  }

  return {
    content,
    selectedText,
    activeAction,
    aiResults,
    activeResult,
    errors,
    activeError,
    isLoading,
    wordCount,
    hasSelection,
    hasContent,
    updateContent,
    updateSelection,
    setActiveAction,
    setAiResult,
    setLoading,
    setError,
    clearResult,
    cancelAction,
    isCancelled,
    resetCancel,
    registerActionHandler,
    unregisterActionHandler,
    executeAction,
  }
})
