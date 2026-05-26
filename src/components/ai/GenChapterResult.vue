<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.genChapterHint') }}</p>
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
      :disabled="editorStore.isLoading"
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

    <div v-if="generatedContent && !editorStore.isLoading" class="result-box">
      <div class="gen-result-header">
        <span class="gen-result-title">{{ generatedTitle }}</span>
        <span class="gen-result-words">{{ wordCount }} {{ $t('history.words') }}</span>
      </div>
      <div class="markdown-body" v-html="renderedContent" />
      <div class="gen-result-actions">
        <button class="btn-apply" :disabled="applied" @click="onApply">
          {{ applied ? '&#10003; ' + $t('ai.applied') : '&#128190; ' + $t('ai.applyToEditor') }}
        </button>
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
import { focusEditor } from '@/extensions/ghost-text'
import { replaceSelection } from '@/extensions/ghost-text'
import LoadingDots from '@/components/common/LoadingDots.vue'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()

const userPrompt = ref('')
const lengthOption = ref('medium')
const generatedTitle = ref('')
const generatedContent = ref('')
const applied = ref(false)
const appliedChapterId = ref<string | null>(null)

const wordCount = computed(() => {
  return generatedContent.value.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
})

const renderedContent = computed(() => {
  return generatedContent.value
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
})

function buildContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  const parts: string[] = []
  if (book.worldSetting) parts.push(`【世界观】${book.worldSetting}`)
  if (book.storySetting) parts.push(`【剧情总结】${book.storySetting}`)
  if (book.characters.length > 0) {
    const chars = book.characters
      .filter((c) => c.name)
      .map((c) => `【${c.role}】${c.name}：${c.description}`)
      .join('\n')
    if (chars) parts.push(`【角色】\n${chars}`)
  }
  if (book.chapters.length > 0) {
    const titles = book.chapters.map((c, i) =>
      `${i + 1}. ${c.title}（${c.content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length}字）`
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
  if (!book) return

  editorStore.setLoading(true)
  editorStore.setAiResult('', 'gen_chapter')
  editorStore.setError('', 'gen_chapter')
  editorStore.resetCancel('gen_chapter')
  generatedTitle.value = ''
  generatedContent.value = ''
  applied.value = false
  appliedChapterId.value = null

  try {
    const ctx = buildContext()
    const userHint = userPrompt.value.trim()
      ? `\n\n用户特别要求：${userPrompt.value.trim()}`
      : ''
    const prompt = `${getLengthHint()}${userHint}\n\n请根据上述设定${book.chapters.length === 0 ? '生成小说的第一章' : '续写下一章'}。`

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
    if (!title) title = `${book.chapters.length + 1}`

    const htmlBody = body
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    generatedTitle.value = title
    generatedContent.value = htmlBody
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

function onApply() {
  if (!generatedContent.value || applied.value) return
  applied.value = true
  const book = bookStore.activeBook
  if (!book) return

  if (appliedChapterId.value) {
    const chapter = book.chapters.find((c) => c.id === appliedChapterId.value)
    if (chapter) {
      bookStore.renameChapter(book.id, chapter.id, generatedTitle.value)
      bookStore.updateChapterContent(book.id, chapter.id, generatedContent.value)
      bookStore.selectChapter(book.id, chapter.id)
      editorStore.updateContent(generatedContent.value)
      return
    }
  }

  const chapter = bookStore.createChapter(generatedTitle.value)
  if (chapter) {
    appliedChapterId.value = chapter.id
    bookStore.updateChapterContent(book.id, chapter.id, generatedContent.value)
    bookStore.selectChapter(book.id, chapter.id)
    editorStore.updateContent(generatedContent.value)
  }
}

async function onRegenerate() {
  const book = bookStore.activeBook
  if (!book) return

  editorStore.setLoading(true)
  editorStore.setAiResult('', 'gen_chapter')
  editorStore.setError('', 'gen_chapter')
  editorStore.resetCancel('gen_chapter')
  generatedTitle.value = ''
  generatedContent.value = ''
  applied.value = false

  try {
    const ctx = buildContext()
    const userHint = userPrompt.value.trim()
      ? `\n\n用户特别要求：${userPrompt.value.trim()}`
      : ''
    const prompt = `${getLengthHint()}${userHint}\n\n请根据上述设定重新生成章节内容，与之前生成的不同。${book.chapters.length === 0 ? '这是小说的第一章。' : ''}`

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
    if (!title) title = `${book.chapters.length + 1}`

    const htmlBody = body
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    generatedTitle.value = title
    generatedContent.value = htmlBody
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
  if (action === 'gen_chapter' && userPrompt.value.trim()) {
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

.btn-action {
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
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

.result-box {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  font-size: 0.84rem;
  line-height: 1.7;
  color: var(--color-text);
}

.gen-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.gen-result-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
}

.gen-result-words {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.gen-result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}

.btn-apply {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: opacity var(--transition-fast);
}
.btn-apply:hover:not(:disabled) { opacity: 0.9; }
.btn-apply:disabled { opacity: 0.5; cursor: default; }

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
</style>
