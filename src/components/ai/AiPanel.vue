<template>
  <div class="ai-panel">
    <div class="panel-header">
      <h3>{{ $t('ai.panel') }}</h3>
    </div>

    <div class="panel-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.action"
        class="tab-btn"
        :class="{ active: editorStore.activeAction === tab.action }"
        @click="editorStore.setActiveAction(tab.action)"
      >
        {{ tab.icon }} {{ $t('ai.' + tab.action) }}
      </button>
    </div>

    <div class="panel-body">
      <ReviewResult v-if="editorStore.activeAction === 'review'" />
      <IdeaResult v-else-if="editorStore.activeAction === 'idea'" />
      <ContinueResult v-else-if="editorStore.activeAction === 'continue'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import type { AiAction } from '@/types'
import ReviewResult from './ReviewResult.vue'
import IdeaResult from './IdeaResult.vue'
import ContinueResult from './ContinueResult.vue'

const editorStore = useEditorStore()

const tabs: { action: AiAction; icon: string }[] = [
  { action: 'review', icon: '\u{1F50D}' },
  { action: 'idea', icon: '\u{1F4A1}' },
  { action: 'continue', icon: '\u{270D}' },
]
</script>

<style scoped>
.ai-panel {
  width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
}

.panel-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.panel-header h3 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.panel-tabs {
  display: flex;
  padding: 4px;
  gap: 2px;
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  flex: 1;
  padding: 8px 6px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.tab-btn.active {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
}
</style>
