<template>
  <Teleport to="body">
    <div class="dialog-overlay" @click.self="onCancel">
      <div class="dialog" @click.stop>
        <!-- Header with gradient accent -->
        <div class="dialog-header">
          <div class="header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="8" y1="7" x2="16" y2="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <h2>{{ t('book.createBook') }}</h2>
          <button class="dialog-close" @click="onCancel" :title="t('common.close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Mode selector: pill toggle -->
        <div class="mode-selector">
          <button
            class="mode-option"
            :class="{ active: mode === 'manual' }"
            @click="switchMode('manual')"
          >
            <svg class="mode-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>{{ t('book.manualCreate') }}</span>
          </button>
          <button
            class="mode-option"
            :class="{ active: mode === 'ai' }"
            @click="switchMode('ai')"
          >
            <svg class="mode-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            <span>{{ t('book.aiCreate') }}</span>
          </button>
        </div>

        <!-- Content area with transition -->
        <div class="dialog-body">
          <!-- Manual Mode -->
          <Transition name="fade-slide" mode="out-in">
            <div v-if="mode === 'manual'" key="manual" class="mode-content">
              <div class="manual-illustration">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <p class="mode-hint">{{ t('book.manualHint') }}</p>
              <div class="input-wrapper">
                <input
                  ref="manualInput"
                  v-model="manualTitle"
                  class="modern-input"
                  :placeholder="t('book.titlePlaceholder')"
                  @keydown.enter="onConfirm"
                />
                <div class="input-glow"></div>
              </div>
            </div>
          </Transition>

          <!-- AI Mode -->
          <Transition name="fade-slide" mode="out-in">
            <div v-if="mode === 'ai'" key="ai" class="mode-content">
              <!-- Step 1: User input prompt -->
              <div v-if="!generated" class="ai-step">
                <div class="ai-step-header">
                  <div class="ai-step-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="16 3 21 3 21 8" />
                      <line x1="4" y1="20" x2="21" y2="3" />
                      <polyline points="21 16 21 21 16 21" />
                      <line x1="15" y1="15" x2="21" y2="21" />
                      <line x1="4" y1="4" x2="9" y2="9" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="ai-step-title">{{ t('book.aiPromptTitle') }}</h3>
                    <p class="ai-step-desc">{{ t('book.aiHint') }}</p>
                  </div>
                </div>
                <div class="textarea-wrapper">
                  <textarea
                    v-model="aiPrompt"
                    class="modern-textarea"
                    :placeholder="t('book.aiPromptPlaceholder')"
                    rows="5"
                  ></textarea>
                  <div class="textarea-focus-ring"></div>
                </div>
                <button
                  class="btn-generate"
                  :disabled="generating || !aiPrompt.trim()"
                  @click="onGenerate"
                >
                  <!-- Sparkle icon -->
                  <svg v-if="!generating" class="btn-icon-left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                  <span v-if="generating" class="spinner"></span>
                  <span>{{ generating ? t('ai.generating') : t('book.aiGenerateBtn') }}</span>
                </button>
              </div>

              <!-- Step 2: Generated preview -->
              <div v-else class="ai-step">
                <div class="result-header">
                  <div class="result-header-left">
                    <div class="success-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="ai-step-title">{{ t('book.generatedTitle') }}</h3>
                      <p class="ai-step-desc">{{ t('book.generatedHint') }}</p>
                    </div>
                  </div>
                  <button class="btn-regenerate-icon" :disabled="generating" @click="onGenerate" :title="t('ai.regenerate')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                </div>

                <div class="result-cards">
                  <!-- Title -->
                  <div class="result-card">
                    <div class="result-card-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{{ t('book.title') }}</span>
                    </div>
                    <input v-model="editedBook.title" class="card-input" />
                  </div>

                  <!-- Description -->
                  <div class="result-card">
                    <div class="result-card-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{{ t('book.description') }}</span>
                    </div>
                    <textarea v-model="editedBook.description" class="card-textarea" rows="2"></textarea>
                  </div>

                  <!-- World Setting -->
                  <div class="result-card">
                    <div class="result-card-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <span>{{ t('book.worldSetting') }}</span>
                    </div>
                    <textarea v-model="editedBook.world_setting" class="card-textarea" rows="3"></textarea>
                  </div>

                  <!-- Characters -->
                  <div v-if="editedBook.characters.length > 0" class="result-card">
                    <div class="result-card-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>{{ t('book.generatedCharacters') }}</span>
                      <span class="badge-count">{{ editedBook.characters.length }}</span>
                    </div>
                    <div class="char-grid">
                      <div v-for="(ch, idx) in editedBook.characters" :key="idx" class="char-card">
                        <div class="char-avatar" :style="{ background: roleColor(ch.role) }">
                          {{ ch.name.charAt(0) }}
                        </div>
                        <div class="char-info">
                          <div class="char-name">{{ ch.name }}</div>
                          <span class="char-role-tag" :style="{ background: roleColor(ch.role) + '22', color: roleColor(ch.role) }">
                            {{ ch.role }}
                          </span>
                          <div class="char-desc">{{ ch.description }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Footer -->
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="onCancel">{{ t('common.cancel') }}</button>
          <button
            class="btn btn-confirm"
            :disabled="!canConfirm"
            @click="onConfirm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {{ t('book.createBookBtn') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { generateBookInfo } from '@/commands/ai'
import type { GeneratedBookInfo } from '@/types'

const emit = defineEmits<{
  confirm: [value: { title: string; description?: string; worldSetting?: string; characters?: Array<{ name: string; role: string; description: string }> }]
  cancel: []
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

const mode = ref<'manual' | 'ai'>('manual')
const manualTitle = ref('')
const aiPrompt = ref('')
const generating = ref(false)
const generated = ref(false)
const editedBook = ref<GeneratedBookInfo>({
  title: '',
  description: '',
  world_setting: '',
  story_setting: '',
  characters: [],
})

const manualInput = ref<HTMLInputElement | null>(null)

const canConfirm = computed(() => {
  if (mode.value === 'manual') return manualTitle.value.trim().length > 0
  if (mode.value === 'ai' && !generated.value) return false
  return editedBook.value.title.trim().length > 0
})

const roleColors: Record<string, string> = {
  '主角': 'var(--color-accent)',
  '配角': '#6366f1',
  '反派': '#ef4444',
  '路人': '#6b7280',
}

function roleColor(role: string): string {
  return roleColors[role] || 'var(--color-accent)'
}

function switchMode(newMode: 'manual' | 'ai') {
  mode.value = newMode
  if (newMode === 'manual') {
    nextTick(() => manualInput.value?.focus())
  }
}

async function onGenerate() {
  if (!aiPrompt.value.trim() || generating.value) return

  generating.value = true
  try {
    const result = await generateBookInfo(aiPrompt.value.trim(), settingsStore.modelConfig)
    editedBook.value = result
    generated.value = true
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    alert(t('book.aiGenerateFailed') + '\n' + msg)
  } finally {
    generating.value = false
  }
}

function onConfirm() {
  if (mode.value === 'manual') {
    emit('confirm', { title: manualTitle.value.trim() })
  } else {
    emit('confirm', {
      title: editedBook.value.title.trim() || t('book.defaultBookName'),
      description: editedBook.value.description,
      worldSetting: editedBook.value.world_setting,
      characters: editedBook.value.characters.map((c) => ({
        name: c.name,
        role: c.role,
        description: c.description,
      })),
    })
  }
}

function onCancel() {
  emit('cancel')
}

onMounted(() => {
  nextTick(() => manualInput.value?.focus())
})
</script>

<style scoped>
/* ── Overlay ── */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: overlayIn 0.2s ease;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ── Dialog ── */
.dialog {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dialogIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ── Header ── */
.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--color-border);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent));
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 3px 10px var(--color-accent-light);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--color-text);
  flex: 1;
}

