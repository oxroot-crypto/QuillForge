<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.reviewHint') }}</p>
    </div>

    <button
      class="btn-action"
      :disabled="!editorStore.hasSelection || editorStore.isLoading"
      @click="doReview"
    >
      <LoadingDots v-if="editorStore.isLoading" />
      <template v-else>&#128269; {{ $t('ai.reviewBtn') }}</template>
    </button>

    <div v-if="editorStore.selectedText && !editorStore.isLoading" class="selected-preview">
      <div class="preview-label">{{ $t('ai.selected', { count: editorStore.selectedText.length }) }}</div>
      <div class="preview-text">{{ editorStore.selectedText.slice(0, 200) }}{{ editorStore.selectedText.length > 200 ? '...' : '' }}</div>
    </div>

    <div v-if="editorStore.isLoading" class="review-loading">
      <div class="review-loading-icon">&#128269;</div>
      <div class="review-loading-label">{{ $t('ai.reviewLoading') }}</div>
      <div class="review-scan-lines">
        <div class="scan-line" :style="{ animationDelay: '0s' }" />
        <div class="scan-line" :style="{ animationDelay: '0.2s' }" />
        <div class="scan-line" :style="{ animationDelay: '0.4s' }" />
        <div class="scan-line" :style="{ animationDelay: '0.6s' }" />
      </div>
    </div>

    <div v-if="editorStore.error" class="result-error">{{ editorStore.error }}</div>

    <div v-if="editorStore.activeResult && !editorStore.isLoading" class="result-box markdown-body" v-html="renderedResult" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/llm'
import LoadingDots from '@/components/common/LoadingDots.vue'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()

const renderedResult = computed(() => {
  return editorStore.activeResult
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
})

function buildBookContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  return [
    book.worldSetting ? `【世界观】${book.worldSetting}` : '',
    book.storySetting ? `【剧情总结】${book.storySetting}` : '',
    ...book.characters.filter((c) => c.name && c.description).map(
      (c) => `【角色·${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '路人'}】${c.name}：${c.description}`,
    ),
  ].filter(Boolean).join('\n')
}

async function doReview() {
  if (!editorStore.selectedText) return
  editorStore.setLoading(true)
  editorStore.setError('')
  editorStore.setAiResult('')
  try {
    const bookCtx = buildBookContext()
    const result = await sendAiMessage(settingsStore.modelConfig, {
      action: 'review',
      content: editorStore.selectedText,
      context: bookCtx || undefined,
    })
    editorStore.setAiResult(result)
  } catch (e: any) {
    editorStore.setError(e.toString())
  } finally {
    editorStore.setLoading(false)
  }
}
</script>

<style scoped>
.action-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-info p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.btn-action {
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  color: #fff;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px var(--color-accent-light);
}

.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px var(--color-accent-light);
}

.btn-action:active:not(:disabled) {
  transform: translateY(0);
}

.selected-preview {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}

.preview-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin-bottom: 6px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-text {
  font-size: 0.8rem;
  color: var(--color-text);
  line-height: 1.55;
}

.result-error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-danger);
  font-size: 0.8rem;
}

.result-box {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  font-size: 0.84rem;
  line-height: 1.7;
  color: var(--color-text);
}

.review-loading {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.review-loading-icon {
  font-size: 1.8rem;
  animation: review-pulse 1.2s ease-in-out infinite;
}

.review-loading-label {
  font-size: 0.78rem;
  color: var(--color-accent);
  font-weight: 600;
}

.review-scan-lines {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.scan-line {
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  animation: scan-flash 1.4s ease-in-out infinite;
  opacity: 0;
}

@keyframes review-pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
}

@keyframes scan-flash {
  0% { opacity: 0; }
  30% { opacity: 1; }
  70% { opacity: 0; }
  100% { opacity: 0; }
}
</style>
