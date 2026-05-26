<template>
  <div class="search-overlay" @click.self="$emit('close')">
    <div class="search-dialog">
      <div class="search-header">
        <div class="search-input-wrap">
          <span class="search-icon">&#128269;</span>
          <input
            ref="searchInput"
            v-model="query"
            class="search-input"
            :placeholder="$t('search.placeholder')"
            @keydown.enter="onSearch"
            @keydown.escape="$emit('close')"
          />
          <button
            v-if="query"
            class="btn-clear"
            @click="query = ''; results = []"
          >
            &times;
          </button>
        </div>
        <button class="btn-close" @click="$emit('close')">&times;</button>
      </div>

      <div v-if="searching" class="search-status">
        <span class="spinner" />
        {{ $t('common.searching') }}
      </div>

      <div v-else-if="searched && results.length === 0" class="search-status">
        {{ $t('search.noResults', { q: query }) }}
      </div>

      <div v-else-if="results.length > 0" class="search-results">
        <div
          v-for="r in results"
          :key="`${r.book_id}-${r.chapter_id}`"
          class="search-result-item"
          @click="onSelect(r)"
        >
          <div class="result-header">
            <span class="result-book">{{ r.book_title }}</span>
            <span class="result-sep">/</span>
            <span class="result-chapter">{{ r.chapter_title }}</span>
          </div>
          <div class="result-snippet" v-html="highlightSnippet(r.snippet)" />
          <div class="result-score">
            {{ $t('search.relevance', { score: r.score.toFixed(1) }) }}
          </div>
        </div>
      </div>

      <div class="search-footer">
        <span class="footer-hint">{{ $t('search.hint') }}</span>
        <label class="scope-toggle">
          <input v-model="scopeCurrentBook" type="checkbox" />
          {{ $t('search.scopeCurrent') }}
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBookStore } from '@/stores/book'
import { useEditorStore } from '@/stores/editor'
import { searchChapters } from '@/commands/search'
import type { SearchResult } from '@/commands/search'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const bookStore = useBookStore()
const editorStore = useEditorStore()

const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const results = ref<SearchResult[]>([])
const searching = ref(false)
const searched = ref(false)
const scopeCurrentBook = ref(false)

onMounted(() => {
  nextTick(() => searchInput.value?.focus())
})

async function onSearch() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true
  searched.value = true
  try {
    const scope = scopeCurrentBook.value ? bookStore.activeBookId || undefined : undefined
    results.value = await searchChapters(q, scope)
  } catch (e: unknown) {
    console.error('搜索失败:', e)
    results.value = []
  } finally {
    searching.value = false
  }
}

function onSelect(r: SearchResult) {
  // Navigate to the book and chapter
  bookStore.selectBook(r.book_id)
  const chapter = bookStore.selectChapter(r.book_id, r.chapter_id)
  editorStore.updateContent(chapter?.content || '')
  emit('close')
}

function highlightSnippet(snippet: string): string {
  if (!query.value.trim()) return snippet
  const words = query.value.trim().split(/\s+/)
  let html = escapeHtml(snippet)
  for (const word of words) {
    const re = new RegExp(`(${escapeRegex(word)})`, 'gi')
    html = html.replace(re, '<mark>$1</mark>')
  }
  return html
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

watch(() => scopeCurrentBook.value, () => { if (searched.value) onSearch() })
</script>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  z-index: 999;
}

.search-dialog {
  width: 560px;
  max-height: 70vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  gap: 8px;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0 10px;
}

.search-icon { font-size: 0.9rem; margin-right: 8px; }

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  font-size: 0.9rem;
  color: var(--color-text);
  outline: none;
}

.btn-clear {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 2px 4px;
}

.btn-close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
}
.btn-close:hover { background: var(--color-hover); }

.search-status {
  padding: 32px 16px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

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

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-result-item {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  margin-bottom: 4px;
}
.search-result-item:hover { background: var(--color-hover); }

.result-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 0.75rem;
}

.result-book {
  color: var(--color-accent);
  font-weight: 600;
}

.result-sep { color: var(--color-text-muted); }

.result-chapter {
  color: var(--color-text);
  font-weight: 500;
}

.result-snippet {
  font-size: 0.82rem;
  color: var(--color-text);
  line-height: 1.6;
  margin-bottom: 4px;
}

.result-snippet :deep(mark) {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: 2px;
  padding: 0 2px;
}

.result-score {
  font-size: 0.65rem;
  color: var(--color-text-muted);
}

.search-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.scope-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.scope-toggle input { cursor: pointer; }
</style>
