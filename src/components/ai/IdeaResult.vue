<template>
  <div class="action-panel">
    <div class="action-info">
      <p>{{ $t('ai.ideaHint') }}</p>
    </div>

    <textarea
      v-model="ideaInput"
      class="idea-input"
      :placeholder="$t('ai.ideaPlaceholder')"
      rows="4"
    />

    <button
      class="btn-action"
      :disabled="!ideaInput.trim() || editorStore.isLoading"
      @click="doIdea"
    >
      <LoadingDots v-if="editorStore.isLoading" />
      <template v-else>&#128161; {{ $t('ai.ideaBtn') }}</template>
    </button>

    <div v-if="editorStore.isLoading" class="idea-loading">
      <div class="idea-loading-bulb">&#128161;</div>
      <div class="idea-loading-label">{{ $t('ai.ideaLloading') }}</div>
      <div class="idea-sparks">
        <span class="spark" :style="{ animationDelay: '0s' }">&#10022;</span>
        <span class="spark" :style="{ animationDelay: '0.3s' }">&#10022;</span>
        <span class="spark" :style="{ animationDelay: '0.6s' }">&#10022;</span>
        <span class="spark" :style="{ animationDelay: '0.9s' }">&#10022;</span>
        <span class="spark" :style="{ animationDelay: '1.2s' }">&#10022;</span>
      </div>
    </div>

    <div v-if="editorStore.error" class="result-error">{{ editorStore.error }}</div>

    <div v-if="editorStore.activeResult && !editorStore.isLoading" class="result-box markdown-body" v-html="renderedResult" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/llm'
import LoadingDots from '@/components/common/LoadingDots.vue'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()
const ideaInput = ref('')

const renderedResult = computed(() => {
  return editorStore.activeResult
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
})

function buildBookContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  return [
    book.worldSetting ? `【世界观】${book.worldSetting}` : '',
    book.storySetting ? `【剧情总结】${book.storySetting}` : '',
    ...book.characters.filter((c) => c.name && c.description).map(
      (c) => `【角色·${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : '配角'}】${c.name}：${c.description}`,
    ),
    editorStore.content.replace(/<[^>]*>/g, '').slice(-500) ? `【近文上下文】${editorStore.content.replace(/<[^>]*>/g, '').slice(-500)}` : '',
  ].filter(Boolean).join('\n')
}

async function doIdea() {
  if (!ideaInput.value.trim()) return
  editorStore.setLoading(true)
  editorStore.setError('')
  editorStore.setAiResult('')
  try {
    const result = await sendAiMessage(settingsStore.modelConfig, {
      action: 'idea',
      content: ideaInput.value,
      context: buildBookContext(),
    })
    editorStore.setAiResult(result)
  } catch (e: any) {
    editorStore.setError(e.toString())
  } finally {
    editorStore.setLoading(false)
  }
}
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

.idea-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.84rem;
  line-height: 1.55;
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.idea-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.idea-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.55;
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

.result-box {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  font-size: 0.84rem;
  line-height: 1.7;
  color: var(--color-text);
}

.idea-loading {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.idea-loading-bulb {
  font-size: 1.8rem;
  animation: bulb-glow 1s ease-in-out infinite;
}

.idea-loading-label {
  font-size: 0.78rem;
  color: var(--color-accent);
  font-weight: 600;
}

.idea-sparks {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.spark {
  font-size: 0.7rem;
  color: var(--color-accent);
  opacity: 0;
  animation: spark-pop 1.5s ease-in-out infinite;
}

@keyframes bulb-glow {
  0%, 100% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.15); filter: brightness(1.4); }
}

@keyframes spark-pop {
  0% { opacity: 0; transform: translateY(0) scale(0.5); }
  20% { opacity: 1; transform: translateY(-6px) scale(1); }
  40% { opacity: 0; transform: translateY(-12px) scale(0.5); }
  100% { opacity: 0; transform: translateY(0) scale(0.5); }
}
</style>
