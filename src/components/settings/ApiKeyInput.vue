<template>
  <div class="apikey-input">
    <div class="input-row">
      <input
        ref="inputRef"
        v-model="localKey"
        type="password"
        class="key-input"
        :placeholder="$t('settings.keyPlaceholder')"
        @keydown.enter="onSave"
      />
      <button class="btn-save" :disabled="!localKey.trim()" @click="onSave">
        {{ $t('settings.save') }}
      </button>
    </div>
    <div v-if="hasKey" class="key-status">
      <span class="status-dot green" />
      {{ $t('settings.configured') }} {{ maskedKey }}
      <button class="btn-delete" @click="onDelete">{{ $t('settings.delete') }}</button>
    </div>
    <div v-else class="key-status hint">
      <span class="status-dot gray" />
      {{ $t('settings.keyHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

const props = defineProps<{
  providerName: string
  maskedKey?: string
  hasKey: boolean
}>()

const emit = defineEmits<{
  save: [key: string]
  delete: []
}>()

const localKey = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function onSave() {
  if (localKey.value.trim()) {
    emit('save', localKey.value.trim())
    localKey.value = ''
  }
}

function onDelete() {
  emit('delete')
}
</script>

<style scoped>
.apikey-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.key-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.84rem;
  outline: none;
  font-family: var(--font-mono);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.key-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.btn-save {
  padding: 8px 18px;
  border: none;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px var(--color-accent-light);
}
.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px var(--color-accent-light);
}

.key-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.key-status.hint {
  line-height: 1.55;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.green { background: var(--color-success); box-shadow: 0 0 6px var(--color-success); }
.status-dot.gray { background: #9ca3af; }

.btn-delete {
  margin-left: 4px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-danger);
  cursor: pointer;
  font-size: 0.76rem;
  padding: 3px 8px;
  font-weight: 500;
  transition: all var(--transition-fast);
}
.btn-delete:hover {
  background: var(--color-danger-bg);
}
</style>
