<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.rewriteHint') }}</p>
    </div>

    <!-- No chapter warning -->
    <div v-if="!hasActiveChapter" class="no-chapter-warning">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ $t('ai.genChapterNoChapter') }}</span>
    </div>

    <textarea
      v-model="userPrompt"
      class="gen-input"
      :placeholder="$t('ai.rewritePlaceholder')"
      rows="3"
    />

    <div v-if="!editorStore.isLoading" class="selected-preview">
      <div v-if="editorStore.selectedText" class="preview-label">{{ $t('ai.selected', { count: editorStore.selectedText.length }) }}</div>
      <div v-else class="preview-label">{{ $t('ai.reviewFullChapter') }}</div>
      <div v-if="editorStore.selectedText" class="preview-text">{{ editorStore.selectedText.slice(0, 200) }}{{ editorStore.selectedText.length > 200 ? '...' : '' }}</div>
    </div>

    <button
      class="btn-action"
      :disabled="editorStore.isLoading || !hasActiveChapter"
      @click="doRewrite"
    >
      <LoadingDots v-if="editorStore.isLoading" />
      <template v-else>&#128393; {{ $t('ai.rewriteBtn') }}</template>
    </button>

    <button
      v-if="editorStore.isLoading"
      class="btn-cancel"
      @click="onCancel"
    >
      {{ $t('common.cancel') }}
    </button>

    <div v-if="editorStore.isLoading" class="gen-loading">
      <div class="gen-loading-icon">&#128393;</div>
      <div class="gen-loading-label">{{ $t('ai.rewriteLoading') }}</div>
    </div>

    <div v-if="editorStore.activeError" class="result-error">{{ editorStore.activeError }}</div>

    <!-- Auto-applied result -->
    <div v-if="autoApplied" class="applied-box">
      <div class="applied-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{{ $t('ai.rewriteApplied') }}</span>
        <span class="applied-words">{{ appliedWords }} {{ $t('history.words') }}</span>
      </div>
      <div class="markdown-body" v-html="renderedContent" />
      <div class="gen-result-actions">
        <button class="btn-retry" @click="onRegenerate">
          &#128260; {{ $t('ai.regenerate') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/ai'
import { saveSnapshot } from '@/commands/history'
import { focusEditor } from '@/extensions/ghost-text'
import LoadingDots from '@/components/common/LoadingDots.vue'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()

const userPrompt = ref('')

// Result state (auto-applied)
const autoApplied = ref(false)
const appliedWords = ref(0)
const rawContent = ref('')

const hasActiveChapter = computed(() => {
  const book = bookStore.activeBook
  if (!book) return false
  return !!bookStore.activeChapterId && book.chapters.some((c) => c.id === bookStore.activeChapterId)
})

const renderedContent = computed(() => {
  return rawContent.value
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
})

function buildBookContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  return [
    book.worldSetting ? `【世界观】${book.worldSetting}` : '',
    book.storySetting ? `【剧情总结】${book.storySetting}` : '',
    ...book.characters.filter((c) => c.name && c.description).map(
      (c) => `【角色】${c.name}(${c.role})：${c.description}`,
    ),
    bookStore.buildOutlineContext(),
  ].filter(Boolean).join('\n')
}

function getRewriteContent(): string {
  if (editorStore.selectedText) return editorStore.selectedText
  return editorStore.content.replace(/<[^>]*>/g, '')
}

function countWords(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
}

