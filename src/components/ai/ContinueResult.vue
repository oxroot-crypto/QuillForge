<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.continueHint') }}</p>
    </div>

    <div class="continue-options">
      <label class="option-label">{{ $t('ai.continueStyle') }}</label>
      <select v-model="styleOption" class="style-select">
        <option value="auto">{{ $t('ai.styleAuto') }}</option>
        <option value="descriptive">{{ $t('ai.styleDescriptive') }}</option>
        <option value="tense">{{ $t('ai.styleTense') }}</option>
        <option value="dialogue">{{ $t('ai.styleDialogue') }}</option>
      </select>
    </div>

    <button
      class="btn-action"
      :disabled="!editorStore.hasContent || editorStore.isLoading"
      @click="doContinue"
    >
      <LoadingDots v-if="editorStore.isLoading" />
      <template v-else>&#9997; {{ $t('ai.continueBtn') }}</template>
    </button>

    <button
      v-if="editorStore.isLoading"
      class="btn-cancel"
      @click="onCancel"
    >
      {{ $t('common.cancel') }}
    </button>

    <div v-if="editorStore.isLoading" class="continue-loading">
      <div class="continue-loading-icon">&#9997;</div>
      <div class="continue-loading-label">{{ $t('ai.continueLoading') }}</div>
      <div class="continue-typing">
        <span class="typing-cursor">|</span>
        <span class="typing-text">{{ $t('ai.continueTypingText') }}</span>
      </div>
    </div>

    <div v-if="editorStore.activeError" class="result-error">{{ editorStore.activeError }}</div>

    <div v-if="editorStore.activeResult && !editorStore.isLoading" class="result-box">
      <div class="markdown-body" v-html="renderedResult" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/ai'
import { showGhostText, clearGhostText, focusEditor } from '@/extensions/ghost-text'
import LoadingDots from '@/components/common/LoadingDots.vue'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()
const styleOption = ref('auto')

const renderedResult = computed(() => {
  return editorStore.activeResult
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
})

function buildBookContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  return [
    book.worldSetting ? `【世界观】${book.worldSetting}` : '',
    book.storySetting ? `【剧情总结】${book.storySetting}` : '',
    ...book.characters.filter((c) => c.name && c.description).map(
      (c) => `【角色】${c.name}(${c.role})：${c.description}`,
    ),
  ].filter(Boolean).join('\n')
}

async function doContinue() {
  if (!editorStore.hasContent) return
  const context = editorStore.content.replace(/<[^>]*>/g, '').slice(-2000)
  editorStore.setLoading(true)
  editorStore.setAiResult('', 'continue')
  editorStore.setError('', 'continue')
  editorStore.resetCancel('continue')
  try {
    const bookCtx = buildBookContext()
    const styleHint = styleOption.value === 'auto' ? '' : `续写风格偏好：${styleOption.value}。`
    const fullContext = [bookCtx, `【正文】${context}`].filter(Boolean).join('\n\n')
    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'continue',
      content: `${styleHint}\n\n${fullContext}`,
    })
    if (editorStore.isCancelled('continue')) return
    editorStore.setAiResult(result, 'continue')
    clearGhostText()
    showGhostText(result.replace(/\*\*.*?\*\*/g, '$&').replace(/\*.*?\*/g, '$&'))
  } catch (e: unknown) {
    if (!editorStore.isCancelled('continue')) {
      editorStore.setError(String(e), 'continue')
    }
  } finally {
    editorStore.setLoading(false)
    editorStore.resetCancel('continue')
    focusEditor()
  }
}

function onCancel() {
  editorStore.cancelAction('continue')
  clearGhostText()
  editorStore.setLoading(false)
  focusEditor()
}

onMounted(() => {
  editorStore.registerActionHandler('continue', doContinue)
})
onBeforeUnmount(() => {
  editorStore.unregisterActionHandler('continue')
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

.continue-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.style-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.84rem;
  outline: none;
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%238888a8' d='M2.5 3.5l2.5 3 2.5-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.style-select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
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

.btn-action:active:not(:disabled) {
  transform: translateY(0);
}

.result-error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-danger);
  font-size: 0.8rem;
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

.result-box {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  font-size: 0.84rem;
  line-height: 1.7;
  color: var(--color-text);
}

.ghost-hint {
  margin-top: 10px;
  font-size: 0.72rem;
  color: var(--color-accent);
  text-align: center;
  padding: 6px;
  border-top: 1px solid var(--color-border);
}

.continue-loading {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.continue-loading-icon {
  font-size: 1.8rem;
  animation: pen-bounce 0.8s ease-in-out infinite;
}

.continue-loading-label {
  font-size: 0.78rem;
  color: var(--color-accent);
  font-weight: 600;
}

.continue-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.typing-cursor {
  font-size: 1rem;
  color: var(--color-accent);
  animation: cursor-blink 0.8s step-end infinite;
}

.typing-text {
  font-size: 0.76rem;
  color: var(--color-text-muted);
  font-style: italic;
  animation: fade-in-out 2s ease-in-out infinite;
}

@keyframes pen-bounce {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-4px) rotate(5deg); }
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes fade-in-out {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}
</style>
