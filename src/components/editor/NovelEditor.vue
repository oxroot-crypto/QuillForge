<template>
  <div class="editor-container">
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
        <span class="word-count">{{ $t('editor.wordCount', { count: wordCount }) }}</span>
      </div>

      <div class="editor-content" :data-placeholder="$t('editor.placeholder')">
        <editor-content :editor="editor" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { useEditorStore } from '@/stores/editor'
import { useBookStore } from '@/stores/book'
import { GhostText, setEditorView } from '@/extensions/ghost-text'

const editorStore = useEditorStore()
const bookStore = useBookStore()

const hasActiveChapter = computed(() => editorStore.content.length > 0 || bookStore.activeBookChapters.length > 0)
const activeChapter = computed(() => {
  if (!bookStore.activeBook) return undefined
  for (const ch of bookStore.activeBook.chapters) {
    if (ch.content === editorStore.content) return ch
  }
  return undefined
})
const chapterTitle = ref(activeChapter.value?.title || '')
const wordCount = computed(() => editorStore.wordCount)

const editor = useEditor({
  content: activeChapter.value?.content || '',
  extensions: [StarterKit, GhostText],
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    editorStore.updateContent(html)
    if (editorStore.currentChapterId && bookStore.activeBookId) {
      bookStore.updateChapterContent(bookStore.activeBookId, editorStore.currentChapterId, html)
    }
  },
  onSelectionUpdate: ({ editor }) => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    editorStore.updateSelection(text)
  },
  onCreate: ({ editor }) => {
    setEditorView(editor)
  },
})

watch(
  () => editorStore.content,
  (newContent) => {
    if (!editor.value || editor.value.getHTML() === newContent) return
    editor.value.commands.setContent(newContent)
  },
)

function onTitleChange(e: Event) {
  const target = e.target as HTMLInputElement
  chapterTitle.value = target.value
  if (editorStore.currentChapterId && bookStore.activeBookId) {
    bookStore.renameChapter(bookStore.activeBookId, editorStore.currentChapterId, target.value)
  }
}

watch(
  () => activeChapter.value?.title,
  (title) => {
    if (title !== undefined) chapterTitle.value = title
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
.editor-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  overflow: hidden;
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
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--color-border);
}

.chapter-title-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text);
  outline: none;
  padding: 4px 0;
  border-radius: 0;
}
.chapter-title-input::placeholder { color: var(--color-text-muted); opacity: 0.5; }

.word-count {
  font-size: 0.76rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  background: var(--color-hover);
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 500;
  border: 1px solid var(--color-border);
}

.editor-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px;
}

.editor-content :deep(.ProseMirror) {
  min-height: 100%;
  max-width: 780px;
  margin: 0 auto;
  outline: none;
  font-size: 16px;
  line-height: 1.85;
  color: var(--color-text);
}

.editor-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder, none);
  color: var(--color-text-muted);
  opacity: 0.45;
  pointer-events: none;
  float: left;
  height: 0;
}

.editor-content :deep(.ProseMirror) h1 { font-size: 1.7rem; font-weight: 700; margin: 1.2em 0 0.5em; }
.editor-content :deep(.ProseMirror) h2 { font-size: 1.35rem; font-weight: 600; margin: 1em 0 0.4em; }
.editor-content :deep(.ProseMirror) p { margin-bottom: 0.7em; }
.editor-content :deep(.ProseMirror) blockquote {
  border-left: 3px solid var(--color-accent);
  padding: 6px 16px;
  margin: 14px 0;
  color: var(--color-text-muted);
  background: var(--color-hover);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
</style>
