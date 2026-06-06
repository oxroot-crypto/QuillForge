<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.genChapterHint') }}</p>
    </div>

    <!-- No chapter selected warning -->
    <div v-if="!hasActiveChapter" class="no-chapter-warning">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ $t('ai.genChapterNoChapter') }}</span>
    </div>

    <textarea
      v-model="userPrompt"
      class="gen-input"
      :placeholder="$t('ai.genChapterPlaceholder')"
      rows="3"
    />

    <div class="gen-options">
      <label class="option-label">{{ $t('ai.genChapterLength') }}</label>
      <select v-model="lengthOption" class="style-select">
        <option value="short">{{ $t('ai.genLengthShort') }}</option>
        <option value="medium">{{ $t('ai.genLengthMedium') }}</option>
        <option value="long">{{ $t('ai.genLengthLong') }}</option>
      </select>
    </div>

    <button
      class="btn-action"
      :disabled="editorStore.isLoading || !hasActiveChapter"
      @click="doGenerate"
    >
      <LoadingDots v-if="editorStore.isLoading" />
      <template v-else>&#9889; {{ $t('ai.genChapterBtn') }}</template>
    </button>

    <!-- Cancel button -->
    <button
      v-if="editorStore.isLoading"
      class="btn-cancel"
      @click="onCancel"
    >
      {{ $t('common.cancel') }}
    </button>

    <div v-if="editorStore.isLoading" class="gen-loading">
      <div class="gen-loading-icon">&#9889;</div>
      <div class="gen-loading-label">{{ $t('ai.genChapterLoading') }}</div>
    </div>

    <div v-if="editorStore.activeError" class="result-error">{{ editorStore.activeError }}</div>

    <!-- Auto-applied result -->
    <div v-if="autoApplied" class="applied-box">
      <div class="applied-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{{ $t('ai.genChapterApplied', { title: appliedTitle }) }}</span>
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
import { ref, computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/ai'
import { saveSnapshot } from '@/commands/history'
import { focusEditor } from '@/extensions/ghost-text'
import LoadingDots from '@/components/common/LoadingDots.vue'
import { countWords } from '@/utils/content'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()

const userPrompt = ref('')
const lengthOption = ref('medium')

// Result state (auto-applied)
const autoApplied = ref(false)
const appliedTitle = ref('')
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

function buildContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  const parts: string[] = []
  if (book.worldSetting) parts.push(`【世界观】${book.worldSetting}`)
  if (book.storySetting) parts.push(`【剧情总结】${book.storySetting}`)
  const outlineCtx = bookStore.buildOutlineContext()
  if (outlineCtx) parts.push(outlineCtx)
  if (book.characters.length > 0) {
    const chars = book.characters
      .filter((c) => c.name)
      .map((c) => `【${c.role}】${c.name}：${c.description}`)
      .join('\n')
    if (chars) parts.push(`【角色】\n${chars}`)
  }
  if (book.chapters.length > 0) {
    const titles = book.chapters.map((c, i) =>
      `${i + 1}. ${c.title}（${countWords(c.content)}字）`
    ).join('\n')
    parts.push(`【已有章节】\n${titles}`)
    // Include last chapter content for continuity
    const lastChapter = book.chapters[book.chapters.length - 1]
    if (lastChapter) {
      const lastText = lastChapter.content.replace(/<[^>]*>/g, '').slice(-1000)
      parts.push(`【上一章末尾】${lastText}`)
    }
  }
  return parts.join('\n\n')
}

function getLengthHint(): string {
  switch (lengthOption.value) {
    case 'short': return '篇幅约300-500字，紧凑简洁。'
    case 'long': return '篇幅约1500-2500字，详细展开。'
    default: return '篇幅约800-1200字，适中。'
  }
}

