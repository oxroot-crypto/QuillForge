<template>
  <div class="titlebar">
    <div class="titlebar-left" data-tauri-drag-region>
      <span class="titlebar-icon">&#9998;</span>
      <span class="titlebar-title">QuillForge</span>
    </div>

    <div v-if="winRef" class="titlebar-controls">
      <button class="ctrl-btn ctrl-min" title="最小化" @click="winRef.minimize()">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor"/></svg>
      </button>
      <button v-if="!isMaximized" class="ctrl-btn ctrl-max" title="最大化" @click="winRef.toggleMaximize()">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
      <button v-else class="ctrl-btn ctrl-max" title="还原" @click="winRef.toggleMaximize()">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="3" width="8" height="8" fill="var(--color-surface)" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
      <button class="ctrl-btn ctrl-close" title="关闭" @click="winRef.close()">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const winRef = ref<{
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onResized: (fn: () => void) => Promise<() => void>
} | null>(null)
const isMaximized = ref(false)

onMounted(async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const w = getCurrentWindow()
    winRef.value = w
    isMaximized.value = await w.isMaximized()
    await w.onResized(async () => {
      isMaximized.value = await w.isMaximized()
    })
  } catch {
    // Not running inside Tauri webview — hide window controls
  }
})
</script>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.titlebar-icon {
  font-size: 1rem;
  opacity: 0.7;
}

.titlebar-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.8;
}

.titlebar-controls {
  display: flex;
  gap: 2px;
}

.ctrl-btn {
  width: 34px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}
.ctrl-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}
.ctrl-close:hover {
  background: var(--color-danger);
  color: #fff;
}
</style>
