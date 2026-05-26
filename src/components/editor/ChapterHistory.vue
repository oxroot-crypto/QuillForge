<template>
  <div class="chapter-history">
    <div class="history-header">
      <h3>{{ $t('history.title') }}</h3>
      <div class="header-actions">
        <button class="btn-save-snapshot" :disabled="saving" @click="onSaveSnapshot">
          {{ saving ? t('common.saving') : t('history.saveSnapshot') }}
        </button>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>
    </div>

    <div v-if="loading" class="history-loading">
      <span class="spinner" />
      {{ $t('common.loading') }}
    </div>

    <div v-else-if="error" class="history-error">
      {{ error }}
    </div>

    <div v-else-if="snapshots.length === 0" class="history-empty">
      <p>{{ $t('history.empty') }}</p>
    </div>

    <div v-else class="history-list">
      <div
        v-for="snap in snapshots"
        :key="snap.timestamp"
        class="history-item"
        :class="{ active: snap.timestamp === previewTimestamp }"
        @click="onPreview(snap)"
      >
        <div class="history-item-header">
          <span class="history-label">{{ snap.label }}</span>
          <span class="history-time">{{ formatTime(snap.timestamp) }}</span>
        </div>
        <div class="history-meta">
          <span class="history-title">{{ snap.title }}</span>
          <span class="history-words">{{ snap.word_count }} {{ $t('history.words') }}</span>
        </div>
        <button
          class="btn-delete-snapshot"
          :title="t('common.delete')"
          @click.stop="onDeleteSnapshot(snap)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Preview diff -->
    <div v-if="previewContent !== null" class="history-preview">
      <div class="preview-header">
        <span class="preview-label">{{ $t('history.preview') }}</span>
        <div class="preview-actions">
          <button
            v-if="!confirmRestore"
            class="btn-restore"
            @click="confirmRestore = true"
          >
            {{ $t('history.restore') }}
          </button>
          <button
            v-else
            class="btn-restore btn-restore-confirm"
            @click="onRestore"
          >
            {{ $t('common.confirm') }}
          </button>
          <button class="btn-close-preview" @click="onClosePreview">
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
      <div class="preview-content" v-html="previewContent" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookStore } from '@/stores/book'
import { useEditorStore } from '@/stores/editor'
import { saveSnapshot, listSnapshots, getSnapshotData, deleteSnapshot } from '@/commands/history'
import type { SnapshotInfo } from '@/commands/history'

defineEmits<{ close: [] }>()

const { t } = useI18n()
const bookStore = useBookStore()
const editorStore = useEditorStore()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const snapshots = ref<SnapshotInfo[]>([])
const previewTimestamp = ref('')
const previewContent = ref<string | null>(null)
const confirmRestore = ref(false)

async function loadSnapshots() {
  if (!bookStore.activeBookId || !bookStore.activeChapterId) return
  loading.value = true
  error.value = ''
  try {
    snapshots.value = await listSnapshots(bookStore.activeBookId, bookStore.activeChapterId)
  } catch (e: unknown) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

async function onSaveSnapshot() {
  if (!bookStore.activeBookId || !bookStore.activeChapterId || saving.value) return
  saving.value = true
  try {
    const chapter = bookStore.activeChapter
    if (!chapter) return
    await saveSnapshot(bookStore.activeBookId, bookStore.activeChapterId, chapter.content, chapter.title, chapter.title)
    await loadSnapshots()
  } catch (e: unknown) {
    error.value = String(e)
  } finally {
    saving.value = false
  }
}

async function onDeleteSnapshot(snap: SnapshotInfo) {
  if (!bookStore.activeBookId || !bookStore.activeChapterId) return
  try {
    await deleteSnapshot(bookStore.activeBookId, bookStore.activeChapterId, snap.timestamp)
    if (previewTimestamp.value === snap.timestamp) {
      previewContent.value = null
      confirmRestore.value = false
    }
    await loadSnapshots()
  } catch (e: unknown) {
    error.value = String(e)
  }
}

async function onPreview(snap: SnapshotInfo) {
  if (!bookStore.activeBookId || !bookStore.activeChapterId) return
  confirmRestore.value = false
  previewTimestamp.value = snap.timestamp
  try {
    const data = await getSnapshotData(
      bookStore.activeBookId,
      bookStore.activeChapterId,
      snap.timestamp,
    )
    previewContent.value = data.content
  } catch (e: unknown) {
    error.value = String(e)
  }
}

async function onRestore() {
  if (!bookStore.activeBookId || !bookStore.activeChapterId || !previewTimestamp.value) return
  try {
    const data = await getSnapshotData(
      bookStore.activeBookId,
      bookStore.activeChapterId,
      previewTimestamp.value,
    )
    // Update store and editor
    bookStore.renameChapter(bookStore.activeBookId, bookStore.activeChapterId, data.title)
    bookStore.updateChapterContent(bookStore.activeBookId, bookStore.activeChapterId, data.content)
    editorStore.updateContent(data.content)
    confirmRestore.value = false
    previewContent.value = null
    await loadSnapshots()
  } catch (e: unknown) {
    error.value = String(e)
  }
}

function onClosePreview() {
  confirmRestore.value = false
  previewContent.value = null
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString()
  } catch {
    return ts
  }
}

onMounted(loadSnapshots)
</script>

<style scoped>
.chapter-history {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 480px;
  max-height: 70vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.history-header h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-save-snapshot {
  padding: 4px 10px;
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity var(--transition-fast);
}
.btn-save-snapshot:hover:not(:disabled) { opacity: 0.85; }
.btn-save-snapshot:disabled { opacity: 0.5; cursor: not-allowed; }

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

.history-loading,
.history-empty,
.history-error {
  padding: 24px 16px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.82rem;
}

.history-error { color: var(--color-danger); }

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin { to { transform: rotate(360deg); } }

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  border: 1px solid transparent;
  margin-bottom: 4px;
  position: relative;
}
.history-item:hover { background: var(--color-hover); }
.history-item.active {
  background: var(--color-accent-light);
  border-color: var(--color-accent);
}

.btn-delete-snapshot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all var(--transition-fast);
}
.history-item:hover .btn-delete-snapshot { opacity: 1; }
.btn-delete-snapshot:hover { background: var(--color-danger-bg); color: var(--color-danger); }

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.history-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
}

.history-time {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.history-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.history-preview {
  border-top: 1px solid var(--color-border);
  max-height: 40vh;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-hover);
}

.preview-label {
  font-size: 0.78rem;
  font-weight: 600;
}

.preview-actions { display: flex; gap: 6px; }

.btn-restore {
  padding: 4px 12px;
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
}
.btn-restore:hover { opacity: 0.9; }
.btn-restore-confirm {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-close-preview {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.75rem;
}
.btn-close-preview:hover { border-color: var(--color-text-muted); }

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 0.85rem;
  line-height: 1.7;
  color: var(--color-text);
}

.preview-content :deep(p) { margin-bottom: 0.5em; }
</style>
