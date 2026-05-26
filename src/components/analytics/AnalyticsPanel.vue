<template>
  <div class="analytics-panel">
    <div class="panel-header">
      <h3>{{ $t('analytics.title') }}</h3>
      <div class="header-actions">
        <button
          class="btn-small"
          :disabled="!bookStore.activeBook"
          @click="analyzeBook"
        >
          {{ $t('analytics.analyzeBook') }}
        </button>
      </div>
    </div>

    <div v-if="analyzing" class="analyzing-state">
      <span class="spinner" />
      {{ $t('common.analyzing') }}
    </div>

    <template v-else>
      <!-- Current chapter stats -->
      <div class="stat-section">
        <h4 class="section-title">{{ $t('analytics.currentChapter') }}</h4>
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.words }}</span>
            <span class="stat-label">{{ $t('analytics.wordCount') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.sentences }}</span>
            <span class="stat-label">{{ $t('analytics.sentenceCount') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.paragraphs }}</span>
            <span class="stat-label">{{ $t('analytics.paragraphCount') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.avgSentenceLen }}</span>
            <span class="stat-label">{{ $t('analytics.avgSentenceLen') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.dialogueRatio }}%</span>
            <span class="stat-label">{{ $t('analytics.dialogueRatio') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.passiveCount }}</span>
            <span class="stat-label">{{ $t('analytics.passiveCount') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.readability }}</span>
            <span class="stat-label">{{ $t('analytics.readability') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ chapterStats.maxSentenceLen }}</span>
            <span class="stat-label">{{ $t('analytics.maxSentenceLen') }}</span>
          </div>
        </div>
      </div>

      <!-- Sentence length distribution -->
      <div class="stat-section">
        <h4 class="section-title">{{ $t('analytics.sentenceDist') }}</h4>
        <div class="dist-bars">
          <div
            v-for="(count, label) in chapterStats.sentenceDist"
            :key="label"
            class="dist-bar-item"
          >
            <div class="dist-bar-label">{{ label }}</div>
            <div class="dist-bar-track">
              <div
                class="dist-bar-fill"
                :style="{ width: (count / maxDistCount * 100) + '%' }"
              />
            </div>
            <div class="dist-bar-count">{{ count }}</div>
          </div>
        </div>
      </div>

      <!-- Top words -->
      <div class="stat-section">
        <h4 class="section-title">{{ $t('analytics.topWords') }}</h4>
        <div class="word-list">
          <div
            v-for="(count, word) in chapterStats.topWords"
            :key="word as string"
            class="word-item"
          >
            <span class="word-text">{{ word }}</span>
            <span class="word-count">{{ count }}</span>
          </div>
        </div>
        <div v-if="Object.keys(chapterStats.topWords).length === 0" class="empty-hint">
          {{ $t('analytics.noData') }}
        </div>
      </div>

      <!-- Book-wide stats -->
      <div v-if="bookStats" class="stat-section">
        <h4 class="section-title">{{ $t('analytics.bookStats') }}</h4>
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-value">{{ bookStats.totalWords }}</span>
            <span class="stat-label">{{ $t('analytics.totalWords') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ bookStats.avgWordsPerChapter }}</span>
            <span class="stat-label">{{ $t('analytics.avgPerChapter') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ bookStats.avgDialogueRatio }}%</span>
            <span class="stat-label">{{ $t('analytics.avgDialogue') }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/stores/editor'
import { useBookStore } from '@/stores/book'

const { t } = useI18n()
const editorStore = useEditorStore()
const bookStore = useBookStore()

const analyzing = ref(false)

function stripHtml(html: string): string {
  // Also decode common HTML entities
  const text = html.replace(/<[^>]*>/g, '')
  return text
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .trim()
}

function isChineseText(text: string): boolean {
  // Check if more than 30% of non-space chars are CJK
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const total = text.replace(/\s/g, '').length
  return total > 0 && cjk / total > 0.3
}

function countSentences(text: string): number {
  // For Chinese: split on sentence-ending punctuation (not lone periods which could be abbreviations)
  // For English: require period + space/capital or end of string
  let normalized = text
  // Normalize ellipsis and repeated punctuation
  normalized = normalized.replace(/[。！？]{2,}/g, (m) => m[0])
  // Count sentence boundaries: Chinese punctuation, or English period+space/caps/end
  const matches = normalized.match(/[。！？]|(?<=[.!?])\s+(?=[A-Z"「『])|[.!?]$/g)
  return matches ? matches.length : Math.max(1, (text.match(/\n\s*\n/g) || []).length + 1)
}

function countParagraphs(html: string): number {
  const matches = html.match(/<p[^>]*>/g)
  return matches ? matches.length : 1
}

function countDialogue(text: string): { ratio: number; count: number } {
  // Normalize all quote types to a standard form for matching
  const normalized = text
    .replace(/[\u201C\u201D]/g, '"')   // curly " " -> straight "
    .replace(/[\u2018\u2019]/g, "'")   // curly ' ' -> straight '
    .replace(/\uFF02/g, '"')           // fullwidth ＂ -> "
  // Extract content inside quotes
  let dialogueText = ''
  // Chinese quotes: 「...」 『...』
  const zhMatches = normalized.match(/[「『]([^」』]+)[」』]/g)
  if (zhMatches) dialogueText += zhMatches.join('')
  // Double quotes: "..."
  const dqMatches = normalized.match(/"([^"]+)"/g)
  if (dqMatches) dialogueText += dqMatches.join('')
  // Single quotes: '...'
  const sqMatches = normalized.match(/'([^']+)'/g)
  if (sqMatches) dialogueText += sqMatches.join('')
  // Strip quote chars, count inner text (quotes already normalized to straight "")
  const innerText = dialogueText.replace(/[「」『』"']/g, '').replace(/\s/g, '').length
  const totalText = normalized.replace(/\s/g, '').length
  if (innerText === 0 || totalText === 0) return { ratio: 0, count: 0 }
  return {
    ratio: Math.round(innerText / totalText * 100),
    count: innerText,
  }
}

function countPassive(text: string): number {
  // Chinese: count 被 (but not 被子 被动 等复合词—简单数吧)
  const zhPassive = (text.match(/被(?!子|动|告|迫|害|判)/g) || []).length
  // English: common irregular past participles after was/were
  const irregularPassive = [
    'taken', 'given', 'written', 'broken', 'spoken', 'known', 'shown',
    'built', 'sent', 'found', 'told', 'held', 'kept', 'led', 'lost',
    'made', 'meant', 'paid', 'put', 'read', 'run', 'said', 'seen',
    'sold', 'shot', 'stood', 'stuck', 'struck', 'thought', 'won',
  ].join('|')
  const enPattern = new RegExp(`\\b(was|were|been|get|got)\\s+(${irregularPassive}|\\w+ed)\\b`, 'gi')
  const enPassive = (text.match(enPattern) || []).length
  return enPassive + zhPassive
}

function calcReadability(text: string): string {
  const chars = text.replace(/\s/g, '').length
  const sentences = countSentences(text)
  if (sentences === 0 || chars < 20) return 'N/A'
  const avgCharsPerSentence = chars / sentences

  // For Chinese: also check ratio of uncommon characters
  const isZh = isChineseText(text)
  if (isZh) {
    // Count characters outside common range (less common characters)
    const uncommon = (text.match(/[^\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\s，。！？、；：""''「」（）]/g) || []).length
    const uncommonRatio = uncommon / chars
    if (avgCharsPerSentence > 35 || uncommonRatio > 0.05) return t('analytics.readabilityHard')
    if (avgCharsPerSentence > 20) return t('analytics.readabilityMedium')
    return t('analytics.readabilityEasy')
  }

  // English-like: simple heuristic
  if (avgCharsPerSentence > 25) return t('analytics.readabilityHard')
  if (avgCharsPerSentence > 15) return t('analytics.readabilityMedium')
  return t('analytics.readabilityEasy')
}

function getSentenceLengths(text: string): number[] {
  const raw = text.replace(/<[^>]*>/g, '')
  const sentences = raw
    .split(/(?<=[。！？.!?])\s*(?=(?:[^"「」』]*["「」』][^"「」』]*["「」』])*[^"「」』]*$)/)
    .filter((s) => s.replace(/[「」""（）()、，。！？：；\s]/g, '').length > 0)
  return sentences.map((s) => s.replace(/[「」""（）()、，。！？：；\s]/g, '').length)
}

function getSentenceDist(lengths: number[]): Record<string, number> {
  const isZh = lengths.some((l) => l > 10)
  const dist: Record<string, number> = {}
  if (isZh) {
    for (const k of ['1-10', '11-20', '21-30', '31-50', '51-100', '100+']) dist[k] = 0
    for (const len of lengths) {
      if (len <= 10) dist['1-10']++
      else if (len <= 20) dist['11-20']++
      else if (len <= 30) dist['21-30']++
      else if (len <= 50) dist['31-50']++
      else if (len <= 100) dist['51-100']++
      else dist['100+']++
    }
  } else {
    for (const k of ['1-5', '6-10', '11-15', '16-25', '26-40', '40+']) dist[k] = 0
    for (const len of lengths) {
      if (len <= 5) dist['1-5']++
      else if (len <= 10) dist['6-10']++
      else if (len <= 15) dist['11-15']++
      else if (len <= 25) dist['16-25']++
      else if (len <= 40) dist['26-40']++
      else dist['40+']++
    }
  }
  return dist
}

function getTopWords(text: string, n: number): Record<string, number> {
  const isZh = isChineseText(text)
  if (isZh) {
    // Only keep CJK characters (U+4E00–U+9FFF, U+3400–U+4DBF)
    const chars = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbf]/g, '').split('')
    if (chars.length < 4) return {}
    // Build bigrams (consecutive character pairs)
    const bigramFreq: Record<string, number> = {}
    for (let i = 0; i < chars.length - 1; i++) {
      const bigram = chars[i] + chars[i + 1]
      bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1
    }
    return Object.fromEntries(
      Object.entries(bigramFreq)
        .filter(([_, c]) => c >= 2)
        .sort(([, a], [, b]) => b - a)
        .slice(0, n),
    )
  }

  // English: word-level tokenization
  const words = text.toLowerCase().split(/[^a-z']+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  const freq: Record<string, number> = {}
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1
  }
  return Object.fromEntries(
    Object.entries(freq)
      .filter(([_, c]) => c >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n),
  )
}

const STOP_WORDS = new Set([
  'the', 'and', 'was', 'for', 'that', 'this', 'with', 'but', 'not', 'had',
  'have', 'his', 'her', 'she', 'they', 'you', 'are', 'all', 'been', 'were',
  'has', 'its', 'what', 'said', 'can', 'out', 'from', 'them', 'then',
  'very', 'when', 'than', 'some', 'been', 'just', 'like', 'into', 'over',
  'such', 'than', 'will', 'your', 'about', 'also', 'could', 'down', 'each',
  'been', 'how', 'more', 'most', 'much', 'only', 'other', 'their', 'there', 'well',
])

const content = computed(() => editorStore.content || bookStore.activeChapter?.content || '')
const plainText = computed(() => stripHtml(content.value))
const sentenceLengths = computed(() => getSentenceLengths(content.value))

const maxDistCount = computed(() => {
  const vals = Object.values(chapterStats.value.sentenceDist) as number[]
  return Math.max(...vals, 1)
})

const chapterStats = computed(() => {
  const text = plainText.value
  const sentences = countSentences(text)
  const lengths = sentenceLengths.value
  const dialogue = countDialogue(text)
  return {
    words: text.replace(/\s/g, '').length,
    sentences,
    paragraphs: countParagraphs(content.value),
    avgSentenceLen: sentences > 0 ? Math.round(text.replace(/\s/g, '').length / sentences) : 0,
    maxSentenceLen: lengths.length > 0 ? Math.max(...lengths) : 0,
    dialogueRatio: dialogue.ratio,
    passiveCount: countPassive(text),
    readability: calcReadability(text),
    sentenceDist: getSentenceDist(lengths),
    topWords: getTopWords(text, 30),
  }
})

const bookStats = computed(() => {
  const book = bookStore.activeBook
  if (!book || book.chapters.length === 0) return null
  let totalWords = 0
  let totalDialogueRatio = 0
  for (const ch of book.chapters) {
    const text = stripHtml(ch.content)
    totalWords += text.replace(/\s/g, '').length
    totalDialogueRatio += countDialogue(text).ratio
  }
  return {
    totalWords,
    avgWordsPerChapter: Math.round(totalWords / book.chapters.length),
    avgDialogueRatio: Math.round(totalDialogueRatio / book.chapters.length),
  }
})

async function analyzeBook() {
  analyzing.value = true
  // Force reactivity update by toggling state
  await new Promise((r) => setTimeout(r, 100))
  analyzing.value = false
}
</script>

<style scoped>
.analytics-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
}

.header-actions { display: flex; gap: 4px; }

.btn-small {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}
.btn-small:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }

.analyzing-state {
  text-align: center;
  padding: 24px;
  color: var(--color-text-muted);
  font-size: 0.82rem;
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

.stat-section { display: flex; flex-direction: column; gap: 8px; }

.section-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.stat-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
}

.stat-value { font-size: 1.1rem; font-weight: 700; color: var(--color-accent); }
.stat-label { font-size: 0.65rem; color: var(--color-text-muted); }

.dist-bars { display: flex; flex-direction: column; gap: 4px; }

.dist-bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
}

.dist-bar-label { width: 36px; color: var(--color-text-muted); text-align: right; flex-shrink: 0; }

.dist-bar-track {
  flex: 1;
  height: 14px;
  background: var(--color-hover);
  border-radius: 7px;
  overflow: hidden;
}

.dist-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 7px;
  transition: width 0.3s ease;
  opacity: 0.7;
}

.dist-bar-count { width: 20px; color: var(--color-text-muted); font-size: 0.65rem; text-align: right; }

.word-list { display: flex; flex-wrap: wrap; gap: 4px; }

.word-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-hover);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.74rem;
}

.word-text { color: var(--color-text); }
.word-count { color: var(--color-text-muted); font-size: 0.65rem; }

.empty-hint {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  padding: 8px;
}
</style>
