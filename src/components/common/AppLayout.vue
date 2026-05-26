<template>
  <div class="app-shell">
    <TitleBar />
    <div class="app-layout">
      <BookSidebar />
      <div class="main-area">
        <EditorToolbar @openSettings="$emit('openSettings')" @openSearch="showSearch = true" />
        <NovelEditor @showHistory="showHistory = true" />
      </div>
      <AiPanel />
    </div>

    <!-- Dialogs -->
    <SearchDialog v-if="showSearch" @close="showSearch = false" />
    <ChapterHistory v-if="showHistory" @close="showHistory = false" />

    <Transition name="toast">
      <div v-if="errorMsg" class="global-error" @click="dismissError">{{ errorMsg }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { AiAction } from '@/types'
import { focusEditor } from '@/extensions/ghost-text'
import TitleBar from '@/components/common/TitleBar.vue'
import BookSidebar from '@/components/editor/BookSidebar.vue'
import EditorToolbar from '@/components/editor/EditorToolbar.vue'
import NovelEditor from '@/components/editor/NovelEditor.vue'
import AiPanel from '@/components/ai/AiPanel.vue'
import SearchDialog from '@/components/common/SearchDialog.vue'
import ChapterHistory from '@/components/editor/ChapterHistory.vue'

defineEmits<{
  openSettings: []
}>()

const editorStore = useEditorStore()
const errorMsg = ref('')
let errorTimer: ReturnType<typeof setTimeout> | null = null

const showSearch = ref(false)
const showHistory = ref(false)

function dismissError() {
  errorMsg.value = ''
  if (errorTimer) clearTimeout(errorTimer)
}

watch(() => editorStore.activeError, (err) => {
  if (err) {
    errorMsg.value = err
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { errorMsg.value = '' }, 8000)
  }
})

function onKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd+Shift+F: Search
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key === 'F') {
    e.preventDefault()
    showSearch.value = true
    return
  }
  // Ctrl/Cmd+Shift+1~5: Execute AI actions directly
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
    e.preventDefault()
    const actions: Record<string, AiAction> = { 'Digit1': 'review', 'Digit2': 'idea', 'Digit3': 'continue', 'Digit4': 'consistency', 'Digit5': 'gen_chapter' }
    editorStore.executeAction(actions[e.code])
    focusEditor()
    return
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.global-error {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 600px;
  padding: 10px 20px;
  background: var(--color-danger);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 0.84rem;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  z-index: 9999;
  text-align: center;
  line-height: 1.5;
  word-break: break-word;
}

.toast-enter-active { transition: all 0.3s ease-out; }
.toast-leave-active { transition: all 0.3s ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(20px); }
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(20px); }
</style>
