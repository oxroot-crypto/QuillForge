<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.reviewHint') }}</p>
    </div>

    <button
      class="btn-action"
      :disabled="editorStore.isLoading || !bookStore.activeChapterId"
      @click="doReview"
    >
      <LoadingDots v-if="editorStore.isLoading" />
      <template v-else>&#128269; {{ $t('ai.reviewBtn') }}</template>
    </button>

    <!-- Cancel button -->
    <button
      v-if="editorStore.isLoading"
      class="btn-cancel"
      @click="onCancel"
    >
      {{ $t('common.cancel') }}
    </button>

    <div v-if="!editorStore.isLoading" class="selected-preview">
      <div v-if="editorStore.selectedText" class="preview-label">{{ $t('ai.selected', { count: editorStore.selectedText.length }) }}</div>
      <div v-else class="preview-label">{{ $t('ai.reviewFullChapter') }}</div>
      <div v-if="editorStore.selectedText" class="preview-text">{{ editorStore.selectedText.slice(0, 200) }}{{ editorStore.selectedText.length > 200 ? '...' : '' }}</div>
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

    <div v-if="editorStore.activeError" class="result-error">{{ editorStore.activeError }}</div>

    <div v-if="editorStore.activeResult && !editorStore.isLoading" class="result-box markdown-body" v-html="renderedResult" />

    <!-- Apply review suggestions -->
    <div v-if="editorStore.activeResult && !editorStore.isLoading" class="apply-section">
      <button
        class="btn-apply"
        :disabled="applyingReview || !bookStore.activeChapterId"
        @click="doApplyReview"
      >
        <LoadingDots v-if="applyingReview" />
        <template v-else>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {{ $t('ai.reviewApplyBtn') }}
        </template>
      </button>
    </div>

    <!-- Apply result state -->
    <div v-if="applyApplied" class="applied-box">
      <div class="applied-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{{ $t('ai.reviewApplied') }}</span>
        <span class="applied-words">{{ appliedWords }} {{ $t('history.words') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/ai'
import { saveSnapshot } from '@/commands/history'
import LoadingDots from '@/components/common/LoadingDots.vue'
import { focusEditor } from '@/extensions/ghost-text'
import { countWords } from '@/utils/content'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()

const applyingReview = ref(false)
const applyApplied = ref(false)
const appliedWords = ref(0)

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
    bookStore.buildOutlineContext(),
  ].filter(Boolean).join('\n')
}

function getReviewContent(): string {
  if (editorStore.selectedText) return editorStore.selectedText
  // Fallback to full chapter content (strip HTML tags)
  return editorStore.content.replace(/<[^>]*>/g, '')
}

async function doReview() {
  const content = getReviewContent()
  if (!content.trim()) return
  editorStore.setLoading(true)
  editorStore.setAiResult('', 'review')
  editorStore.setError('', 'review')
  editorStore.resetCancel('review')
  try {
    const bookCtx = buildBookContext()
    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'review',
      content,
      context: bookCtx || undefined,
    })
    if (editorStore.isCancelled('review')) return
    editorStore.setAiResult(result, 'review')
  } catch (e: unknown) {
    if (!editorStore.isCancelled('review')) {
      editorStore.setError(String(e), 'review')
    }
  } finally {
    editorStore.setLoading(false)
    editorStore.resetCancel('review')
    focusEditor()
  }
}

function onCancel() {
  editorStore.cancelAction('review')
  editorStore.setLoading(false)
  focusEditor()
}

async function doApplyReview() {
  const book = bookStore.activeBook
  const chapterId = bookStore.activeChapterId
  if (!book || !chapterId) return

  const chapter = book.chapters.find((c) => c.id === chapterId)
  if (!chapter) return

  const originalContent = getReviewContent()
  if (!originalContent.trim()) return
  const reviewResult = editorStore.activeResult
  if (!reviewResult.trim()) return

  applyingReview.value = true
  applyApplied.value = false
  editorStore.setError('', 'review')
  try {
    const bookCtx = buildBookContext()
    const prompt = `${originalContent}\n\n【审阅意见】\n${reviewResult}\n\n请根据以上审阅意见修改文本，直接输出修改后的文本，不要任何前缀说明或格式标记。`

    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'rewrite',
      content: prompt,
      context: bookCtx || undefined,
    })

    const htmlBody = result.trim()
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    const wc = countWords(htmlBody)
    appliedWords.value = wc

    // Auto-save snapshot before replacing
    if (chapter.content) {
      await saveSnapshot(book.id, chapterId, chapter.content, 'AI 审阅修改前自动保存', chapter.title)
    }

    // Auto-apply
    bookStore.updateChapterContent(book.id, chapterId, htmlBody)
    bookStore.selectChapter(book.id, chapterId)
    editorStore.updateContent(htmlBody)
    applyApplied.value = true
  } catch (e: unknown) {
    editorStore.setError(String(e), 'review')
  } finally {
    applyingReview.value = false
    focusEditor()
  }
}

onMounted(() => {
  editorStore.registerActionHandler('review', doReview)
})
onBeforeUnmount(() => {
  editorStore.unregisterActionHandler('review')
})
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
  color: var(--color-text-on-accent);
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

.btn-cancel {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid var(--color-danger);
  background: transparent;
  color: var(--color-danger);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-cancel:hover {
  background: var(--color-danger-bg);
}

@keyframes scan-flash {
  0% { opacity: 0; }
  30% { opacity: 1; }
  70% { opacity: 0; }
  100% { opacity: 0; }
}

/* ── Apply Section ── */
.apply-section {
  display: flex;
  flex-direction: column;
}

.btn-apply {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid var(--color-accent);
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 570;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-apply:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.btn-apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.applied-box {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  font-size: 0.84rem;
  line-height: 1.7;
  color: var(--color-text);
}

.applied-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-success);
}

.applied-words {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--color-success);
  white-space: nowrap;
}
</style>
