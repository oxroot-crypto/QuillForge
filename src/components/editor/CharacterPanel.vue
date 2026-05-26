<template>
  <div class="character-panel">
    <div class="char-list">
      <div
        v-for="char in characters"
        :key="char.id"
        class="char-card"
        :class="{ expanded: expandedId === char.id }"
      >
        <div class="char-summary" @click="toggle(char.id)">
          <div class="char-main">
            <span class="char-name">{{ char.name || $t('book.notNamed') }}</span>
            <span class="char-role">{{ roleLabel(char.role) }}</span>
          </div>
          <button class="btn-delete-char" @click.stop="emit('delete', char.id)">&times;</button>
        </div>

        <div v-if="expandedId === char.id" class="char-detail">
          <div class="detail-field">
            <label>{{ $t('book.characterName') }}</label>
            <input
              :value="char.name"
              class="detail-input"
              :placeholder="$t('book.characterName')"
              @input="emitUpdate(char.id, 'name', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="detail-field">
            <label>{{ $t('book.characterRole') }}</label>
            <select
              :value="char.role"
              class="detail-select"
              @change="emitUpdate(char.id, 'role', ($event.target as HTMLSelectElement).value)"
            >
              <option value="protagonist">{{ $t('book.roles.protagonist') }}</option>
              <option value="supporting">{{ $t('book.roles.supporting') }}</option>
              <option value="antagonist">{{ $t('book.roles.antagonist') }}</option>
              <option value="background">{{ $t('book.roles.background') }}</option>
            </select>
          </div>
          <div class="detail-field">
            <label>{{ $t('book.characterDesc') }}</label>
            <textarea
              :value="char.description"
              class="detail-textarea"
              rows="4"
              :placeholder="$t('book.characterDescPlaceholder')"
              @input="emitUpdate(char.id, 'description', ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
          <div class="detail-field">
            <label>{{ $t('book.characterNotes') }}</label>
            <textarea
              :value="char.notes"
              class="detail-textarea"
              rows="2"
              :placeholder="$t('book.characterNotesPlaceholder')"
              @input="emitUpdate(char.id, 'notes', ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>
      </div>

      <!-- AI Generate -->
      <div class="gen-section">
        <div v-if="genActive" class="gen-row">
          <input
            v-model="genPrompt"
            class="gen-input"
            :placeholder="$t('book.genCharPlaceholder')"
            @keydown.enter="doGenChar"
          />
          <button class="btn-gen-go" :disabled="genLoading" @click="doGenChar">
            {{ genLoading ? '...' : $t('book.generate') }}
          </button>
        </div>
        <button v-else class="btn-ai-gen" @click="genActive = true">
          &#9889; {{ $t('book.genCharacter') }}
        </button>
      </div>

      <button class="btn-add-char" @click="bookStore.addCharacter()">
        + {{ $t('book.addCharacter') }}
      </button>
    </div>

    <ModalDialog
      :visible="modal.visible"
      type="alert"
      :message="modal.message"
      :ok-text="t('common.confirm')"
      @confirm="modal.visible = false"
      @update:visible="(v: boolean) => modal.visible = v"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useBookStore } from '@/stores/book'
import { sendAiMessage } from '@/commands/ai'
import ModalDialog from '@/components/common/ModalDialog.vue'
import type { Character } from '@/types'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const bookStore = useBookStore()
const modal = reactive({ visible: false, message: '' })

defineProps<{ characters: Character[] }>()

const emit = defineEmits<{
  update: [payload: { id: string; data: Partial<Character> }]
  delete: [id: string]
}>()

const expandedId = ref<string>('')
const genActive = ref(false)
const genLoading = ref(false)
const genPrompt = ref('')

async function doGenChar() {
  if (!genPrompt.value.trim()) return
  genLoading.value = true
  try {
    const book = bookStore.activeBook
    const ctx = [book?.worldSetting, book?.storySetting].filter(Boolean).join('\n')
    const result = await sendAiMessage(settingsStore.modelConfig, {
      action: 'gen_character',
      content: genPrompt.value.trim(),
      context: ctx || undefined,
    })

    const parsed = parseCharResult(result)
    const char = bookStore.addCharacter(parsed)
    if (char) expandedId.value = char.id

    genActive.value = false
    genPrompt.value = ''
  } catch (e: unknown) {
    modal.message = `AI generation failed: ${String(e)}`
    modal.visible = true
  } finally {
    genLoading.value = false
  }
}

function parseCharResult(raw: string): Partial<{ name: string; role: string; description: string }> {
  const nameMatch = raw.match(/【姓名】(.+)/) || raw.match(/Name:\s*(.+)/i)
  const roleMatch = raw.match(/【定位】(.+)/) || raw.match(/Role:\s*(.+)/i)
  const descMatch = raw.match(/【描述】([\s\S]+?)(?=【|$)/) || raw.match(/Description:\s*([\s\S]+?)(?=Name:|Role:|$)/i)

  const name = nameMatch?.[1]?.trim() || ''
  const roleRaw = (roleMatch?.[1] || '').trim()
  const roleMap: Record<string, string> = {
    '主角': 'protagonist', 'protagonist': 'protagonist', 'main': 'protagonist',
    '配角': 'supporting', 'supporting': 'supporting',
    '反派': 'antagonist', 'antagonist': 'antagonist', 'villain': 'antagonist',
    '路人': 'background', 'background': 'background',
  }
  const role = roleMap[roleRaw.toLowerCase()] || 'supporting'
  const description = descMatch?.[1]?.trim() || raw.replace(/【.*】.*\n?/g, '').trim() || raw.trim()

  return { name, role, description }
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? '' : id
}

function emitUpdate(id: string, key: string, value: string) {
  emit('update', { id, data: { [key]: value } })
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    protagonist: 'book.roles.protagonist',
    supporting: 'book.roles.supporting',
    antagonist: 'book.roles.antagonist',
    background: 'book.roles.background',
  }
  return t(map[role] || role)
}
</script>

<style scoped>
.character-panel {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

.char-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.char-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.char-card.expanded {
  border-color: var(--color-accent);
  box-shadow: 0 2px 12px var(--color-accent-light);
}

.char-summary {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.char-summary:hover { background: var(--color-hover); }

.char-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.char-name {
  font-size: 0.8rem;
  color: var(--color-text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.char-role {
  font-size: 0.66rem;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 2px 7px;
  border-radius: 10px;
  white-space: nowrap;
  font-weight: 500;
}

.btn-delete-char {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}
.btn-delete-char:hover {
  color: #fff;
  background: var(--color-danger);
}

.char-detail {
  padding: 10px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.detail-field label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.detail-input,
.detail-select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.8rem;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.detail-input:focus,
.detail-select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.detail-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%238888a8' d='M2.5 3.5l2.5 3 2.5-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 26px;
}

.detail-textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.78rem;
  line-height: 1.45;
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.detail-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.btn-add-char {
  width: 100%;
  padding: 8px;
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}
.btn-add-char:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
}

.gen-section { margin-bottom: 6px; }

.btn-ai-gen {
  width: 100%;
  padding: 6px;
  border: 1px dashed var(--color-accent);
  background: transparent;
  color: var(--color-accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}
.btn-ai-gen:hover {
  background: var(--color-accent-light);
}

.gen-row {
  display: flex;
  gap: 4px;
}
.gen-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.74rem;
  outline: none;
}
.btn-gen-go {
  padding: 4px 10px;
  border: none;
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
}
.btn-gen-go:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
