<template>
  <div class="sidebar">
    <!-- Books list -->
    <div class="sidebar-section book-section">
      <div class="section-header">
        <h3>{{ $t('book.books') }}</h3>
        <button class="btn-icon" :title="$t('book.newBookPrompt')" @click="onCreateBook">+</button>
      </div>
    </div>

    <div class="book-list">
      <div
        v-for="book in bookStore.books"
        :key="book.id"
        class="book-item"
        :class="{ active: book.id === bookStore.activeBookId }"
        @click="selectBook(book.id)"
      >
        <div class="book-item-main">
          <span class="book-item-title">{{ book.title }}</span>
          <span class="book-item-meta">{{ book.chapters.length }}{{ $t('book.chUnit') }} · {{ bookStats(book.id) }}{{ $t('book.wordUnit') }}</span>
        </div>
        <div class="book-item-actions">
          <button class="btn-action-mini" :title="$t('book.rename')" @click.stop="startRename(book)">&#9998;</button>
          <button class="btn-action-mini btn-action-danger" :title="$t('book.deleteBook')" @click.stop="onDeleteBook(book)">&times;</button>
        </div>
      </div>

      <div v-if="bookStore.books.length === 0" class="sidebar-empty">
        <p>{{ $t('book.noBook') }}</p>
      </div>
    </div>

    <!-- Active Book: rename inputs -->
    <div v-if="editingBook && editingBook.id === bookStore.activeBookId" class="sidebar-section book-rename-section">
      <input
        ref="renameInput"
        v-model="editTitle"
        class="book-rename-input"
        @keydown.enter="onRenameBook"
        @blur="onRenameBook"
      />
    </div>

    <!-- Active Book: Settings & Characters panel -->
    <template v-if="bookStore.activeBook">
      <div class="sidebar-section book-info">
        <div class="info-buttons">
          <button
            class="info-btn"
            :class="{ active: showSettings }"
            @click="showSettings = !showSettings; showCharacters = false"
          >
            &#128214; {{ $t('book.settings') }}
          </button>
          <button
            class="info-btn"
            :class="{ active: showCharacters }"
            @click="showCharacters = !showCharacters; showSettings = false"
          >
            &#128100; {{ $t('book.characterCount', { count: bookStore.activeBook.characters.length }) }}
          </button>
        </div>
      </div>

      <BookSettingsPanel
        v-if="showSettings"
        :book="bookStore.activeBook"
        @update="onUpdateBookMeta"
      />
      <CharacterPanel
        v-if="showCharacters"
        :characters="bookStore.activeBook.characters"
        @update="bookStore.updateCharacter($event.id, $event.data)"
        @delete="bookStore.deleteCharacter($event)"
      />
    </template>

    <!-- Chapter Section -->
    <div class="sidebar-section chapter-section">
      <div class="section-header">
        <h3>{{ $t('book.chapter') }}</h3>
        <div class="chapter-actions">
          <button
            class="btn-icon btn-ai-gen"
            :title="$t('ai.genChapter')"
            :disabled="!bookStore.activeBook || genLoading"
            @click="onGenerateChapter"
          >
            <span v-if="genLoading" class="btn-spinner" />
            <template v-else>&#9889;</template>
          </button>
          <button
            class="btn-icon"
            :title="$t('editor.newChapter')"
            :disabled="!bookStore.activeBook"
            @click="onCreateChapter"
          >
            +
          </button>
        </div>
      </div>
    </div>

    <div class="chapter-list">
      <div v-if="!bookStore.activeBook" class="sidebar-empty">
        <p>{{ $t('book.noBook') }}</p>
      </div>
      <div v-else-if="bookStore.activeBookChapters.length === 0 && !genLoading" class="sidebar-empty">
        <p>{{ $t('book.noChapters') }}</p>
        <p>{{ $t('book.noChaptersHint') }}</p>
      </div>
      <div
        v-for="chapter in bookStore.activeBookChapters"
        :key="chapter.id"
        class="chapter-item"
        :class="{ active: chapter.id === activeChapterId }"
        @click="selectChapter(chapter.id)"
      >
        <span class="chapter-title">{{ chapter.title || $t('editor.unnamed') }}</span>
        <span class="chapter-words">
          {{ chapter.content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length }}
        </span>
        <button
          class="btn-delete"
          :title="$t('common.confirmDeleteChapter')"
          @click.stop="onDeleteChapter(chapter.id)"
        >
          &times;
        </button>
      </div>
      <!-- Ghost: AI generating chapter -->
      <div v-if="genLoading" class="chapter-item chapter-item-ghost">
        <span class="chapter-title ghost-title">{{ genTitle }}</span>
        <span class="chapter-words ghost-words">{{ $t('ai.generatingWord') }}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <span v-if="bookStore.activeBook" class="footer-stats">
        {{ $t('editor.totalChapters', { count: stats.chapters }) }} · {{ $t('editor.totalWords', { count: stats.words }) }}
      </span>
      <span v-else>{{ $t('book.noActiveBook') }}</span>
      <button
        v-if="bookStore.activeBook"
        class="btn-export"
        :title="$t('book.export')"
        @click="onExport"
      >
        &#8613;
      </button>
    </div>

    <ModalDialog
      :visible="modal.visible"
      :type="modal.type"
      :title="modal.title"
      :message="modal.message"
      :value="modal.value"
      :ok-text="modal.okText || t('common.confirm')"
      :cancel-text="modal.cancelText || t('common.cancel')"
      @confirm="onModalConfirm"
      @cancel="modal.visible = false"
      @update:visible="(v: boolean) => modal.visible = v"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookStore } from '@/stores/book'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { exportBookMarkdown, sendAiMessage } from '@/commands/llm'
