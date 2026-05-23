<template>
  <div class="app-shell">
    <TitleBar />
    <div class="app-layout">
      <BookSidebar />
      <div class="main-area">
        <EditorToolbar @openSettings="$emit('openSettings')" />
        <NovelEditor />
      </div>
      <AiPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import TitleBar from '@/components/common/TitleBar.vue'
import BookSidebar from '@/components/editor/BookSidebar.vue'
import EditorToolbar from '@/components/editor/EditorToolbar.vue'
import NovelEditor from '@/components/editor/NovelEditor.vue'
import AiPanel from '@/components/ai/AiPanel.vue'

defineEmits<{
  openSettings: []
}>()
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
</style>
