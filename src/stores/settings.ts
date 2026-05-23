import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ModelConfig, ModelPreset, ProviderInfo } from '@/types'
import {
  getSupportedProviders,
  saveApiKey,
  getApiKeyMasked,
  hasApiKey,
  deleteApiKey,
} from '@/commands/llm'

function pid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

const STORAGE_KEY = 'quillforge-presets'

function loadPresets(): ModelPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function savePresetsToDisk(presets: ModelPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export const useSettingsStore = defineStore('settings', () => {
  const providers = ref<ProviderInfo[]>([])
  const presets = ref<ModelPreset[]>(loadPresets())
  const activePresetId = ref<string>(presets.value[0]?.id || '')
  const maskedKeys = ref<Record<string, string>>({})
  const keyStatus = ref<Record<string, boolean>>({})
  const connectionStatus = ref<string>('')

  // Active config derived from active preset
  const modelConfig = computed<ModelConfig>(() => {
    const p = presets.value.find((x) => x.id === activePresetId.value)
    return p?.config || defaultConfig()
  })

  const currentProvider = computed(() =>
    providers.value.find((p) => p.id === modelConfig.value.provider),
  )

  const activePreset = computed(() =>
    presets.value.find((x) => x.id === activePresetId.value),
  )

  function defaultConfig(): ModelConfig {
    return {
      provider: 'openai',
      model: 'gpt-4o',
      api_base: 'https://api.openai.com/v1',
      temperature: 0.7,
      max_tokens: 2048,
      system_prompt: '',
    }
  }

  async function loadProviders() {
    providers.value = await getSupportedProviders()
  }

  // ── Presets ──
  function selectPreset(id: string) {
    activePresetId.value = id
  }

  function createPreset(name?: string): ModelPreset {
    const preset: ModelPreset = {
      id: pid(),
      name: name || `配置 ${presets.value.length + 1}`,
      config: { ...modelConfig.value },
    }
    presets.value.push(preset)
    activePresetId.value = preset.id
    persist()
    return preset
  }

  function saveCurrentAsPreset(name?: string): ModelPreset {
    const preset: ModelPreset = {
      id: pid(),
      name: name || `配置 ${presets.value.length + 1}`,
      config: { ...modelConfig.value },
    }
    // Replace existing preset with same name
    const idx = presets.value.findIndex((x) => x.name === preset.name)
    if (idx >= 0) {
      presets.value[idx] = preset
      activePresetId.value = preset.id
    } else {
      presets.value.push(preset)
      activePresetId.value = preset.id
    }
    persist()
    return preset
  }

  function deletePreset(id: string) {
    if (presets.value.length <= 1) return
    const idx = presets.value.findIndex((x) => x.id === id)
    if (idx === -1) return
    presets.value.splice(idx, 1)
    if (activePresetId.value === id) {
      activePresetId.value = presets.value[0]?.id || ''
    }
    persist()
  }

  function updatePreset(id: string, data: Partial<ModelPreset>) {
    const p = presets.value.find((x) => x.id === id)
    if (p) {
      if (data.name !== undefined) p.name = data.name
      if (data.config) Object.assign(p.config, data.config as ModelConfig)
      persist()
    }
  }

  function updateActiveConfig(partial: Partial<ModelConfig>) {
    const p = presets.value.find((x) => x.id === activePresetId.value)
    if (p) {
      Object.assign(p.config, partial)
      persist()
    }
  }

  // ── API Keys ──
  async function refreshKeyStatus() {
    for (const p of providers.value) {
      keyStatus.value[p.id] = await hasApiKey(p.id)
      if (keyStatus.value[p.id]) {
        maskedKeys.value[p.id] = await getApiKeyMasked(p.id)
      }
    }
  }

  async function storeApiKey(apiKey: string) {
    await saveApiKey(modelConfig.value.provider, apiKey)
    await refreshKeyStatus()
  }

  async function removeApiKey() {
    await deleteApiKey(modelConfig.value.provider)
    await refreshKeyStatus()
  }

  function persist() {
    savePresetsToDisk(presets.value)
  }

  // Auto-persist
  watch(presets, () => persist(), { deep: true })

  // Ensure at least one preset
  if (presets.value.length === 0) {
    createPreset('默认配置')
  }

  return {
    providers,
    presets,
    activePresetId,
    modelConfig,
    maskedKeys,
    keyStatus,
    connectionStatus,
    currentProvider,
    activePreset,
    loadProviders,
    selectPreset,
    createPreset,
    saveCurrentAsPreset,
    deletePreset,
    updateActiveConfig,
    refreshKeyStatus,
    storeApiKey,
    removeApiKey,
    updatePreset,
  }
})