import type { Book } from '@/types'
import ModalDialog from '@/components/common/ModalDialog.vue'
import BookSettingsPanel from '@/components/editor/BookSettingsPanel.vue'
import CharacterPanel from '@/components/editor/CharacterPanel.vue'

const { t } = useI18n()
const bookStore = useBookStore()
const editorStore = useEditorStore()
const settingsStore = useSettingsStore()

const showSettings = ref(false)
const showCharacters = ref(false)
const activeChapterId = ref('')
const editingBook = ref<Book | null>(null)
const editTitle = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const genLoading = ref(false)
const genTitle = ref('')

// — Modal state —
type ModalType = 'prompt' | 'confirm' | 'alert'
interface ModalAction { resolve: (value: string | boolean) => void }
const modal = reactive<{
  visible: boolean
  type: ModalType
  title: string
  message: string
  value: string
  okText: string
  cancelText: string
  action: ModalAction | null
}>({
  visible: false,
  type: 'alert',
  title: '',
  message: '',
  value: '',
  okText: '确定',
  cancelText: '取消',
  action: null,
})

function showModal(type: ModalType, title: string, opts?: { message?: string; value?: string }): Promise<string | boolean> {
  return new Promise((resolve) => {
    modal.type = type
    modal.title = title
    modal.message = opts?.message || ''
    modal.value = opts?.value || ''
    modal.visible = true
    modal.action = { resolve }
  })
}

function onModalConfirm(val: string) {
  const action = modal.action
  modal.action = null
  if (action) {
    action.resolve(modal.type === 'confirm' ? true : val)
  }
}

watch(() => modal.visible, (v) => {
  if (!v && modal.action) {
    // 用户点击了取消或点击遮罩关闭
    const action = modal.action
    modal.action = null
    action.resolve(modal.type === 'confirm' ? false : '')
  }
})

const stats = computed(() =>
  bookStore.activeBookId
    ? bookStore.getBookStats(bookStore.activeBookId)
    : { chapters: 0, words: 0, characters: 0 },
)

function bookStats(bookId: string): number {
  return bookStore.getBookStats(bookId).words
}

