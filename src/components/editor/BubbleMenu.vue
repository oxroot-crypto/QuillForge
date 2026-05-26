<template>
  <bubble-menu
    v-if="editor"
    :editor="editor"
    :tippy-options="{ duration: 150, placement: 'top' }"
    class="bubble-menu"
  >
    <div class="bubble-menu-group">
      <button
        class="bubble-btn"
        :class="{ active: editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
        :title="t('editor.formatBold')"
      >
        <strong>B</strong>
      </button>
      <button
        class="bubble-btn"
        :class="{ active: editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
        :title="t('editor.formatItalic')"
      >
        <em>I</em>
      </button>
      <button
        class="bubble-btn"
        :class="{ active: editor.isActive('underline') }"
        @click="editor.chain().focus().toggleUnderline().run()"
        :title="t('editor.formatUnderline')"
      >
        <span style="text-decoration: underline">U</span>
      </button>
      <button
        class="bubble-btn"
        :class="{ active: editor.isActive('strike') }"
        @click="editor.chain().focus().toggleStrike().run()"
        :title="t('editor.formatStrike')"
      >
        <span style="text-decoration: line-through">S</span>
      </button>
    </div>

    <div class="bubble-divider" />

    <div class="bubble-menu-group">
      <button
        class="bubble-btn"
        :class="{ active: editor.isActive('highlight') }"
        @click="editor.chain().focus().toggleHighlight().run()"
        :title="t('editor.formatHighlight')"
      >
        <span style="background: #fef08a; padding: 0 2px; border-radius: 2px;">A</span>
      </button>
      <button
        class="bubble-btn"
        :class="{ active: editor.isActive('heading', { level: 2 }) }"
        @click="toggleHeading"
        :title="t('editor.formatHeading')"
      >
        <span style="font-weight: 600; font-size: 0.85rem">H</span>
      </button>
      <button
        class="bubble-btn"
        @click="editor.chain().focus().setHorizontalRule().run()"
        :title="t('editor.formatHR')"
      >
        —
      </button>
    </div>
  </bubble-menu>
</template>

<script setup lang="ts">
import { BubbleMenu } from '@tiptap/vue-3/menus'
import type { Editor } from '@tiptap/core'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{ editor: Editor | null }>()

function toggleHeading() {
  if (!props.editor) return
  props.editor.chain().focus().toggleHeading({ level: 2 }).run()
}
</script>

<style scoped>
.bubble-menu {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 4px 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(12px);
  z-index: 100;
}

.bubble-menu-group {
  display: flex;
  align-items: center;
  gap: 1px;
}

.bubble-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 3px;
}

.bubble-btn {
  width: 30px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.78rem;
  font-family: inherit;
  transition: all 0.15s ease;
}

.bubble-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.bubble-btn.active {
  background: var(--color-accent);
  color: #fff;
}
</style>
