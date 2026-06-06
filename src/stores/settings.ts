// LLM 设置 Store——提供商选择、模型参数、API Key 状态、预设管理（多配置切换）。
// 预设持久化到 localStorage，Key 操作经 Rust 加密存储。
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ModelConfig, ModelPreset, ProviderInfo } from '@/types'
import { getSupportedProviders } from '@/commands/storage'
import { saveApiKey, getApiKeyMasked, hasApiKey, deleteApiKey } from '@/commands/keys'
import { useTemplateStore } from '@/stores/templates'

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
  // ===== 核心状态 =====
  const providers = ref<ProviderInfo[]>([])
  const presets = ref<ModelPreset[]>(loadPresets())
  const activePresetId = ref<string>(presets.value[0]?.id || '')
  const maskedKeys = ref<Record<string, string>>({})
  const keyStatus = ref<Record<string, boolean>>({})
  const connectionStatus = ref<string>('')

  // ===== 计算属性 =====
  /** 从活跃预设派生的模型配置——provider/model/api_base/temperature 等 */
  const modelConfig = computed<ModelConfig>(() => {
    const p = presets.value.find((x) => x.id === activePresetId.value)
    return p?.config || defaultConfig()
  })

  /** 含模板提示词覆盖的有效配置——system_prompt 由 Rust 端硬编码，模板提示词另行拼接 */
  const templateStore = useTemplateStore()
  const effectiveConfig = computed<ModelConfig>(() => {
    const base = modelConfig.value
    const activeTpl = templateStore.activeTemplate
    if (activeTpl && activeTpl.systemPrompt) {
      return { ...base, system_prompt: '' }
    }
    return base
  })

  /** 当前选中模板的 system 提示词 */
  const templateSystemPrompt = computed<string>(() => {
    const tpl = templateStore.activeTemplate
    return (tpl && tpl.systemPrompt) ? tpl.systemPrompt : ''
  })

  /** 当前 provider 的 ProviderInfo */
  const currentProvider = computed(() =>
    providers.value.find((p) => p.id === modelConfig.value.provider),
  )

  /** 当前活跃的预设对象 */
  const activePreset = computed(() =>
    presets.value.find((x) => x.id === activePresetId.value),
  )

  // ===== 默认配置 =====
  /** 返回系统硬编码的默认模型配置——provider=openai, model=gpt-4o */
  function defaultConfig(): ModelConfig {
    return {
      provider: 'openai',
      model: 'gpt-4o',
      api_base: 'https://api.openai.com/v1',
      temperature: 0.7,
      max_tokens: 8192,
      system_prompt: '',
    }
  }

  /** 从 Rust 后端加载所有支持的 LLM 提供商列表 */
  async function loadProviders() {
    providers.value = await getSupportedProviders()
  }

  // ===== 预设 CRUD =====
  /** 切换到指定预设 */
  function selectPreset(id: string) {
    activePresetId.value = id
  }

  /** 创建新预设——复制当前配置，命名格式"配置 N" */
  function createPreset(name?: string): ModelPreset {
    const preset: ModelPreset = {
      id: pid(),
      name: name || `配置 ${presets.value.length + 1}`,
      config: { ...modelConfig.value },
      providerConfigs: {},
    }
    presets.value.push(preset)
    activePresetId.value = preset.id
    persist()
    return preset
  }

  /** 保存当前配置到预设——同名覆盖或新增 */
  function saveCurrentAsPreset(name?: string): ModelPreset {
    const preset: ModelPreset = {
      id: pid(),
      name: name || `配置 ${presets.value.length + 1}`,
      config: { ...modelConfig.value },
      providerConfigs: {},
    }
    const activeP = activePreset.value
    if (activeP && (!name || name === activeP.name)) {
      Object.assign(activeP, preset)
      persist()
      return activeP
    }
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

  /** 删除预设——至少保留一个，删除当前活跃时自动切到首个 */
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

  /** 更新预设元信息 */
  function updatePreset(id: string, data: Partial<ModelPreset>) {
    const p = presets.value.find((x) => x.id === id)
    if (p) {
      if (data.name !== undefined) p.name = data.name
      if (data.config) Object.assign(p.config, data.config as ModelConfig)
      persist()
    }
  }

  /** 更新当前活跃配置——切换 provider 时自动存档旧 provider 的 model/api_base */
  function updateActiveConfig(partial: Partial<ModelConfig>) {
    const p = presets.value.find((x) => x.id === activePresetId.value)
    if (!p) return
    if (partial.provider && partial.provider !== p.config.provider) {
      p.providerConfigs ??= {}
      p.providerConfigs[p.config.provider] = {
        model: p.config.model,
        api_base: p.config.api_base,
      }
    }
    Object.assign(p.config, partial)
    persist()
  }

  // ===== API Key 管理 =====
  /** 刷新所有 provider 的 Key 状态和掩码显示 */
  async function refreshKeyStatus() {
    for (const p of providers.value) {
      keyStatus.value[p.id] = await hasApiKey(p.id)
      if (keyStatus.value[p.id]) {
        maskedKeys.value[p.id] = await getApiKeyMasked(p.id)
      }
    }
  }

  /** 保存当前 provider 的 API Key 到加密存储 */
  async function storeApiKey(apiKey: string) {
    await saveApiKey(modelConfig.value.provider, apiKey)
    await refreshKeyStatus()
  }

  /** 删除当前 provider 的 API Key */
  async function removeApiKey() {
    await deleteApiKey(modelConfig.value.provider)
    await refreshKeyStatus()
  }

  // ===== 持久化 =====
  /** 将预设列表写入 localStorage */
  function persist() {
    savePresetsToDisk(presets.value)
  }

  // 监听预设变更自动持久化（深度监听）
  watch(presets, () => persist(), { deep: true })

  // 确保至少有一个预设
  if (presets.value.length === 0) {
    createPreset('默认配置')
  }

  // ===== 导出 =====
  return {
    // 状态
    providers,
    presets,
    activePresetId,
    maskedKeys,
    keyStatus,
    connectionStatus,
    // 计算属性
    modelConfig,
    effectiveConfig,
    currentProvider,
    activePreset,
    // 预设管理
    loadProviders,
    selectPreset,
    createPreset,
    saveCurrentAsPreset,
    deletePreset,
    updateActiveConfig,
    updatePreset,
    // API Key
    refreshKeyStatus,
    storeApiKey,
    removeApiKey,
  }
})
