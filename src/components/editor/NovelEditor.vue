<template>
  <div class="editor-container" :class="{ 'focus-mode': focusMode }">
    <div v-if="!hasActiveChapter" class="editor-empty">
      <div class="empty-hint">
        <span class="empty-icon">&#9998;</span>
        <h3>{{ $t('app.welcome') }}</h3>
        <p>{{ $t('editor.emptyHint') }}</p>
      </div>
    </div>

    <div v-else class="editor-wrapper">
      <div class="editor-header">
        <input
          class="chapter-title-input"
          :value="chapterTitle"
          :placeholder="$t('editor.chapterTitle')"
          @input="onTitleChange"
        />
        <div class="editor-header-actions">
          <button
            class="header-btn header-btn-focus"
            :class="{ active: focusMode }"
            :title="focusMode ? 'Exit Focus Mode' : 'Focus Mode'"
            @click="focusMode = !focusMode"
          >
            {{ focusMode ? '&#9776;' : '&#9889;' }}
          </button>
          <button
            class="header-btn"
            :title="$t('history.title')"
            @click="$emit('showHistory')"
          >
            &#128214;
          </button>
          <span class="word-count">{{ $t('editor.wordCount', { count: wordCount }) }}</span>
          <span v-if="readingTime" class="reading-time">~{{ readingTime }} min</span>
        </div>
      </div>

      <div class="editor-content">
        <BubbleMenu :editor="editor ?? null" />
        <editor-content :editor="editor" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditorStore } from '@/stores/editor'
import { useBookStore } from '@/stores/book'
import { GhostText, setEditorView } from '@/extensions/ghost-text'
import { SpellCheck } from '@/extensions/spellcheck'
import BubbleMenu from './BubbleMenu.vue'

defineEmits<{ showHistory: [] }>()

const editorStore = useEditorStore()
const bookStore = useBookStore()

const hasActiveChapter = computed(() => bookStore.activeBookChapters.length > 0)
const chapterTitle = ref(bookStore.activeChapter?.title || '')
const wordCount = computed(() => editorStore.wordCount)
const readingTime = computed(() => {
  const wc = wordCount.value
  if (wc < 200) return 0
  return Math.ceil(wc / 400)
})
const focusMode = ref(false)

// Guard to prevent update loops when restoring snapshots
let updatingFromExternal = false

const editor = useEditor({
  content: bookStore.activeChapter?.content || '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return ''
        return 'Start writing your story...'
      },
    }),
    GhostText,
    SpellCheck,
  ],
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    editorStore.updateContent(html)
    if (bookStore.activeChapterId && bookStore.activeBookId) {
      updatingFromExternal = true
      bookStore.updateChapterContent(bookStore.activeBookId, bookStore.activeChapterId, html)
      nextTick(() => { updatingFromExternal = false })
    }
  },
  onSelectionUpdate: ({ editor }) => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    editorStore.updateSelection(text)
    editorStore.updateCursorPosition(from)
  },
  onCreate: ({ editor }) => {
    setEditorView(editor)
  },
})

// Sync editor content when chapter selection changes
watch(
  () => bookStore.activeChapterId,
  (id) => {
    if (!id || !editor.value) {
      // No active chapter — clear editor
      if (editor.value && !id) {
        editor.value.commands.setContent('')
      }
      editorStore.updateContent('')
      chapterTitle.value = ''
      return
    }
    const chapter = bookStore.activeChapter
    if (!chapter) return
    if (editor.value.getHTML() !== chapter.content) {
      editor.value.commands.setContent(chapter.content)
    }
    editorStore.updateContent(chapter.content)
    chapterTitle.value = chapter.title
  },
)

watch(
  () => bookStore.activeChapter?.title,
  (title) => {
    if (title !== undefined) chapterTitle.value = title
  },
)

// Sync editor content when chapter content changes externally (e.g. snapshot restore)
watch(
  () => bookStore.activeChapter?.content,
  (content) => {
    if (!editor.value || content === undefined || updatingFromExternal) return
    if (editor.value.getHTML() !== content) {
      editor.value.commands.setContent(content)
      editorStore.updateContent(content)
    }
  },
)

