<template>
  <div class="settings-panel">
    <!-- World Setting -->
    <div class="field">
      <div class="field-header">
        <label>{{ $t('book.worldSetting') }}</label>
        <button class="btn-ai" :disabled="genLoading === 'world'" @click="startGen('world')">
          {{ genLoading === 'world' ? '...' : 'AI' }}
        </button>
      </div>
      <p class="field-hint">{{ $t('book.worldSettingHint') }}</p>
      <div v-if="genActive === 'world'" class="gen-row">
        <input
          v-model="genPrompt"
          class="gen-input"
          :placeholder="$t('book.genSettingPlaceholder')"
          @keydown.enter="doGenerate('world')"
        />
        <button class="btn-gen-go" :disabled="genLoading === 'world'" @click="doGenerate('world')">
          {{ $t('book.generate') }}
        </button>
      </div>
      <textarea
        :value="book.worldSetting"
        class="field-textarea"
        rows="6"
        :placeholder="$t('book.worldSettingPlaceholder')"
        @input="emit('update', { worldSetting: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>

    <!-- Story Setting -->
    <div class="field">
      <div class="field-header">
        <label>{{ $t('book.storySetting') }}</label>
        <button class="btn-ai" :disabled="genLoading === 'story'" @click="startGen('story')">
          {{ genLoading === 'story' ? '...' : 'AI' }}
        </button>
      </div>
      <p class="field-hint">{{ $t('book.storySettingHint') }}</p>
      <div v-if="genActive === 'story'" class="gen-row">
        <input
          v-model="genPrompt"
          class="gen-input"
          :placeholder="$t('book.genSettingPlaceholder')"
          @keydown.enter="doGenerate('story')"
        />
        <button class="btn-gen-go" :disabled="genLoading === 'story'" @click="doGenerate('story')">
          {{ $t('book.generate') }}
        </button>
      </div>
      <textarea
        :value="book.storySetting"
        class="field-textarea"
        rows="6"
        :placeholder="$t('book.storySettingPlaceholder')"
        @input="emit('update', { storySetting: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { sendAiMessage } from '@/commands/llm'
import type { Book } from '@/types'

const props = defineProps<{ book: Book }>()
const emit = defineEmits<{ update: [data: Record<string, string>] }>()

const settingsStore = useSettingsStore()
const genActive = ref<string>('')
const genLoading = ref<string>('')
const genPrompt = ref('')

function startGen(field: string) {
  genActive.value = genActive.value === field ? '' : field
  genPrompt.value = ''
}

async function doGenerate(field: string) {
  genLoading.value = field
  try {
    const existing =
      field === 'world' ? props.book.storySetting : props.book.worldSetting
    const prompt = genPrompt.value.trim() || existing || props.book.title
    const result = await sendAiMessage(settingsStore.modelConfig, {
      action: 'gen_setting',
      content: prompt,
      context: existing || undefined,
    })
    const key = field === 'world' ? 'worldSetting' : 'storySetting'
    emit('update', { [key]: result })
    genActive.value = ''
    genPrompt.value = ''
  } catch (e: any) {
    alert(`AI generation failed: ${e}`)
  } finally {
    genLoading.value = ''
  }
}
</script>

<style scoped>
.settings-panel {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

.field {
  margin-bottom: 12px;
}

.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 1px;
}

.field-header label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-ai {
  padding: 2px 8px;
  border: 1px solid var(--color-accent);
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  transition: all var(--transition-fast);
}
.btn-ai:hover:not(:disabled) { background: var(--color-accent); color: #fff; }
.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }

.gen-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.gen-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.74rem;
  outline: none;
}

.btn-gen-go {
  padding: 4px 10px;
  border: none;
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
}
.btn-gen-go:disabled { opacity: 0.5; cursor: not-allowed; }

.field-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin: 0 0 6px;
  line-height: 1.45;
}

.field-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.78rem;
  line-height: 1.55;
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.field-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.field-textarea::placeholder {
  color: var(--color-text-muted);
  opacity: 0.5;
}
</style>