async function doRewrite() {
  const book = bookStore.activeBook
  const chapterId = bookStore.activeChapterId
  if (!book || !chapterId) return

  const chapter = book.chapters.find((c) => c.id === chapterId)
  if (!chapter) return

  const content = getRewriteContent()
  if (!content.trim()) return

  editorStore.setLoading(true)
  editorStore.setAiResult('', 'rewrite')
  editorStore.setError('', 'rewrite')
  editorStore.resetCancel('rewrite')
  autoApplied.value = false
  appliedWords.value = 0
  rawContent.value = ''

  try {
    const bookCtx = buildBookContext()
    const userHint = userPrompt.value.trim()
      ? `\n\n改写要求：${userPrompt.value.trim()}`
      : ''
    const prompt = `${content}\n\n${userHint}`

    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'rewrite',
      content: prompt,
      context: bookCtx || undefined,
    })

    if (editorStore.isCancelled('rewrite')) {
      editorStore.resetCancel('rewrite')
      return
    }

    const htmlBody = result.trim()
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    const wc = countWords(htmlBody)
    appliedWords.value = wc
    rawContent.value = htmlBody

    // Auto-save snapshot of current content before replacing
    if (chapter.content) {
      await saveSnapshot(book.id, chapter.id, chapter.content, 'AI 改写前自动保存', chapter.title)
    }

    // Auto-apply
    bookStore.updateChapterContent(book.id, chapter.id, htmlBody)
    bookStore.selectChapter(book.id, chapter.id)
    editorStore.updateContent(htmlBody)
    autoApplied.value = true
  } catch (e: unknown) {
    if (!editorStore.isCancelled('rewrite')) {
      editorStore.setError(String(e), 'rewrite')
    }
  } finally {
    editorStore.setLoading(false)
    editorStore.resetCancel('rewrite')
    focusEditor()
  }
}

function onCancel() {
  editorStore.cancelAction('rewrite')
  editorStore.setLoading(false)
  focusEditor()
}

async function onRegenerate() {
  const book = bookStore.activeBook
  const chapterId = bookStore.activeChapterId
  if (!book || !chapterId) return

  editorStore.setLoading(true)
  editorStore.setAiResult('', 'rewrite')
  editorStore.setError('', 'rewrite')
  editorStore.resetCancel('rewrite')
  autoApplied.value = false
  appliedWords.value = 0
  rawContent.value = ''

  try {
    const content = getRewriteContent()
    if (!content.trim()) return

    const bookCtx = buildBookContext()
    const userHint = userPrompt.value.trim()
      ? `\n\n改写要求：${userPrompt.value.trim()}`
      : ''
    const prompt = `${content}\n\n${userHint}\n\n请用不同的风格重新改写一遍，与上次不同。`

    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'rewrite',
      content: prompt,
      context: bookCtx || undefined,
    })

    if (editorStore.isCancelled('rewrite')) {
      editorStore.resetCancel('rewrite')
      return
    }

    const htmlBody = result.trim()
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (chapter?.content) {
      await saveSnapshot(book.id, chapterId, chapter.content, 'AI 改写重新生成前自动保存', chapter.title)
    }

    const wc = countWords(htmlBody)
    appliedWords.value = wc
    rawContent.value = htmlBody

    bookStore.updateChapterContent(book.id, chapterId, htmlBody)
    bookStore.selectChapter(book.id, chapterId)
    editorStore.updateContent(htmlBody)
    autoApplied.value = true
  } catch (e: unknown) {
    if (!editorStore.isCancelled('rewrite')) {
      editorStore.setError(String(e), 'rewrite')
    }
  } finally {
    editorStore.setLoading(false)
    editorStore.resetCancel('rewrite')
    focusEditor()
  }
}
</script>

<style scoped>
.action-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-info p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.no-chapter-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: #fef3c7;
  color: #92400e;
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid #fbbf24;
}

.gen-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.84rem;
  line-height: 1.55;
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.gen-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.gen-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.55;
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

.btn-action {
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}
.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
}
.btn-action:active:not(:disabled) { transform: translateY(0); }

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
.btn-cancel:hover { background: var(--color-danger-bg); }

.result-error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-danger);
  font-size: 0.8rem;
}

.gen-loading {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.gen-loading-icon { font-size: 1.8rem; animation: pulse 1.2s ease-in-out infinite; }
.gen-loading-label { font-size: 0.78rem; color: #6366f1; font-weight: 600; }

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
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
  margin-bottom: 10px;
  padding: 8px 12px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  color: #065f46;
}

.applied-words {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 500;
  color: #047857;
  white-space: nowrap;
}

.gen-result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
  justify-content: center;
}

.btn-retry {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}
.btn-retry:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
