<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.consistencyHint') }}</p>
    </div>

    <button
      class="btn-action"
      :disabled="!editorStore.hasSelection || editorStore.isLoading"
      @click="doConsistencyCheck"
    >
      <LoadingDots v-if="editorStore.isLoading" />
      <template v-else>&#128220; {{ $t('ai.consistencyBtn') }}</template>
    </button>

    <button
      v-if="editorStore.isLoading"
      class="btn-cancel"
      @click="onCancel"
    >
      {{ $t('common.cancel') }}
    </button>

    <div v-if="editorStore.selectedText && !editorStore.isLoading" class="selected-preview">
      <div class="preview-label">{{ $t('ai.selected', { count: editorStore.selectedText.length }) }}</div>
      <div class="preview-text">{{ editorStore.selectedText.slice(0, 200) }}{{ editorStore.selectedText.length > 200 ? '...' : '' }}</div>
    </div>

    <div v-if="editorStore.isLoading" class="consistency-loading">
      <div class="consistency-loading-icon">&#128220;</div>
      <div class="consistency-loading-label">{{ $t('ai.consistencyLoading') }}</div>
    </div>

    <div v-if="editorStore.activeError" class="result-error">{{ editorStore.activeError }}</div>

    <div v-if="editorStore.activeResult && !editorStore.isLoading" class="result-box">
      <div v-if="isConsistent" class="consistency-clean">
        {{ $t('ai.consistencyClean') }}
      </div>
      <div v-else class="consistency-issues">
        <div
          v-for="(issue, i) in issues"
          :key="i"
          class="issue-item"
          :class="`severity-${issue.severity}`"
        >
          <div class="issue-header">
            <span class="issue-character">{{ issue.character }}</span>
            <span class="issue-type">{{ issue.type }}</span>
            <span class="issue-severity">{{ issue.severity }}</span>
          </div>
          <div class="issue-desc">{{ issue.desc }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/ai'
import LoadingDots from '@/components/common/LoadingDots.vue'
import { focusEditor } from '@/extensions/ghost-text'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()

interface ConsistencyIssue {
  character: string
  type: string
  severity: string
  desc: string
}

const isConsistent = computed(() => {
  return editorStore.activeResult.includes('未发现不一致')
})

const issues = computed<ConsistencyIssue[]>(() => {
  const lines = editorStore.activeResult.split('\n')
  return lines
    .filter((l) => l.startsWith('【不一致】'))
    .map((l) => {
      const parts = l.replace('【不一致】', '').split('|').map((s) => s.trim())
      return {
        character: parts[0] || '?',
        type: parts[1] || '?',
        desc: parts[2] || '?',
        severity: parts[3] || '低',
      }
    })
})

function buildBookContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  return [
    book.worldSetting ? `【世界观】${book.worldSetting}` : '',
    ...book.characters.filter((c) => c.name).map(
      (c) => `【角色·${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '路人'}】${c.name}：${c.description || '(无描述)'}`,
    ),
  ].filter(Boolean).join('\n')
}

async function doConsistencyCheck() {
  if (!editorStore.selectedText) return
  editorStore.setLoading(true)
  editorStore.setAiResult('', 'consistency')
  editorStore.setError('', 'consistency')
  editorStore.resetCancel('consistency')
  try {
    const bookCtx = buildBookContext()
    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'consistency',
      content: editorStore.selectedText,
      context: bookCtx || undefined,
    })
    if (editorStore.isCancelled('consistency')) return
    editorStore.setAiResult(result, 'consistency')
  } catch (e: unknown) {
    if (!editorStore.isCancelled('consistency')) {
      editorStore.setError(String(e), 'consistency')
    }
  } finally {
    editorStore.setLoading(false)
    editorStore.resetCancel('consistency')
    focusEditor()
  }
}

function onCancel() {
  editorStore.cancelAction('consistency')
  editorStore.setLoading(false)
  focusEditor()
}

onMounted(() => {
  editorStore.registerActionHandler('consistency', doConsistencyCheck)
})
onBeforeUnmount(() => {
  editorStore.unregisterActionHandler('consistency')
})
</script>

<style scoped>
.action-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-info p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.btn-action {
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  color: #fff;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px var(--color-accent-light);
}
.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px var(--color-accent-light);
}
.btn-action:active:not(:disabled) { transform: translateY(0); }

.selected-preview {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}

.preview-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin-bottom: 6px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-text {
  font-size: 0.8rem;
  color: var(--color-text);
  line-height: 1.55;
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
.btn-cancel:hover { background: var(--color-danger-bg); }

.consistency-loading {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.consistency-loading-icon { font-size: 1.8rem; animation: pulse 1.2s ease-in-out infinite; }
.consistency-loading-label { font-size: 0.78rem; color: var(--color-accent); font-weight: 600; }

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
}

.consistency-clean {
  text-align: center;
  padding: 16px;
  color: var(--color-success);
  font-weight: 600;
  font-size: 0.9rem;
}

.consistency-issues { display: flex; flex-direction: column; gap: 8px; }

.issue-item {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border-left: 3px solid;
}

.issue-item.severity-高 { background: var(--color-danger-bg); border-color: var(--color-danger); }
.issue-item.severity-中 { border-color: #f59e0b; background: rgba(245, 158, 11, 0.08); }
.issue-item.severity-低 { border-color: var(--color-text-muted); background: var(--color-hover); }

.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.issue-character { font-weight: 700; font-size: 0.85rem; color: var(--color-text); }
.issue-type { font-size: 0.7rem; color: var(--color-text-muted); background: var(--color-hover); padding: 1px 6px; border-radius: 4px; }
.issue-severity { font-size: 0.65rem; font-weight: 600; margin-left: auto; }
.severity-高 .issue-severity { color: var(--color-danger); }
.severity-中 .issue-severity { color: #f59e0b; }
.severity-低 .issue-severity { color: var(--color-text-muted); }

.issue-desc { font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.5; }
</style>