function selectBook(id: string) {
  bookStore.selectBook(id)
  showSettings.value = false
  showCharacters.value = false
}

async function onCreateBook() {
  const name = await showModal('prompt', t('book.newBookPrompt'), { value: t('book.defaultBookName') })
  if (name) {
    bookStore.createBook(name as string)
    showSettings.value = true
  }
}

function startRename(book: Book) {
  editingBook.value = book
  editTitle.value = book.title
  setTimeout(() => renameInput.value?.focus(), 50)
}

function onRenameBook() {
  if (editTitle.value.trim() && editingBook.value && editTitle.value !== editingBook.value.title) {
    bookStore.updateBookMeta(editingBook.value.id, { title: editTitle.value.trim() })
  }
  editingBook.value = null
  editTitle.value = ''
}

async function onDeleteBook(book: Book) {
  const ok = await showModal('confirm', t('book.confirmDeleteBook', { title: book.title }))
  if (ok) {
    bookStore.deleteBook(book.id)
    if (book.id === bookStore.activeBookId) {
      editorStore.updateContent('')
      editorStore.currentChapterId = ''
    }
  }
}

function onCreateChapter() {
  const chapter = bookStore.createChapter(t('editor.defaultChapterName'))
  if (chapter) {
    activeChapterId.value = chapter.id
    editorStore.currentChapterId = chapter.id
    editorStore.updateContent('')
  }
}

async function onGenerateChapter() {
  const book = bookStore.activeBook
  if (!book || genLoading.value) return

  genLoading.value = true
  genTitle.value = t('ai.genChapterLoading')
  editorStore.setError('')

  try {
    const ctxParts: string[] = []
    if (book.worldSetting) ctxParts.push(`【世界观】${book.worldSetting}`)
    if (book.storySetting) ctxParts.push(`【剧情总结】${book.storySetting}`)
    if (book.characters.length > 0) {
      const charInfo = book.characters
        .filter((c) => c.name)
        .map((c) => `【${c.role}】${c.name}：${c.description}`)
        .join('\n')
      if (charInfo) ctxParts.push(`【角色】\n${charInfo}`)
    }
    if (book.chapters.length > 0) {
      const chapterTitles = book.chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')
      ctxParts.push(`【已有章节】\n${chapterTitles}`)
    }
    const ctx = ctxParts.join('\n\n')

    const result = await sendAiMessage(settingsStore.modelConfig, {
      action: 'gen_chapter',
      content: book.chapters.length === 0 ? '请生成小说的第一章，直接进入故事。' : '请根据已有章节的脉络，续写下一个章节。',
      context: ctx || undefined,
    })

    const raw = result.trim()
    const lines = raw.split('\n')
    let title = ''
    let content = raw
    const titleMatch = lines[0].match(/^#\s+(.+)/)
    if (titleMatch) {
      title = titleMatch[1].trim()
      let bodyStart = 1
      while (bodyStart < lines.length && lines[bodyStart].trim() === '') {
        bodyStart++
      }
      content = lines.slice(bodyStart).join('\n').trim()
    }
    if (!title) title = `AI生成 ${book.chapters.length + 1}`

    const htmlContent = content
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')

    const chapter = bookStore.createChapter(title)
    if (chapter) {
      bookStore.updateChapterContent(book.id, chapter.id, htmlContent)
      activeChapterId.value = chapter.id
      editorStore.currentChapterId = chapter.id
      editorStore.updateContent(htmlContent)
    }
  } catch (e: any) {
    editorStore.setError(e.toString())
  } finally {
    genLoading.value = false
  }
}

function selectChapter(id: string) {
  activeChapterId.value = id
  editorStore.currentChapterId = id
  editorStore.updateContent(
    bookStore.activeBook?.chapters.find((c) => c.id === id)?.content || '',
  )
}

async function onDeleteChapter(chapterId: string) {
  const ok = await showModal('confirm', t('common.confirmDeleteChapter'))
  if (ok) {
    bookStore.deleteChapter(bookStore.activeBookId, chapterId)
    if (activeChapterId.value === chapterId) {
      activeChapterId.value = ''
      editorStore.updateContent('')
    }
  }
}

function onUpdateBookMeta(data: Record<string, string>) {
  bookStore.updateBookMeta(bookStore.activeBookId, data)
}

async function onExport() {
  const book = bookStore.activeBook
  if (!book) return
  try {
    const path = await exportBookMarkdown(
      book.title,
      JSON.stringify(book.chapters.map((c) => ({ title: c.title, content: c.content }))),
    )
    await showModal('alert', '', { message: t('book.exportSuccess') + path })
  } catch (e: any) {
    await showModal('alert', t('common.error'), { message: t('book.exportFailed') + e })
  }
}

</script>

<style scoped>
.sidebar {
  width: 240px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}

.sidebar-section {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.section-header h3 {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-icon {
  width: 26px;
  height: 26px;
  border: none;
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 6px var(--color-accent-light);
}
.btn-icon:disabled { opacity: 0.35; }
.btn-icon:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 0 3px 10px var(--color-accent-light);
}

/* ── Book list ── */
.book-list {
  padding: 4px 8px;
  max-height: 40vh;
  overflow-y: auto;
  border-bottom: 1px solid var(--color-border);
}

.book-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  margin-bottom: 2px;
}
.book-item:hover { background: var(--color-hover); }
.book-item.active {
  background: var(--color-accent-light);
  border-color: var(--color-accent);
}

.book-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.book-item-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-item-meta {
  font-size: 0.66rem;
  color: var(--color-text-muted);
}

.book-item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.book-item:hover .book-item-actions { opacity: 1; }

.btn-action-mini {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.btn-action-mini:hover { background: var(--color-hover); color: var(--color-accent); }
.btn-action-danger:hover { background: var(--color-danger-bg); color: var(--color-danger); }

.book-rename-section { padding: 6px 12px; }
.book-rename-input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.8rem;
  outline: none;
}

/* ── Info buttons ── */
.info-buttons { display: flex; gap: 4px; }
.info-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}
.info-btn:hover { border-color: var(--color-accent); color: var(--color-text); }
.info-btn.active {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
  box-shadow: 0 2px 8px var(--color-accent-light);
}

