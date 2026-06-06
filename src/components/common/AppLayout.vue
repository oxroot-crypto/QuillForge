<!-- 应用主布局——三栏式结构（侧边栏⫶编辑区⫶AI面板），管理全局快捷键（Ctrl+Shift+组合键）和底部错误 Toast -->
<template>
  <div class="app-shell">
    <TitleBar />
    <div class="app-layout">
      <div class="sidebar-wrap" :class="{ collapsed: sidebarCollapsed }">
        <div class="panel-inner">
          <BookSidebar />
        </div>
      </div>
      <div class="main-area">
        <EditorToolbar
          :agentsVisible="showAgents"
          :sidebarCollapsed="sidebarCollapsed"
          :aiPanelCollapsed="aiPanelCollapsed"
          @openSettings="$emit('openSettings')"
          @openSearch="showSearch = true"
          @toggleAgents="showAgents = !showAgents"
          @toggleSidebar="sidebarCollapsed = !sidebarCollapsed"
          @toggleAiPanel="aiPanelCollapsed = !aiPanelCollapsed"
        />
        <NovelEditor @showHistory="showHistory = true" />
        <AgentsCli :visible="showAgents" @close="showAgents = false" />
      </div>
      <div class="aipanel-wrap" :class="{ collapsed: aiPanelCollapsed }">
        <div class="panel-inner">
          <AiPanel />
        </div>
      </div>
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
import AgentsCli from '@/components/editor/AgentsCli.vue'

defineEmits<{
  openSettings: []
}>()

const editorStore = useEditorStore()
const errorMsg = ref('')
let errorTimer: ReturnType<typeof setTimeout> | null = null

const showSearch = ref(false)
const showHistory = ref(false)
const showAgents = ref(false)
const sidebarCollapsed = ref(false)
const aiPanelCollapsed = ref(false)

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
  // Ctrl/Cmd+Shift+A: Toggle Agents CLI
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
    e.preventDefault()
    showAgents.value = !showAgents.value
    return
  }
  // Ctrl/Cmd+Shift+B: Toggle BookSidebar
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.code === 'KeyB') {
    e.preventDefault()
    sidebarCollapsed.value = !sidebarCollapsed.value
    return
  }
  // Ctrl/Cmd+Shift+P: Toggle AI Panel
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
    e.preventDefault()
    aiPanelCollapsed.value = !aiPanelCollapsed.value
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

.sidebar-wrap,
.aipanel-wrap {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar-wrap {
  width: 240px;
  min-width: 240px;
}
.sidebar-wrap.collapsed {
  width: 0;
  min-width: 0;
}
.aipanel-wrap {
  width: 320px;
  min-width: 320px;
}
.aipanel-wrap.collapsed {
  width: 0;
  min-width: 0;
}

.panel-inner {
  width: 240px;
  height: 100%;
  overflow: hidden;
}
.aipanel-wrap .panel-inner {
  width: 320px;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.global-error {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 600px;
  padding: 10px 20px;
  background: var(--color-danger);
  color: var(--color-text-on-accent);
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