.dialog-close {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.dialog-close:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

/* ── Mode Selector ── */
.mode-selector {
  display: flex;
  gap: 3px;
  margin: 12px 22px 0;
  padding: 3px;
  background: var(--color-bg);
  border-radius: 10px;
  border: 1px solid var(--color-border);
}

.mode-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-option:hover {
  color: var(--color-text);
  background: var(--color-hover);
}

.mode-option.active {
  background: var(--color-surface);
  color: var(--color-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.mode-icon {
  flex-shrink: 0;
}

/* ── Body ── */
.dialog-body {
  padding: 16px 22px 18px;
  overflow-y: auto;
  flex: 1;
}

.mode-content {
  min-height: 180px;
}

/* ── Manual Mode ── */
.manual-illustration {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
  padding-top: 4px;
}

.mode-hint {
  text-align: center;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0 0 14px 0;
  line-height: 1.5;
}

.input-wrapper {
  position: relative;
}

.modern-input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  font-family: inherit;
}

.modern-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.modern-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

/* ── AI Mode ── */
.ai-step-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}

.ai-step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--color-accent-light);
  flex-shrink: 0;
}

.ai-step-title {
  margin: 0 0 2px 0;
  font-size: 0.88rem;
  font-weight: 620;
  color: var(--color-text);
}