/* ── Chapter list ── */
.chapter-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.btn-ai-gen {
  background: linear-gradient(135deg, #f59e0b, #d97706) !important;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.35) !important;
}
.btn-ai-gen:hover:not(:disabled) {
  box-shadow: 0 3px 12px rgba(245, 158, 11, 0.5) !important;
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chapter-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.chapter-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  margin-bottom: 1px;
}
.chapter-item:hover { background: var(--color-hover); border-color: var(--color-border); }
.chapter-item.active { background: var(--color-accent-light); border-color: var(--color-accent); }

.chapter-title {
  flex: 1;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-words {
  font-size: 0.64rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.chapter-item-ghost {
  border: 1px dashed var(--color-accent) !important;
  background: var(--color-accent-light) !important;
  cursor: default !important;
  animation: ghost-pulse 1.6s ease-in-out infinite;
}

.ghost-title {
  color: var(--color-accent) !important;
  font-style: italic;
}

.ghost-words {
  color: var(--color-accent) !important;
  animation: blink-text 1s ease-in-out infinite;
}

@keyframes ghost-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

@keyframes blink-text {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

.btn-delete {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 5px;
  border-radius: 3px;
  opacity: 0;
  transition: all var(--transition-fast);
}
.chapter-item:hover .btn-delete { opacity: 1; }
.btn-delete:hover { color: #fff; background: var(--color-danger); }

.sidebar-empty {
  text-align: center;
  padding: 16px 12px;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  line-height: 1.6;
}

/* ── Footer ── */
.sidebar-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  font-size: 0.68rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 500;
}
.footer-stats {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-export {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 3px 8px;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}
.btn-export:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
}
</style>
