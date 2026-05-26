<template>
  <div class="template-overlay" @click.self="$emit('close')">
    <div class="template-dialog">
      <div class="dialog-header">
        <h3>{{ $t('templates.title') }}</h3>
        <div class="header-actions">
          <button class="btn-sm" @click="showImport = !showImport">
            {{ $t('templates.import') }}
          </button>
          <button class="btn-sm" @click="startNewTemplate">
            {{ $t('templates.new') }}
          </button>
          <button class="btn-close" @click="$emit('close')">&times;</button>
        </div>
      </div>

      <!-- Import area -->
      <div v-if="showImport" class="import-area">
        <textarea
          v-model="importJson"
          class="import-input"
          :placeholder="$t('templates.importPlaceholder')"
          rows="3"
        />
        <button class="btn-sm btn-primary" @click="doImport">
          {{ $t('templates.importBtn') }}
        </button>
        <span v-if="importResult" class="import-result">{{ importResult }}</span>
      </div>

      <!-- Template list -->
      <div class="template-search">
        <input
          v-model="searchQuery"
          class="search-input"
          :placeholder="$t('templates.search')"
        />
      </div>

      <div class="template-list">
        <div
          v-for="tpl in filteredTemplates"
          :key="tpl.id"
          class="template-item"
          :class="{ active: tpl.id === templateStore.activeTemplateId, custom: !tpl.builtIn }"
          @click="templateStore.selectTemplate(tpl.id)"
        >
          <div class="template-item-header">
            <span class="template-name">{{ tpl.name }}</span>
            <span class="template-badge" :class="{ builtin: tpl.builtIn }">
              {{ tpl.builtIn ? $t('templates.builtin') : $t('templates.customLabel') }}
            </span>
            <span class="template-action-badge">{{ getActionLabel(tpl.action) }}</span>
          </div>
          <div class="template-desc">{{ tpl.description }}</div>
          <div class="template-tags">
            <span v-for="tag in tpl.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <div v-if="!tpl.builtIn" class="template-item-actions">
            <button class="btn-sm" @click.stop="editTemplate(tpl)">{{ $t('common.edit') }}</button>
            <button class="btn-sm btn-danger" @click.stop="deleteTemplate(tpl.id)">{{ $t('common.delete') }}</button>
          </div>
        </div>
        <div v-if="filteredTemplates.length === 0" class="empty-hint">
          {{ $t('templates.noTemplates') }}
        </div>
      </div>
    </div>

    <!-- Template editor modal -->
    <div v-if="editing" class="editor-overlay" @click.self="editing = false">
      <div class="editor-dialog">
        <div class="editor-header">
          <h4>{{ editingTemplate.id ? $t('templates.editTemplate') : $t('templates.newTemplate') }}</h4>
          <button class="btn-close" @click="editing = false">&times;</button>
        </div>
        <div class="editor-body">
          <label class="field">
            <span class="field-label">{{ $t('templates.name') }}</span>
            <input v-model="editingTemplate.name" class="field-input" />
          </label>
          <label class="field">
            <span class="field-label">{{ $t('templates.description') }}</span>
            <input v-model="editingTemplate.description" class="field-input" />
          </label>
          <label class="field">
            <span class="field-label">{{ $t('templates.action') }}</span>
            <select v-model="editingTemplate.action" class="field-input">
              <option value="review">{{ $t('ai.review') }}</option>
              <option value="idea">{{ $t('ai.idea') }}</option>
              <option value="continue">{{ $t('ai.continue') }}</option>
              <option value="rewrite">{{ $t('ai.rewrite') }}</option>
              <option value="consistency">{{ $t('ai.consistency') }}</option>
              <option value="gen_chapter">{{ $t('ai.genChapter') }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">{{ $t('templates.systemPrompt') }}</span>
            <textarea
              v-model="editingTemplate.systemPrompt"
              class="field-input field-textarea"
              rows="5"
              :placeholder="$t('templates.systemPromptPlaceholder')"
            />
          </label>
          <label class="field">
            <span class="field-label">{{ $t('templates.tags') }}</span>
            <input v-model="editingTemplate.tagsStr" class="field-input" :placeholder="$t('templates.tagsPlaceholder')" />
          </label>
        </div>
        <div class="editor-footer">
          <button class="btn-sm" @click="editing = false">{{ $t('common.cancel') }}</button>
          <button class="btn-sm btn-primary" @click="saveTemplate">{{ $t('common.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTemplateStore } from '@/stores/templates'
import type { PromptTemplate } from '@/stores/templates'

defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const templateStore = useTemplateStore()

const searchQuery = ref('')
const showImport = ref(false)
const importJson = ref('')
const importResult = ref('')
const editing = ref(false)

interface EditingTemplate {
  id: string
  name: string
  description: string
  action: string
  systemPrompt: string
  tagsStr: string
}

const editingTemplate = ref<EditingTemplate>({
  id: '',
  name: '',
  description: '',
  action: 'review',
  systemPrompt: '',
  tagsStr: '',
})

const filteredTemplates = computed(() => {
  const q = searchQuery.value.toLowerCase()
  const currentLocale = locale.value as string
  return templateStore.allTemplates.filter((t) => {
    // Show matching locale or zh-CN
    if (t.locale !== currentLocale && t.locale !== 'zh-CN') return false
    if (!q) return true
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })
})

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    review: t('ai.review'),
    idea: t('ai.idea'),
    continue: t('ai.continue'),
    rewrite: t('ai.rewrite'),
    consistency: t('ai.consistency'),
    gen_chapter: t('ai.genChapter'),
  }
  return map[action] || action
}

function startNewTemplate() {
  editingTemplate.value = {
    id: '',
    name: '',
    description: '',
    action: 'review',
    systemPrompt: '',
    tagsStr: '',
  }
  editing.value = true
}

function editTemplate(tpl: PromptTemplate) {
  editingTemplate.value = {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    action: tpl.action,
    systemPrompt: tpl.systemPrompt,
    tagsStr: tpl.tags.join(', '),
  }
  editing.value = true
}

function saveTemplate() {
  const et = editingTemplate.value
  const tags = et.tagsStr.split(',').map((s) => s.trim()).filter(Boolean)
  if (et.id) {
    templateStore.updateCustomTemplate(et.id, {
      name: et.name,
      description: et.description,
      action: et.action,
      systemPrompt: et.systemPrompt,
      tags,
    })
  } else {
    templateStore.addCustomTemplate({
      name: et.name,
      description: et.description,
      action: et.action,
      systemPrompt: et.systemPrompt,
      userPrompt: undefined,
      tags,
      locale: locale.value as string,
    })
  }
  editing.value = false
}

function deleteTemplate(id: string) {
  if (confirm(t('common.confirmDelete'))) {
    templateStore.removeCustomTemplate(id)
  }
}

function doImport() {
  const count = templateStore.importTemplates(importJson.value)
  importResult.value = count > 0
    ? t('templates.importSuccess', { count })
    : t('templates.importFailed')
  if (count > 0) importJson.value = ''
}
</script>

<style scoped>
.template-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.template-dialog {
  width: 560px;
  max-height: 80vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}
.dialog-header h3 { margin: 0; font-size: 0.9rem; font-weight: 600; }

.header-actions { display: flex; gap: 4px; align-items: center; }

.btn-sm {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}
.btn-sm:hover { border-color: var(--color-accent); color: var(--color-accent); }
.btn-primary { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
.btn-primary:hover { opacity: 0.9; }
.btn-danger:hover { border-color: var(--color-danger); color: var(--color-danger); }

.btn-close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.btn-close:hover { background: var(--color-hover); color: var(--color-text); }

.import-area {
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--color-hover);
}

.import-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.75rem;
  font-family: var(--font-mono);
  resize: vertical;
}

.import-result { font-size: 0.72rem; color: var(--color-success); }

.template-search {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.8rem;
  outline: none;
}
.search-input:focus { border-color: var(--color-accent); }

.template-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.template-item {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  border: 1px solid transparent;
  margin-bottom: 4px;
}
.template-item:hover { background: var(--color-hover); }
.template-item.active {
  background: var(--color-accent-light);
  border-color: var(--color-accent);
}
.template-item.custom {
  border-color: var(--color-border);
}

.template-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.template-name { font-size: 0.85rem; font-weight: 600; color: var(--color-text); }

.template-badge {
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 500;
}
.template-badge.builtin { background: var(--color-accent-light); color: var(--color-accent); }
.template-badge:not(.builtin) { background: var(--color-hover); color: var(--color-text-muted); }

.template-action-badge {
  font-size: 0.62rem;
  background: var(--color-hover);
  color: var(--color-text-muted);
  padding: 1px 5px;
  border-radius: 3px;
}

.template-desc {
  font-size: 0.74rem;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  line-height: 1.4;
}

.template-tags { display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 4px; }
.tag { font-size: 0.6rem; background: var(--color-hover); color: var(--color-text-muted); padding: 1px 5px; border-radius: 3px; }

.template-item-actions { display: flex; gap: 4px; margin-top: 4px; }

.empty-hint {
  text-align: center;
  padding: 20px;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

/* Editor modal */
.editor-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.editor-dialog {
  width: 480px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header, .editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}
.editor-header { border-bottom: 1px solid var(--color-border); }
.editor-header h4 { margin: 0; font-size: 0.85rem; font-weight: 600; }
.editor-footer { border-top: 1px solid var(--color-border); gap: 6px; justify-content: flex-end; }

.editor-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }

.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 0.72rem; font-weight: 600; color: var(--color-text-muted); }
.field-input {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.8rem;
  outline: none;
}
.field-input:focus { border-color: var(--color-accent); }
.field-textarea { resize: vertical; font-family: inherit; }
</style>
