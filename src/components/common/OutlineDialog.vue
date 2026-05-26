<template>
  <Teleport to="body">
    <div class="dialog-overlay" @click.self="$emit('close')">
      <div class="dialog" @click.stop>
        <!-- Header -->
        <div class="dialog-header">
          <div class="header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </div>
          <h2>{{ t('book.outline') }}</h2>
          <span class="item-count">{{ items.length }}</span>
          <button class="dialog-close" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="items.length === 0" class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <p>{{ t('book.outlineEmpty') }}</p>
          <p class="empty-hint">{{ t('book.outlineEmptyHint') }}</p>
        </div>

        <!-- Outline List -->
        <div v-else class="outline-list">
          <div
            v-for="(item, idx) in items"
            :key="item.id"
            class="outline-item"
            :class="{ editing: editingId === item.id }"
          >
            <div class="item-order">
              <span class="order-num">{{ idx + 1 }}</span>
              <div class="drag-handle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" />
                  <circle cx="9" cy="12" r="2" /><circle cx="15" cy="12" r="2" />
                  <circle cx="9" cy="19" r="2" /><circle cx="15" cy="19" r="2" />
                </svg>
              </div>
            </div>

            <!-- Display mode -->
            <div v-if="editingId !== item.id" class="item-content" @click="startEdit(item)">
              <div class="item-title">{{ getChapterTitle(item) || item.title || t('book.outlineUntitled') }}</div>
              <div v-if="item.description" class="item-desc">{{ item.description }}</div>
              <div class="item-chapter-link">
                <select
                  class="chapter-select"
                  :value="item.chapterId || ''"
                  @click.stop
                  @change="onLinkChapter(item.id, $event)"
                >
                  <option value="">{{ t('book.outlineNoChapter') }}</option>
                  <option
                    v-for="ch in chapters"
                    :key="ch.id"
                    :value="ch.id"
                  >{{ ch.title || t('editor.unnamed') }}</option>
                </select>
                <span v-if="item.chapterId" class="linked-badge">{{ t('book.outlineLinked') }}</span>
              </div>
            </div>

            <!-- Edit mode -->
            <div v-else class="item-edit">
              <div v-if="item.chapterId" class="linked-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>{{ getChapterTitle(item) }}</span>
              </div>
              <textarea
                v-model="editDesc"
                class="edit-textarea"
                :placeholder="t('book.outlineDescPlaceholder')"
                rows="4"
              ></textarea>
              <div class="edit-toolbar">
                <button
                  class="btn-sm btn-ai"
                  :disabled="genLoading"
                  @click="onGenOutline(item)"
                >
                  <span v-if="genLoading" class="mini-spinner"></span>
                  <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                  {{ t('book.outlineGen') }}
                </button>
              </div>
              <div class="edit-actions">
                <button class="btn-sm" @click="cancelEdit">{{ t('common.cancel') }}</button>
                <button class="btn-sm btn-primary" @click="saveEdit(item.id)">{{ t('common.save') }}</button>
              </div>
            </div>

            <!-- Delete button -->
            <button
              v-if="editingId !== item.id"
              class="btn-delete-item"
              :title="t('common.delete')"
              @click="onDelete(item)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="dialog-footer">
          <button class="btn btn-add" @click="onAdd">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {{ t('book.outlineAdd') }}
          </button>
          <button class="btn btn-close" @click="$emit('close')">{{ t('common.close') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookStore } from '@/stores/book'
import { useSettingsStore } from '@/stores/settings'
import { sendAiMessage } from '@/commands/ai'
import type { OutlineItem } from '@/types'

defineEmits<{ close: [] }>()

const { t } = useI18n()
const bookStore = useBookStore()
const settingsStore = useSettingsStore()

const genLoading = ref(false)

const items = computed(() => {
  const book = bookStore.activeBook
  if (!book) return []
  return [...book.outline].sort((a, b) => a.order - b.order)
})

const chapters = computed(() => {
  const book = bookStore.activeBook
  return book?.chapters || []
})

function getChapterTitle(item: OutlineItem): string {
  if (!item.chapterId) return ''
  const ch = chapters.value.find((c) => c.id === item.chapterId)
  return ch ? (ch.title || t('editor.unnamed')) : ''
}

function onLinkChapter(outlineItemId: string, e: Event) {
  const chapterId = (e.target as HTMLSelectElement).value
  if (chapterId) {
    bookStore.linkOutlineToChapter(outlineItemId, chapterId)
  } else {
    bookStore.unlinkOutlineFromChapter(outlineItemId)
  }
}

const editingId = ref('')
const editDesc = ref('')

function startEdit(item: OutlineItem) {
  editingId.value = item.id
  editDesc.value = item.description
}

function saveEdit(id: string) {
  const item = items.value.find((o) => o.id === id)
  if (!item) return
  bookStore.updateOutlineItem(id, { description: editDesc.value.trim() })
  editingId.value = ''
  editDesc.value = ''
}

function cancelEdit() {
  editingId.value = ''
  editDesc.value = ''
}

function onAdd() {
  const item = bookStore.addOutlineItem()
  if (item) startEdit(item)
}

function onDelete(item: OutlineItem) {
  bookStore.deleteOutlineItem(item.id)
}

function buildBookContext(): string {
  const book = bookStore.activeBook
  if (!book) return ''
  const parts: string[] = []
  if (book.worldSetting) parts.push(`【世界观】${book.worldSetting}`)
  if (book.storySetting) parts.push(`【剧情总结】${book.storySetting}`)
  if (book.characters.length > 0) {
    const chars = book.characters
      .filter((c) => c.name)
      .map((c) => `【${c.role}】${c.name}：${c.description}`)
      .join('\n')
    if (chars) parts.push(`【角色】\n${chars}`)
  }
  if (book.chapters.length > 0) {
    const titles = book.chapters.map((c, i) =>
      `${i + 1}. ${c.title}（${c.content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length}字）`
    ).join('\n')
    parts.push(`【已有章节】\n${titles}`)
  }
  return parts.join('\n\n')
}

async function onGenOutline(item: OutlineItem) {
  if (genLoading.value) return
  const book = bookStore.activeBook
  if (!book) return

  genLoading.value = true
  try {
    const ctx = buildBookContext()
    const title = item.chapterId
      ? (book.chapters.find((c) => c.id === item.chapterId)?.title || item.title)
      : item.title
    const prompt = title || '未命名章节'

    const result = await sendAiMessage(settingsStore.effectiveConfig, {
      action: 'gen_outline',
      content: prompt,
      context: ctx || undefined,
    })

    // Use the result as the description
    editDesc.value = result.trim()
  } catch (e: unknown) {
    // Silently fail — user can retry
    console.error('AI outline generation failed:', e)
  } finally {
    genLoading.value = false
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: overlayIn 0.2s ease;
}
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

.dialog {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dialogIn 0.25s cubic-bezier(0.16,1,0.3,1);
}
@keyframes dialogIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
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
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(99,102,241,0.3);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--color-text);
  flex: 1;
}

