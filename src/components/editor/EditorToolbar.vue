<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        :title="$t('search.title')"
        @click="$emit('openSearch')"
      >
        &#128269; {{ $t('search.title') }}
      </button>
    </div>
    <div class="toolbar-group toolbar-right">
      <select class="model-select" :value="settingsStore.activePresetId" @change="settingsStore.selectPreset(($event.target as HTMLSelectElement).value)">
        <option v-for="p in settingsStore.presets" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
      <button class="toolbar-btn" :title="$t('common.theme') + (themeStore.theme === 'dark' ? $t('common.themeLight') : $t('common.themeDark'))" @click="themeStore.toggle()">
        {{ themeStore.theme === 'dark' ? '☀' : '☾' }}
      </button>
      <select class="lang-select" :value="i18nStore.locale" @change="onLangChange">
        <option value="zh-CN">{{ $t('common.langZh') }}</option>
        <option value="en-US">{{ $t('common.langEn') }}</option>
      </select>
      <button class="toolbar-btn" :title="$t('settings.title')" @click="$emit('openSettings')">
        &#9881; {{ $t('settings.title') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { useI18nStore } from '@/stores/i18n'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits<{
  openSettings: []
  openSearch: []
}>()

const { locale } = useI18n()
const themeStore = useThemeStore()
const i18nStore = useI18nStore()
const settingsStore = useSettingsStore()

function onLangChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value as 'zh-CN' | 'en-US'
  i18nStore.setLocale(val)
  locale.value = val
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  gap: 4px;
  backdrop-filter: blur(8px);
}

.toolbar-group {
  display: flex;
  gap: 2px;
  align-items: center;
}

.toolbar-right {
  margin-left: auto;
}

.toolbar-btn {
  padding: 7px 14px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.toolbar-btn.active {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
  box-shadow: 0 2px 8px var(--color-accent-light);
}

.model-select {
  padding: 6px 26px 6px 10px;
  border: 1px solid var(--color-accent-light);
  border-radius: var(--radius-sm);
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%236366f1' d='M2.5 3.5l2.5 3 2.5-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: all var(--transition-fast);
  max-width: 120px;
}
.model-select option {
  background: var(--color-surface);
  color: var(--color-text);
}

.lang-select {
  padding: 6px 26px 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%238888a8' d='M2.5 3.5l2.5 3 2.5-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: all var(--transition-fast);
}

.lang-select:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.lang-select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.lang-select option {
  background: var(--color-surface);
  color: var(--color-text);
  padding: 8px;
}
</style>
