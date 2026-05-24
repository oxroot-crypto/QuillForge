<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="onCancel">
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">{{ title }}</span>
        </div>

        <div class="modal-body">
          <input
            v-if="type === 'prompt'"
            ref="inputRef"
            v-model="inputValue"
            class="modal-input"
            :placeholder="placeholder"
            @keydown.enter="onConfirm"
          />
          <p v-else class="modal-message">{{ message }}</p>
        </div>

        <div class="modal-footer">
          <button v-if="type !== 'alert'" class="modal-btn modal-btn-cancel" @click="onCancel">
            {{ cancelText }}
          </button>
          <button class="modal-btn modal-btn-ok" @click="onConfirm">
            {{ okText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  type?: 'prompt' | 'confirm' | 'alert'
  title?: string
  message?: string
  placeholder?: string
  value?: string
  okText?: string
  cancelText?: string
}>(), {
  type: 'alert',
  title: '',
  message: '',
  placeholder: '',
  value: '',
  okText: '确定',
  cancelText: '取消',
})

const emit = defineEmits<{
  confirm: [value: string]
  cancel: []
  'update:visible': [visible: boolean]
}>()

const inputValue = ref(props.value)
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.visible, async (v) => {
  if (v && props.type === 'prompt') {
    inputValue.value = props.value
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})

function onConfirm() {
  emit('confirm', props.type === 'confirm' ? '' : inputValue.value)
  emit('update:visible', false)
}

function onCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-box {
  width: 380px;
  max-width: 90vw;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: modal-in 0.18s ease-out;
}

.modal-header {
  padding: 16px 20px 0;
}

.modal-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.modal-body {
  padding: 14px 20px;
}

.modal-message {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.modal-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.86rem;
  outline: none;
  box-shadow: 0 0 0 2px var(--color-accent-light);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 16px;
}

.modal-btn {
  padding: 7px 18px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.modal-btn-cancel {
  background: var(--color-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.modal-btn-cancel:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.modal-btn-ok {
  background: var(--color-accent);
  color: #fff;
  box-shadow: 0 2px 6px var(--color-accent-light);
}
.modal-btn-ok:hover {
  filter: brightness(1.1);
  box-shadow: 0 3px 10px var(--color-accent-light);
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(-8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
