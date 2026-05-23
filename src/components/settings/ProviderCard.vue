<template>
  <button
    class="provider-card"
    :class="{ active }"
    @click="$emit('select')"
  >
    <div class="provider-name">{{ provider.name }}</div>
    <div class="provider-status">
      <span v-if="hasKey" class="status-dot green" />
      <span v-else class="status-dot gray" />
      {{ hasKey ? $t('settings.configured') : $t('settings.notConfigured') }}
    </div>
    <div v-if="maskedKey" class="provider-key">{{ maskedKey }}</div>
  </button>
</template>

<script setup lang="ts">
import type { ProviderInfo } from '@/types'

defineProps<{
  provider: ProviderInfo
  active: boolean
  hasKey: boolean
  maskedKey?: string
}>()

defineEmits<{ select: [] }>()
</script>

<style scoped>
.provider-card {
  text-align: left;
  padding: 14px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text);
}
.provider-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.provider-card.active {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
  box-shadow: 0 2px 12px var(--color-accent-light);
}

.provider-name {
  font-size: 0.86rem;
  font-weight: 600;
  margin-bottom: 6px;
}

.provider-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.74rem;
  color: var(--color-text-muted);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.green { background: var(--color-success); box-shadow: 0 0 6px var(--color-success); }
.status-dot.gray { background: #9ca3af; }

.provider-key {
  margin-top: 6px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
</style>