.ai-step-desc {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.textarea-wrapper {
  position: relative;
  margin-bottom: 14px;
}

.modern-textarea {
  width: 100%;
  padding: 11px 14px;
  border: 2px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.85rem;
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  min-height: 100px;
}

.modern-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.modern-textarea::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

/* ── Generate Button ── */
.btn-generate {
  width: 100%;
  padding: 11px 18px;
  border: none;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent));
  color: #fff;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 620;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 3px 12px var(--color-accent-light);
  position: relative;
  overflow: hidden;
}

.btn-generate::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.12) 100%);
  pointer-events: none;
}

.btn-generate:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--color-accent-light);
}

.btn-generate:active:not(:disabled) {
  transform: translateY(0);
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon-left {
  flex-shrink: 0;
}

/* ── Result Header ── */
.result-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.result-header-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
}

.success-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #10b981;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-regenerate-icon {
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.btn-regenerate-icon:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
}

.btn-regenerate-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Result Cards ── */
.result-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--color-bg);
  transition: border-color 0.15s ease;
}

.result-card:focus-within {
  border-color: var(--color-accent);
}

.result-card-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 0.65rem;
  font-weight: 600;
  margin-left: auto;
}

.card-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 550;
  outline: none;
  transition: all 0.15s ease;
  box-sizing: border-box;
  font-family: inherit;
}

.card-input:focus {
  border-color: var(--color-accent);
  background: var(--color-bg);
}

.card-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.82rem;
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.card-textarea:focus {
  border-color: var(--color-accent);
  background: var(--color-bg);
}

/* ── Character Grid ── */
.char-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
}

.char-card {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  transition: border-color 0.15s ease;
}

.char-card:hover {
  border-color: var(--color-accent);
}

.char-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.char-info {
  flex: 1;
  min-width: 0;
}

.char-name {
  font-size: 0.82rem;
  font-weight: 620;
  color: var(--color-text);
  margin-bottom: 2px;
}

.char-role-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 0.62rem;
  font-weight: 550;
  margin-bottom: 3px;
}

.char-desc {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* ── Footer ── */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 22px 16px;
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: 9px 20px;
  border: none;
  border-radius: 9px;
  font-size: 0.82rem;
  font-weight: 570;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-cancel {
  background: var(--color-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.btn-cancel:hover {
  background: var(--color-hover);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.btn-confirm {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent));
  color: #fff;
  box-shadow: 0 2px 10px var(--color-accent-light);
  position: relative;
  overflow: hidden;
}

.btn-confirm::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.1) 100%);
  pointer-events: none;
}

.btn-confirm:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 16px var(--color-accent-light);
}

.btn-confirm:active:not(:disabled) {
  transform: translateY(0);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Transitions ── */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Spinner ── */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
