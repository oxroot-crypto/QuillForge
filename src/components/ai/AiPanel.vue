<template>
  <div class="ai-panel">
    <div class="panel-header">
      <h3>{{ $t('ai.panel') }}</h3>
      <button
        class="btn-templates"
        :title="$t('templates.title')"
        @click="showTemplates = true"
      >
        &#128203;
      </button>
    </div>

    <div class="panel-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.action"
        class="tab-btn"
        :class="{ active: editorStore.activeAction === tab.action }"
        @click="onTabClick(tab.action)"
      >
        {{ tab.icon }} {{ $t('ai.' + tab.action) }}
      </button>
    </div>

    <!-- Template selector bar -->
    <div class="template-bar">
      <span class="template-bar-label">{{ $t('templates.template') }}</span>
      <div class="template-bar-select-wrap">
        <select
          class="template-bar-select"
          :value="templateStore.activeTemplateId"
          @change="onTemplateChange"
        >
          <option value="">{{ $t('templates.noTemplate') }}</option>
          <option
            v-for="tpl in availableTemplates"
            :key="tpl.id"
            :value="tpl.id"
          >
            {{ tpl.name }}
          </option>
        </select>
      </div>
      <button
        class="template-bar-manage"
        :title="$t('templates.manage')"
        @click="showTemplates = true"
      >
        &#9881;
      </button>
    </div>

    <div class="panel-body">
      <ReviewResult v-if="editorStore.activeAction === 'review'" />
      <IdeaResult v-else-if="editorStore.activeAction === 'idea'" />
      <ContinueResult v-else-if="editorStore.activeAction === 'continue'" />
      <ConsistencyResult v-else-if="editorStore.activeAction === 'consistency'" />
      <GenChapterResult v-else-if="editorStore.activeAction === 'gen_chapter'" />
    </div>

    <div class="panel-analytics-toggle" @click="toggleAnalytics">
      <span>&#128202;</span>
      <span>{{ $t('analytics.title') }}</span>
      <span class="toggle-arrow">{{ showAnalytics ? '▾' : '▸' }}</span>
    </div>

    <Transition name="slide">
      <div v-if="showAnalytics" class="panel-analytics">
        <AnalyticsPanel />
      </div>
    </Transition>

    <TemplateSelector
      v-if="showTemplates"
      @close="showTemplates = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/stores/editor'
import { useTemplateStore } from '@/stores/templates'
import type { AiAction } from '@/types'
import { focusEditor } from '@/extensions/ghost-text'
import ReviewResult from './ReviewResult.vue'
import IdeaResult from './IdeaResult.vue'
import ContinueResult from './ContinueResult.vue'
import ConsistencyResult from './ConsistencyResult.vue'
import GenChapterResult from './GenChapterResult.vue'
import AnalyticsPanel from '@/components/analytics/AnalyticsPanel.vue'
import TemplateSelector from './TemplateSelector.vue'

const { locale } = useI18n()
const editorStore = useEditorStore()
const templateStore = useTemplateStore()

const showAnalytics = ref(false)
const showTemplates = ref(false)

const tabs: { action: AiAction; icon: string }[] = [
  { action: 'review', icon: '\u{1F50D}' },
  { action: 'idea', icon: '\u{1F4A1}' },
  { action: 'continue', icon: '\u{270D}' },
  { action: 'consistency', icon: '\u{1F4DC}' },
  { action: 'gen_chapter', icon: '\u{26A1}' },
]

const availableTemplates = computed(() => {
  return templateStore.getTemplatesByAction(editorStore.activeAction, locale.value as string)
})

function onTemplateChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  templateStore.selectTemplate(val)
}

function onTabClick(action: AiAction) {
  editorStore.setActiveAction(action)
  // Restore editor cursor after tab switch
  focusEditor()
}

function toggleAnalytics() {
  showAnalytics.value = !showAnalytics.value
  focusEditor()
}
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
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.btn-templates {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 3px 8px;
  transition: all var(--transition-fast);
}
.btn-templates:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.panel-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  padding: 8px 8px 6px;
  gap: 5px;
  border-bottom: 1px solid var(--color-border);
}

.tab-btn {
  padding: 5px 11px;
  border: 1px solid transparent;
  background: var(--color-hover);
  border-radius: 14px;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
  white-space: nowrap;
  line-height: 1.4;
}

.tab-btn:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.tab-btn.active {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
}

.template-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-hover);
}

.template-bar-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.template-bar-select-wrap {
  flex: 1;
  min-width: 0;
}

.template-bar-select {
  width: 100%;
  padding: 3px 20px 3px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.72rem;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%238888a8' d='M2 3l2 2 2-2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
}
.template-bar-select:focus { border-color: var(--color-accent); }

.template-bar-manage {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.82rem;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  line-height: 1;
}
.template-bar-manage:hover { color: var(--color-accent); background: var(--color-bg); }

.panel-analytics-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: background var(--transition-fast);
}
.panel-analytics-toggle:hover { background: var(--color-hover); color: var(--color-text); }

.toggle-arrow { margin-left: auto; }

.panel-analytics {
  border-top: 1px solid var(--color-border);
  max-height: 50vh;
  overflow-y: auto;
}

.slide-enter-active { transition: all 0.25s ease-out; }
.slide-leave-active { transition: all 0.2s ease-in; }
.slide-enter-from { max-height: 0; opacity: 0; }
.slide-leave-to { max-height: 0; opacity: 0; }
</style>