.item-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.dialog-close {
  width: 30px; height: 30px;
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

/* ── Empty State ── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 10px;
}
.empty-state p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.empty-hint {
  font-size: 0.75rem !important;
  opacity: 0.7;
}

/* ── Outline List ── */
.outline-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.outline-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  transition: all 0.15s ease;
  position: relative;
}
.outline-item:hover {
  border-color: var(--color-accent);
  background: var(--color-surface);
}
.outline-item.editing {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}

.item-order {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 28px;
  padding-top: 2px;
}

.order-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 0.72rem;
  font-weight: 650;
}

.drag-handle {
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.outline-item:hover .drag-handle { opacity: 1; }

/* ── Display mode ── */
.item-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  padding: 2px 0;
}
.item-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-desc {
  font-size: 0.74rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Edit mode ── */
.item-edit {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.linked-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
}

.edit-textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.78rem;
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.edit-textarea:focus { border-color: var(--color-accent); }

.edit-toolbar {
  display: flex;
  gap: 6px;
}

.btn-ai {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-ai:hover:not(:disabled) { background: var(--color-accent); color: #fff; }
.btn-ai:disabled { opacity: 0.5; cursor: default; }

.mini-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.edit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.btn-sm {
  padding: 5px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  font-size: 0.74rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-sm:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.btn-primary { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
.btn-primary:hover { background: var(--color-accent); color: #fff; opacity: 0.9; }

/* ── Chapter Link ── */
.item-chapter-link {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.chapter-select {
  padding: 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  outline: none;
  cursor: pointer;
  max-width: 160px;
  transition: border-color 0.15s ease;
}
.chapter-select:focus { border-color: var(--color-accent); }

.linked-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 600;
  background: #10b981;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* ── Delete ── */
.btn-delete-item {
  width: 28px; height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  transition: all 0.15s ease;
  margin-top: 2px;
}
.outline-item:hover .btn-delete-item { opacity: 1; }
.btn-delete-item:hover { background: var(--color-danger-bg); color: var(--color-danger); }

/* ── Footer ── */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 22px 16px;
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: 9px 18px;
  border: none;
  border-radius: 9px;
  font-size: 0.82rem;
  font-weight: 560;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-add {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff;
  box-shadow: 0 2px 10px rgba(99,102,241,0.3);
}
.btn-add:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }
.btn-close {
  background: var(--color-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.btn-close:hover { background: var(--color-hover); color: var(--color-text); }
</style>
