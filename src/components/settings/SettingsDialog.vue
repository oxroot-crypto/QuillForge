<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="$emit('close')">
      <div class="dialog">
        <div class="dialog-header">
          <h2>&#9881; {{ $t('settings.title') }}</h2>
          <button class="btn-close" @click="$emit('close')">&times;</button>
        </div>

        <div class="dialog-body">
          <!-- Preset selector -->
          <div class="settings-section">
            <h3>Presets</h3>
            <div class="preset-row">
              <select
                class="param-select preset-select"
                :value="settingsStore.activePresetId"
                @change="settingsStore.selectPreset(($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="p in settingsStore.presets"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name }} &mdash; {{ p.config.provider }} / {{ p.config.model || '?' }}
                </option>
              </select>
              <button class="btn-preset" :title="$t('settings.newPreset')" @click="onNewPreset">+</button>
              <button class="btn-preset" :title="$t('settings.renamePreset')" @click="onRenamePreset">&#9998;</button>
              <button
                class="btn-preset btn-preset-del"
                :title="$t('settings.deletePreset')"
                :disabled="settingsStore.presets.length <= 1"
                @click="onDeletePreset"
              >&#128465;</button>
            </div>
            <p class="preset-hint">{{ $t('settings.presetHint') }}</p>
          </div>

          <div class="settings-section">
            <h3>{{ $t('settings.provider') }}</h3>
            <div class="provider-list">
              <ProviderCard
                v-for="provider in settingsStore.providers"
                :key="provider.id"
                :provider="provider"
                :active="settingsStore.modelConfig.provider === provider.id"
                :has-key="settingsStore.keyStatus[provider.id]"
                :masked-key="settingsStore.maskedKeys[provider.id]"
                @select="onSelectProvider(provider.id)"
              />
            </div>
          </div>

          <div class="settings-section">
            <h3>{{ $t('settings.apiKey') }}</h3>
            <ApiKeyInput
              v-if="settingsStore.currentProvider?.requires_api_key"
              :provider-name="settingsStore.currentProvider?.name || ''"
              :masked-key="settingsStore.maskedKeys[settingsStore.modelConfig.provider]"
              :has-key="settingsStore.keyStatus[settingsStore.modelConfig.provider]"
              @save="settingsStore.storeApiKey"
              @delete="settingsStore.removeApiKey"
            />
            <p v-else class="no-key-hint">
              {{ settingsStore.currentProvider?.name }} {{ $t('settings.noKeyHint') }}
            </p>
          </div>

          <div class="settings-section">
            <h3>{{ $t('settings.temperature') }} / {{ $t('settings.maxTokens') }}</h3>
            <div class="param-grid">
              <div class="param-item">
                <label>{{ $t('settings.model') }}</label>
                <input
                  v-if="isFreeModelInput"
                  class="param-input"
                  :value="settingsStore.modelConfig.model"
                  :placeholder="$t('settings.model')"
                  @input="settingsStore.updateActiveConfig({ model: ($event.target as HTMLInputElement).value })"
                />
                <select
                  v-else
                  :value="settingsStore.modelConfig.model"
                  class="param-select"
                  @change="settingsStore.updateActiveConfig({ model: ($event.target as HTMLSelectElement).value })"
                >
                  <option
                    v-for="m in settingsStore.currentProvider?.models || []"
                    :key="m"
                    :value="m"
                  >
                    {{ m }}
                  </option>
                </select>
              </div>

              <div class="param-item">
                <label>{{ $t('settings.apiBase') }}</label>
                <input
                  class="param-input"
                  :value="settingsStore.modelConfig.api_base"
                  placeholder="https://api.openai.com/v1"
                  @input="settingsStore.updateActiveConfig({ api_base: ($event.target as HTMLInputElement).value })"
                />
              </div>

              <div class="param-item">
                <label>Temperature ({{ settingsStore.modelConfig.temperature }})</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  :value="settingsStore.modelConfig.temperature"
                  class="param-slider"
                  @input="settingsStore.updateActiveConfig({ temperature: parseFloat(($event.target as HTMLInputElement).value) })"
                />
              </div>

              <div class="param-item">
                <label>{{ $t('settings.maxTokens') }}</label>
                <input
                  type="number"
                  class="param-input"
                  :value="settingsStore.modelConfig.max_tokens"
                  min="256"
                  max="32768"
                  @input="settingsStore.updateActiveConfig({ max_tokens: parseInt(($event.target as HTMLInputElement).value) || 2048 })"
                />
              </div>

              <div class="param-item param-full">
                <label>{{ $t('settings.systemPrompt') }}</label>
                <textarea
                  class="param-textarea"
                  :value="settingsStore.modelConfig.system_prompt"
                  rows="3"
                  :placeholder="$t('settings.systemPromptPlaceholder')"
                  @input="settingsStore.updateActiveConfig({ system_prompt: ($event.target as HTMLTextAreaElement).value })"
                />
              </div>
            </div>
          </div>

          <div class="settings-section">
            <button class="btn-test" @click="testConnection">
              &#128268; {{ $t('settings.testConn') }}
            </button>
            <span v-if="settingsStore.connectionStatus" class="conn-status">
              {{ settingsStore.connectionStatus }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { checkProviderConnection } from '@/commands/llm'
import ProviderCard from './ProviderCard.vue'
import ApiKeyInput from './ApiKeyInput.vue'

defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

const isFreeModelInput = computed(() =>
  settingsStore.modelConfig.provider === 'openai_compat' || settingsStore.modelConfig.provider === 'ollama'
)

function onSelectProvider(providerId: string) {
  const provider = settingsStore.providers.find((p) => p.id === providerId)
  settingsStore.updateActiveConfig({
    provider: providerId,
    api_base: provider?.default_api_base || 'http://localhost:8000/v1',
    model: provider?.models?.[0] || '',
  })
}

function onNewPreset() {
  const name = prompt(t('settings.newPresetPrompt'), '')
  if (name) settingsStore.createPreset(name)
}

function onRenamePreset() {
  const current = settingsStore.activePreset
  if (!current) return
  const name = prompt(t('settings.renamePresetPrompt'), current.name)
  if (name) settingsStore.updatePreset(current.id, { name })
}

function onDeletePreset() {
  if (settingsStore.presets.length <= 1) return
  const current = settingsStore.activePreset
  if (!current) return
  if (confirm(t('settings.deletePresetConfirm', { name: current.name }))) {
    settingsStore.deletePreset(settingsStore.activePresetId)
  }
}

async function testConnection() {
  settingsStore.connectionStatus = t('settings.testing')
  try {
    const msg = await checkProviderConnection(settingsStore.modelConfig)
    settingsStore.connectionStatus = msg
  } catch (e: any) {
    settingsStore.connectionStatus = `Connection failed: ${e}`
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  width: 580px;
  max-height: 80vh;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-border);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
}

.btn-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 1.2rem;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.btn-close:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h3 {
  margin: 0 0 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provider-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.no-key-hint {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.preset-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.preset-select {
  flex: 1;
}

.btn-preset {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}
.btn-preset:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.btn-preset-del:hover:not(:disabled) { border-color: var(--color-danger); color: var(--color-danger); }

.preset-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin: 6px 0 0;
  line-height: 1.4;
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-item label {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.param-full {
  grid-column: 1 / -1;
}

.param-input,
.param-select {
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.84rem;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.param-input:focus,
.param-select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.param-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%238888a8' d='M2.5 3.5l2.5 3 2.5-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.param-textarea {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.82rem;
  outline: none;
  resize: vertical;
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.param-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.btn-test {
  padding: 8px 18px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}
.btn-test:hover {
  border-color: var(--color-accent);
  background: var(--color-hover);
}

.conn-status {
  margin-left: 12px;
  font-size: 0.82rem;
  color: var(--color-accent);
  font-weight: 500;
}
</style>
