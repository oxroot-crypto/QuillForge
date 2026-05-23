import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AiAction } from '@/types'

export const useEditorStore = defineStore('editor', () => {
  const content = ref('')
  const currentChapterId = ref('')
  const selectedText = ref('')
  const activeAction = ref<AiAction>('review')
  const aiResult = ref('')
  const isLoading = ref(false)
  const error = ref('')
  const wordCount = ref(0)

  const hasSelection = computed(() => selectedText.value.length > 0)
  const hasContent = computed(() => {
    const text = content.value.replace(/<[^>]*>/g, '').trim()
    return text.length > 0
  })

  function updateContent(newContent: string) {
    content.value = newContent
    wordCount.value = newContent.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
  }

  function updateSelection(text: string) {
    selectedText.value = text
  }

  function setActiveAction(action: AiAction) {
    activeAction.value = action
  }

  function setAiResult(result: string) {
    aiResult.value = result
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setError(err: string) {
    error.value = err
  }

  function clearResult() {
    aiResult.value = ''
    error.value = ''
  }

  function insertText(text: string) {
    content.value += text
    wordCount.value = content.value.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
  }

  return {
    content,
    currentChapterId,
    selectedText,
    activeAction,
    aiResult,
    isLoading,
    error,
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
    insertText,
  }
})