async function doGenerate() {
  const book = bookStore.activeBook
  const chapterId = bookStore.activeChapterId
  if (!book || !chapterId) return

  const chapter = book.chapters.find((c) => c.id === chapterId)
  if (!chapter) return

  editorStore.setLoading(true)
  editorStore.setAiResult('', 'gen_chapter')
  editorStore.setError('', 'gen_chapter')
  editorStore.resetCancel('gen_chapter')
  autoApplied.value = false
  appliedTitle.value = ''
  appliedWords.value = 0
  rawContent.value = ''

  try {
    const ctx = buildContext()
    const userHint = userPrompt.value.trim()
      ? `\n\n用户特别要求：${userPrompt.value.trim()}`
      : ''
    const prompt = `${getLengthHint()}${userHint}\n\n请根据上述设定续写当前章节。`

    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'gen_chapter',
      content: prompt,
      context: ctx || undefined,
    })

    if (editorStore.isCancelled('gen_chapter')) {
      editorStore.resetCancel('gen_chapter')
      return
    }

    const raw = result.trim()
    const lines = raw.split('\n')
    let title = ''
    let body = raw
    const titleMatch = lines[0].match(/^#\s+(.+)/)
    if (titleMatch) {
      title = titleMatch[1].trim()
      let bodyStart = 1
      while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++
      body = lines.slice(bodyStart).join('\n').trim()
    }
    if (!title) title = chapter.title || `${book.chapters.length}`

    const htmlBody = body
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    const wc = countWords(htmlBody)
    appliedTitle.value = title
    appliedWords.value = wc
    rawContent.value = htmlBody

    // Auto-save snapshot of current content before replacing
    if (chapter.content) {
      await saveSnapshot(book.id, chapter.id, chapter.content, 'AI 生成前自动保存', chapter.title)
    }

    // Auto-apply
    bookStore.renameChapter(book.id, chapter.id, title)
    bookStore.updateChapterContent(book.id, chapter.id, htmlBody)
    bookStore.selectChapter(book.id, chapter.id)
    editorStore.updateContent(htmlBody)
    autoApplied.value = true
  } catch (e: unknown) {
    if (!editorStore.isCancelled('gen_chapter')) {
      editorStore.setError(String(e), 'gen_chapter')
    }
  } finally {
    editorStore.setLoading(false)
    editorStore.resetCancel('gen_chapter')
    focusEditor()
  }
}

function onCancel() {
  editorStore.cancelAction('gen_chapter')
  editorStore.setLoading(false)
  focusEditor()
}

async function onRegenerate() {
  const book = bookStore.activeBook
  const chapterId = bookStore.activeChapterId
  if (!book || !chapterId) return

  editorStore.setLoading(true)
  editorStore.setAiResult('', 'gen_chapter')
  editorStore.setError('', 'gen_chapter')
  editorStore.resetCancel('gen_chapter')
  autoApplied.value = false
  appliedTitle.value = ''
  appliedWords.value = 0
  rawContent.value = ''

  try {
    const ctx = buildContext()
    const userHint = userPrompt.value.trim()
      ? `\n\n用户特别要求：${userPrompt.value.trim()}`
      : ''
    const prompt = `${getLengthHint()}${userHint}\n\n请根据上述设定重新生成当前章节内容，与之前生成的不同。`

    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'gen_chapter',
      content: prompt,
      context: ctx || undefined,
    })

    if (editorStore.isCancelled('gen_chapter')) {
      editorStore.resetCancel('gen_chapter')
      return
    }

    const raw = result.trim()
    const lines = raw.split('\n')
    let title = ''
    let body = raw
    const titleMatch = lines[0].match(/^#\s+(.+)/)
    if (titleMatch) {
      title = titleMatch[1].trim()
      let bodyStart = 1
      while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++
      body = lines.slice(bodyStart).join('\n').trim()
    }
    if (!title) title = book.chapters.find((c) => c.id === chapterId)?.title || `${book.chapters.length}`

    const htmlBody = body
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    const wc = countWords(htmlBody)
    appliedTitle.value = title
    appliedWords.value = wc
    rawContent.value = htmlBody

    // Auto-save snapshot of current content before replacing
    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (chapter?.content) {
      await saveSnapshot(book.id, chapterId, chapter.content, 'AI 重新生成前自动保存', chapter.title)
    }

    // Auto-apply
    bookStore.renameChapter(book.id, chapterId, title)
    bookStore.updateChapterContent(book.id, chapterId, htmlBody)
    bookStore.selectChapter(book.id, chapterId)
    editorStore.updateContent(htmlBody)
    autoApplied.value = true
  } catch (e: unknown) {
    if (!editorStore.isCancelled('gen_chapter')) {
      editorStore.setError(String(e), 'gen_chapter')
    }
  } finally {
    editorStore.setLoading(false)
    editorStore.resetCancel('gen_chapter')
    focusEditor()
  }
}

// Watch for action execution from keyboard shortcut
watch(() => editorStore.activeAction, (action) => {
  if (action === 'gen_chapter' && userPrompt.value.trim() && hasActiveChapter.value) {
    doGenerate()
  }
})
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

.gen-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.style-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.84rem;
  outline: none;
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%238888a8' d='M2.5 3.5l2.5 3 2.5-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.style-select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.no-chapter-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid var(--color-warning-border);
}

.btn-action {
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: var(--color-text-on-accent);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
}

.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.5);
}

.btn-action:active:not(:disabled) {
  transform: translateY(0);
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
.gen-loading-label { font-size: 0.78rem; color: #d97706; font-weight: 600; }

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
}

.btn-retry {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* ── Auto-applied result ── */
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