function onTitleChange(e: Event) {
  const target = e.target as HTMLInputElement
  chapterTitle.value = target.value
  if (bookStore.activeChapterId && bookStore.activeBookId) {
    bookStore.renameChapter(bookStore.activeBookId, bookStore.activeChapterId, target.value)
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style>
/* ---- Global ProseMirror Styles ---- */
.ProseMirror {
  min-height: 100%;
  max-width: 720px;
  margin: 0 auto;
  outline: none;
  font-size: 16px;
  line-height: 1.9;
  color: var(--color-text);
  font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif SC', serif;
  letter-spacing: 0.012em;
  word-spacing: 0.05em;
  padding: 0 4px 40vh;
}

.ProseMirror p {
  margin-bottom: 0.65em;
}

.ProseMirror h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 1.4em 0 0.6em;
  line-height: 1.35;
  letter-spacing: 0.01em;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

.ProseMirror h2 {
  font-size: 1.35rem;
  font-weight: 600;
  margin: 1.2em 0 0.5em;
  line-height: 1.4;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

.ProseMirror h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1em 0 0.4em;
  line-height: 1.45;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

.ProseMirror blockquote {
  border-left: 3px solid var(--color-accent);
  padding: 8px 18px;
  margin: 16px 0;
  color: var(--color-text-muted);
  background: var(--color-hover);
  border-radius: 0 8px 8px 0;
  font-style: italic;
  line-height: 1.7;
}

.ProseMirror blockquote p {
  margin-bottom: 0.3em;
}

.ProseMirror hr {
  border: none;
  border-top: 2px solid var(--color-border);
  margin: 28px auto;
  width: 60px;
  opacity: 0.5;
}

.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.5em;
  margin-bottom: 0.65em;
}

.ProseMirror li {
  margin-bottom: 0.25em;
}

.ProseMirror strong {
  font-weight: 700;
}

.ProseMirror em {
  font-style: italic;
}

.ProseMirror u {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ProseMirror mark {
  background: #fef08a;
  color: inherit;
  padding: 1px 3px;
  border-radius: 3px;
}

/* Spell check error underline */
.spell-error {
  text-decoration: wavy underline #ef4444;
  text-underline-offset: 3px;
  cursor: help;
}

/* Ghost text decoration */
.ghost-text-decoration {
  color: var(--color-text-muted) !important;
  opacity: 0.3 !important;
  pointer-events: none;
  user-select: none;
  white-space: pre-wrap;
  font-style: italic;
}

/* Custom scrollbar */
.editor-content::-webkit-scrollbar {
  width: 6px;
}

.editor-content::-webkit-scrollbar-track {
  background: transparent;
}

.editor-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.editor-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
</style>

<style scoped>
.editor-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  overflow: hidden;
  transition: background 0.3s ease;
}

.editor-container.focus-mode {
  background: var(--color-surface);
}

.editor-container.focus-mode .editor-content :deep(.ProseMirror) {
  max-width: 660px;
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  text-align: center;
  color: var(--color-text-muted);
}

.empty-hint h3 {
  margin: 12px 0 8px;
  color: var(--color-text);
  font-size: 1.3rem;
  font-weight: 600;
}

.empty-icon {
  font-size: 3.5rem;
  display: block;
  opacity: 0.6;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: opacity 0.3s ease;
}

.focus-mode .editor-header {
  opacity: 0.6;
}

.focus-mode .editor-header:hover {
  opacity: 1;
}

.chapter-title-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  outline: none;
  padding: 4px 0;
  border-radius: 0;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}
.chapter-title-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.4;
}

.editor-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.header-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: var(--color-hover);
  color: var(--color-text-muted);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.15s ease;
}
.header-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
}

.header-btn-focus.active {
  background: #f59e0b;
  color: #fff;
  border-color: #f59e0b;
}

.word-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  background: var(--color-hover);
  padding: 3px 10px;
  border-radius: 8px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  line-height: 1.6;
}

.reading-time {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  background: var(--color-hover);
  padding: 3px 8px;
  border-radius: 8px;
  font-weight: 400;
  border: 1px solid var(--color-border);
  opacity: 0.7;
  line-height: 1.6;
}

.editor-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 32px 32px 0;
  scroll-behavior: smooth;
}
</style>
