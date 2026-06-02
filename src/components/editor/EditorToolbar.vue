<template>
  <div class="toolbar">
    <div class="toolbar-group toolbar-left">
      <button
        class="panel-btn sidebar-btn"
        :class="{ collapsed: sidebarCollapsed }"
        :title="'侧边栏 (Ctrl+Shift+B)'"
        @click="$emit('toggleSidebar')"
      >
        <span class="hamburger">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </span>
      </button>
      <button
        class="toolbar-btn"
        :title="$t('search.title')"
        @click="$emit('openSearch')"
      >
        &#128269; {{ $t('search.title') }}
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: agentsVisible }"
        :title="$t('agents.title')"
        @click="$emit('toggleAgents')"
      >
        &#9881; CLI
      </button>
    </div>
    <div class="toolbar-group toolbar-right">
      <button
        class="panel-btn ai-panel-btn"
        :class="{ collapsed: aiPanelCollapsed }"
        :title="'AI面板 (Ctrl+Shift+P)'"
        @click="$emit('toggleAiPanel')"
      >
        <span class="ai-indicator"></span>
        <span class="ai-btn-label">AI</span>
      </button>
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

defineProps<{
  agentsVisible?: boolean
  sidebarCollapsed?: boolean
  aiPanelCollapsed?: boolean
}>()

defineEmits<{
  openSettings: []
  openSearch: []
  toggleAgents: []
  toggleSidebar: []
  toggleAiPanel: []
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
  padding: 6px 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  gap: 2px;
  backdrop-filter: blur(8px);
}

.toolbar-group {
  display: flex;
  gap: 2px;
  align-items: center;
}

.toolbar-left {
  margin-right: auto;
}

.toolbar-right {
  margin-left: auto;
}

.toolbar-btn {
  padding: 6px 12px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.82rem;
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

/* ── Panel Buttons ── */
.panel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: calc(var(--radius-sm) + 1px);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.18s ease;
  outline: none;
  position: relative;
}
.panel-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.panel-btn.collapsed {
  border-color: transparent;
  background: transparent;
  opacity: 0.5;
}
.panel-btn.collapsed:hover {
  opacity: 0.85;
  border-color: var(--color-border);
  background: var(--color-hover);
  box-shadow: none;
  color: var(--color-text-muted);
}

/* ── Sidebar hamburger ── */
.hamburger {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 2px 0;
}
.hamburger-line {
  display: block;
  width: 16px;
  height: 2px;
  background: currentColor;
  border-radius: 2px;
  transition: all 0.25s ease;
  transform-origin: center;
}
.hamburger-line:nth-child(2) { width: 12px; }
.hamburger-line:nth-child(3) { width: 8px; }

.sidebar-btn.collapsed .hamburger-line {
  width: 16px;
}
.sidebar-btn.collapsed .hamburger-line:nth-child(1) {
  transform: translateY(5px) rotate(45deg);
  width: 16px;
}
.sidebar-btn.collapsed .hamburger-line:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}
.sidebar-btn.collapsed .hamburger-line:nth-child(3) {
  transform: translateY(-5px) rotate(-45deg);
  width: 16px;
}

/* ── AI panel button ── */
.ai-panel-btn {
  gap: 6px;
  padding: 6px 14px 6px 12px;
}
.ai-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent-light);
  transition: all 0.25s ease;
}
.ai-panel-btn.collapsed .ai-indicator {
  background: var(--color-text-muted);
  box-shadow: none;
}
.ai-btn-label {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.5px;
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
