<template>
  <div v-show="visible" class="agents-cli" :style="{ height: cliHeight + 'px' }">
    <!-- Drag resize handle -->
    <div class="cli-resize-handle" @mousedown.prevent="startResize"></div>
    <!-- Header -->
    <div class="cli-header">
      <span class="cli-title">
        <span class="cli-indicator" :class="{ online: connected }"></span>
        QuillForge Agents
        <span v-if="bookStore.activeBook" class="cli-badge" :title="bookStore.activeBook.title">
          {{ bookStore.activeBook.title }}
        </span>
      </span>
      <div class="cli-header-actions">
        <button
          class="cli-btn cli-detail-toggle"
          :class="{ active: showDetail }"
          :title="showDetail ? $t('agents.compactMode') : $t('agents.detailMode')"
          @click="showDetail = !showDetail"
        >{{ showDetail ? '&#128269;' : '&#128270;' }}</button>
        <button class="cli-btn" :title="$t('agents.copyAll')" @click="copyAll">&#128203;</button>
        <button class="cli-btn" :title="$t('agents.clear')" @click="clearHistory">&#128465;</button>
        <button class="cli-btn" :title="$t('agents.close')" @click="$emit('close')">&#10005;</button>
      </div>
    </div>

    <!-- Messages -->
    <div class="cli-body" ref="bodyRef" @click="focusInput">
      <!-- Welcome -->
      <div v-if="messages.length === 0" class="cli-welcome">
        <div class="welcome-logo">⚡ QuillForge Agents</div>
        <div class="welcome-sub">{{ $t('agents.welcome') }} — {{ $t('agents.welcomeTagline') }}</div>
        <div class="welcome-hint">
          <span>{{ $t('agents.welcomePrompt') }}</span>
          <code class="hint-example">「{{ $t('agents.welcomeEx1') }}」</code>
          <code class="hint-example">「{{ $t('agents.welcomeEx2') }}」</code>
          <code class="hint-example">「{{ $t('agents.welcomeEx3') }}」</code>
          <code class="hint-example">「{{ $t('agents.welcomeEx4') }}」</code>
        </div>
        <div class="welcome-help">
          <span @click="showHelpCmd">{{ $t('agents.welcomeHelp') }}</span>
        </div>
      </div>

      <!-- Message list -->
      <div v-for="(msg, i) in messages" :key="i" class="cli-msg" :class="msg.role">
        <!-- User message -->
        <template v-if="msg.role === 'user'">
          <div class="msg-label-user">&gt;</div>
          <div class="msg-text-user">{{ msg.content }}</div>
        </template>

        <!-- Tool call -->
        <template v-else-if="msg.role === 'tool_call'">
          <div class="msg-label-tool" :class="{ 'label-done': msg.status === 'done' }">{{ msg.status === 'done' ? '✓' : '🔧' }}</div>
          <div class="msg-body-tool">
            <span class="tool-name">{{ msg.toolCall?.name }}</span>
            <span v-if="msg.toolCall?.args && Object.keys(msg.toolCall.args).length > 0" class="tool-args">
              {{ formatArgs(msg.toolCall.args) }}
            </span>
            <span v-if="msg.status !== 'done'" class="tool-status running">⏳ 执行中...</span>
          </div>
        </template>

        <!-- Tool result -->
        <template v-else-if="msg.role === 'tool_result'">
          <div class="msg-label-tool" :class="{ 'label-error': isError(msg.content) }">{{ isError(msg.content) ? '✗' : '✓' }}</div>
          <div class="msg-body-tool">
            <pre class="tool-result-text" :class="{ 'text-error': isError(msg.content) }">{{ msg.content }}</pre>
          </div>
        </template>

        <!-- Raw LLM response (detail mode) -->
        <template v-else-if="msg.role === 'raw'">
          <details class="raw-response">
            <summary class="raw-summary">
              <span class="raw-label">{{ $t('agents.rawResponse') }}</span>
              <span class="raw-preview">{{ msg.content.slice(0, 80) }}{{ msg.content.length > 80 ? '...' : '' }}</span>
            </summary>
            <pre class="raw-content">{{ msg.content }}</pre>
          </details>
        </template>

        <!-- AI response -->
        <template v-else-if="msg.role === 'assistant'">
          <div class="msg-label-ai">✦</div>
          <div class="msg-text-ai" v-html="renderMarkdown(msg.content)"></div>
          <div class="msg-actions">
            <button class="msg-btn" :title="$t('agents.copyMsg')" @click="copyText(msg.content)">&#128203;</button>
          </div>
        </template>

        <!-- Error -->
        <template v-else-if="msg.role === 'error'">
          <div class="msg-label-error">✗</div>
          <div class="msg-text-error">{{ msg.content }}</div>
        </template>
      </div>

      <!-- Thinking indicator -->
      <div v-if="running" class="cli-msg agent-thinking">
        <div class="thinking-bar">
          <span class="think-dot"></span>
          <span class="think-dot"></span>
          <span class="think-dot"></span>
          <span class="think-text">Agent 思考中...</span>
        </div>
      </div>
    </div>

    <!-- Footer / Input -->
    <div class="cli-footer">
      <div class="cli-ctxbar" v-if="bookStore.activeBook">
        <span class="ctx-book">{{ bookStore.activeBook.title }}</span>
        <span v-if="bookStore.activeChapter" class="ctx-sep">/</span>
        <span v-if="bookStore.activeChapter" class="ctx-chapter">{{ bookStore.activeChapter.title || '未命名' }}</span>
      </div>
      <div class="cli-input-row">
        <textarea
          ref="inputRef"
          v-model="input"
          class="cli-input"
          placeholder="输入需求，AI Agent 会自动调用工具帮你完成..."
          :rows="Math.min(Math.max(input.split('\n').length, 1), 5)"
          @keydown.enter.prevent="onSubmit"
          @keydown.up.prevent="navigateHistory(-1)"
          @keydown.down.prevent="navigateHistory(1)"
          @keydown.escape="running ? cancelAgent() : undefined"
          :disabled="running"
        ></textarea>
        <button v-if="running" class="cli-send cli-stop" @click="cancelAgent" :title="$t('common.cancel')">&#9632;</button>
        <button v-else class="cli-send" :disabled="!input.trim()" @click="onSubmit">&#x2191;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/stores/editor'
import { useBookStore } from '@/stores/book'
import { useSettingsStore } from '@/stores/settings'
import { checkProviderConnection } from '@/commands/ai'
import { saveSnapshot as saveSnapshotCmd } from '@/commands/history'
import { runAgent } from '@/agents/engine'
import { createTools, type ToolContext } from '@/agents/tools'
import type { AgentMessage, CliMessage } from '@/agents/types'
import { countWords } from '@/utils/content'

const props = defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const editorStore = useEditorStore()
const bookStore = useBookStore()
const settingsStore = useSettingsStore()

// ── State ──
const bodyRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
const input = ref('')
const running = ref(false)
const cancelled = ref(false)
const connected = ref(false)
const cliHeight = ref(300)
const resizing = ref(false)

// 详细模式开关——控制是否展示 Agent 中间输出（LLM 原始响应文本）
// 偏好持久化到 localStorage，默认关闭（简洁模式）
const DETAIL_KEY = 'quillforge_agents_detail_mode'
const showDetail = ref(false)

// ── Resize ──
function startResize(e: MouseEvent) {
  resizing.value = true
  const startY = e.clientY
  const startH = cliHeight.value
  function onMove(ev: MouseEvent) {
    const delta = startY - ev.clientY
    cliHeight.value = Math.max(150, Math.min(600, startH + delta))
  }
  function onUp() {
    resizing.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

const messages = ref<CliMessage[]>([])
const history = ref<string[]>([])
const historyIndex = ref(-1)

// ── Agent Context (bridge to Pinia stores) ──
function buildToolContext(): ToolContext {
  return {
    createBook: (title: string) => {
      return bookStore.createBook(title)
    },
    getBook: () => bookStore.activeBook,
    getChapter: () => bookStore.activeChapter,
    getChapterById: (id: string) => {
      return bookStore.activeBook?.chapters.find(c => c.id === id) || null
    },
    getSelectedText: () => editorStore.selectedText,
    updateChapter: (content: string) => {
      if (bookStore.activeBookId && bookStore.activeChapterId) {
        bookStore.updateChapterContent(bookStore.activeBookId, bookStore.activeChapterId, content)
        editorStore.updateContent(content)
      }
    },
    updateChapterById: (chapterId: string, content: string) => {
      if (bookStore.activeBookId) {
        bookStore.updateChapterContent(bookStore.activeBookId, chapterId, content)
        if (bookStore.activeChapterId === chapterId) {
          editorStore.updateContent(content)
        }
      }
    },
    renameChapter: (title: string) => {
      if (bookStore.activeBookId && bookStore.activeChapterId) {
        bookStore.renameChapter(bookStore.activeBookId, bookStore.activeChapterId, title)
      }
    },
    renameChapterById: (chapterId: string, title: string) => {
      if (bookStore.activeBookId) {
        bookStore.renameChapter(bookStore.activeBookId, chapterId, title)
      }
    },
    createChapter: (title: string) => {
      return bookStore.createChapter(title)
    },
    deleteChapter: (id: string) => {
      bookStore.deleteChapter(bookStore.activeBookId, id)
    },
    addCharacter: (char) => {
      return bookStore.addCharacter(char)
    },
    updateCharacter: (id, data) => {
      bookStore.updateCharacter(id, data)
    },
    deleteCharacter: (id) => {
      bookStore.deleteCharacter(id)
    },
    updateBookMeta: (data: Record<string, string>) => {
      if (bookStore.activeBookId) {
        bookStore.updateBookMeta(bookStore.activeBookId, data as Partial<{ title: string; description: string; worldSetting: string; storySetting: string }>)
      }
    },
    saveSnapshotById: async (chapterId: string, label: string) => {
      if (bookStore.activeBookId) {
        const ch = bookStore.activeBook?.chapters.find(c => c.id === chapterId)
        if (ch) {
          await saveSnapshotCmd(bookStore.activeBookId, chapterId, ch.content, label, ch.title)
        }
      }
    },
    addOutlineItem: (chapterId: string, description: string) => {
      if (!bookStore.activeBookId) return undefined
      const ch = bookStore.activeBook?.chapters.find(c => c.id === chapterId)
      const item = bookStore.addOutlineItem({ chapterId, description, title: ch?.title || '' })
      if (item) bookStore.linkOutlineToChapter(item.id, chapterId)
      return item?.id
    },
    updateOutlineItem: (outlineId: string, description: string) => {
      if (bookStore.activeBookId) {
        bookStore.updateOutlineItem(outlineId, { description })
      }
    },
    deleteOutlineItem: (outlineId: string) => {
      if (bookStore.activeBookId) {
        bookStore.deleteOutlineItem(outlineId)
      }
    },
    listOutlines: () => {
      if (!bookStore.activeBook) return []
      return bookStore.activeBook.outline.map((o) => ({
        id: o.id,
        title: o.title || '',
        chapterId: o.chapterId,
        description: o.description || '',
      }))
    },
    listChapters: () => {
      return (bookStore.activeBookChapters || []).map((c) => ({
        id: c.id,
        title: c.title,
        words: countWords(c.content),
        status: c.status,
      }))
    },
    getOutline: () => {
      return bookStore.buildOutlineContext()
    },
    getStats: () => {
      return bookStore.activeBookId ? bookStore.getBookStats(bookStore.activeBookId) : { chapters: 0, words: 0, characters: 0 }
    },
    getTodayStats: () => bookStore.getTodayStats(),
    getStreak: () => bookStore.getWritingStreak(),
    getDailyGoal: () => bookStore.dailyGoal,
  }
}

// ── Core agent call ──
async function runAgentOnQuery(query: string) {
  const tools = createTools(buildToolContext())
  const book = bookStore.activeBook
  const chapter = bookStore.activeChapter

  running.value = true
  cancelled.value = false

  await runAgent(
    query,
    tools,
    {
      bookTitle: book?.title || '',
      bookDescription: book?.description || '',
      chapterTitle: chapter?.title || '',
      chapterCount: book?.chapters.length || 0,
      charCount: book?.characters.length || 0,
      wordCount: book?.chapters.reduce((s, c) => s + countWords(c.content), 0) || 0,
      worldSetting: book?.worldSetting || '',
      storySetting: book?.storySetting || '',
      outline: bookStore.activeBook?.outline?.length
        ? bookStore.activeBook.outline
            .map((o) => {
              const ch = bookStore.activeBook?.chapters.find(c => c.id === o.chapterId)
              return `  [${o.id}] ${ch?.title || '未关联'}：${o.description || ''}`
            })
            .join('\n')
        : '',
      characters: (book?.characters || [])
        .filter((c) => c.name)
        .map((c) => ({ name: c.name, role: c.role, description: c.description || '' })),
    },
    settingsStore.modelConfig,
    // onMessage - final AI response
    (msg) => {
      messages.value.push({ role: 'assistant', content: msg.content })
    },
    // onToolCall
    (tc) => {
      messages.value.push({
        role: 'tool_call',
        content: '',
        toolCall: { name: tc.name, args: tc.args },
        status: 'running',
      })
    },
    // onToolResult — mark last tool_call as done
    (result) => {
      for (let i = messages.value.length - 1; i >= 0; i--) {
        if (messages.value[i].role === 'tool_call' && messages.value[i].status === 'running') {
          messages.value[i].status = 'done'
          break
        }
      }
      messages.value.push({ role: 'tool_result', content: result })
    },
    // onDone
    () => {
      running.value = false
      scrollToBottom()
    },
    // onError
    (err) => {
      messages.value.push({ role: 'error', content: err })
      running.value = false
      scrollToBottom()
    },
    // isCancelled
    () => cancelled.value,
    // onRawMessage — 详细模式下展示 LLM 原始响应文本（在回调内检查以便运行时切换即时生效）
    (rawText) => {
      if (showDetail.value) {
        messages.value.push({ role: 'raw', content: rawText })
      }
    },
  )
}

// ── Message handling ──
function scrollToBottom() {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}

function addMessage(role: CliMessage['role'], content: string) {
  messages.value.push({ role, content })
  scrollToBottom()
}

function focusInput() {
  nextTick(() => inputRef.value?.focus())
}

function onSubmit() {
  const text = input.value.trim()
  if (!text || running.value) return
  input.value = ''
  nextTick(() => { if (inputRef.value) inputRef.value.style.height = 'auto' })

  history.value.unshift(text)
  if (history.value.length > 50) history.value.pop()
  historyIndex.value = -1

  if (text.startsWith('/')) {
    handleCommand(text)
  } else {
    // Send to agent
    messages.value.push({ role: 'user', content: text })
    scrollToBottom()
    runAgentOnQuery(text)
  }
}

function navigateHistory(dir: number) {
  if (history.value.length === 0) return
  historyIndex.value += dir
  if (historyIndex.value < -1) historyIndex.value = -1
  if (historyIndex.value >= history.value.length) historyIndex.value = history.value.length - 1
  input.value = history.value[historyIndex.value] || ''
}

function cancelAgent() {
  cancelled.value = true
  addMessage('assistant', '⏹ Agent 已中断')
  running.value = false
}

function clearHistory() {
  messages.value = []
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
}

function copyAll() {
  const text = messages.value
    .map((m) => {
      switch (m.role) {
        case 'user': return `> ${m.content}`
        case 'assistant': return `✦ ${m.content}`
        case 'tool_call': return `🔧 ${m.toolCall?.name} ${JSON.stringify(m.toolCall?.args)}`
        case 'tool_result': return `✓ ${m.content}`
        case 'error': return `! ${m.content}`
        default: return ''
      }
    })
    .join('\n---\n')
  navigator.clipboard.writeText(text)
}

function isError(text: string): boolean {
  return text.startsWith('❌') || text.startsWith('错误：') || text.startsWith('错误:')
}

function formatArgs(args: Record<string, string>): string {
  const entries = Object.entries(args)
  if (entries.length === 0) return ''
  return entries
    .map(([k, v]) => {
      const s = String(v)
      return s.length > 30 ? `${k}="..."` : `${k}="${v}"`
    })
    .join(' ')
}

function showHelpCmd() {
  handleCommand('/help')
}

// ── Commands ──
function handleCommand(text: string) {
  const parts = text.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1).join(' ')

  switch (cmd) {
    case '/help': {
      const h = t
      let help = `═ QuillForge Agents ═\n\n`
      help += `${h('agents.helpIntro')}\n\n`
      help += `▸ ${h('agents.helpCatBook')}\n`
      help += `  「${h('agents.helpBook1')}」\n`
      help += `  「${h('agents.helpBook2')}」\n`
      help += `  「${h('agents.helpBook3')}」\n\n`
      help += `▸ ${h('agents.helpCatOutline')}\n`
      help += `  「${h('agents.helpOutline1')}」\n`
      help += `  「${h('agents.helpOutline2')}」\n`
      help += `  「${h('agents.helpOutline3')}」\n\n`
      help += `▸ ${h('agents.helpCatChar')}\n`
      help += `  「${h('agents.helpChar1')}」\n`
      help += `  「${h('agents.helpChar2')}」\n`
      help += `  「${h('agents.helpChar3')}」\n\n`
      help += `▸ ${h('agents.helpCatChapter')}\n`
      help += `  「${h('agents.helpChapter1')}」\n`
      help += `  「${h('agents.helpChapter2')}」\n`
      help += `  「${h('agents.helpChapter3')}」\n\n`
      help += `▸ ${h('agents.helpCatReview')}\n`
      help += `  「${h('agents.helpReview1')}」\n`
      help += `  「${h('agents.helpReview2')}」\n\n`
      help += `▸ ${h('agents.helpCatCmd')}\n`
      help += `  ${h('agents.helpCmdLine')}`
      addMessage('assistant', help)
      break
    }
    case '/clear':
      clearHistory()
      break
    case '/context': {
      const book = bookStore.activeBook
      if (!book) {
        addMessage('assistant', '当前没有打开的书籍。')
        return
      }
      const ch = bookStore.activeChapter
      const wc = book.chapters.reduce((s, c) => s + countWords(c.content), 0)
      let ctx = `书籍: ${book.title}\n`
      ctx += `章节: ${book.chapters.length}章 / ${wc}字\n`
      ctx += `角色: ${book.characters.length}个\n`
      if (ch) ctx += `当前: ${ch.title || '未命名'} (${countWords(ch.content)}字)\n`
      const today = bookStore.getTodayStats()
      ctx += `今日: ${today.wordsWritten}字 / ${today.writingMinutes}分钟`
      addMessage('assistant', ctx)
      break
    }
    case '/retry': {
      const lastUser = [...messages.value].reverse().find((m) => m.role === 'user')
      if (lastUser) {
        messages.value.push({ role: 'user', content: `[重试] ${lastUser.content}` })
        runAgentOnQuery(lastUser.content)
      } else {
        addMessage('error', '没有可重试的指令。')
      }
      break
    }
    default:
      // Treat unknown /cmd as agent query
      messages.value.push({ role: 'user', content: text })
      runAgentOnQuery(text)
  }
}

// ── Markdown render (same as before) ──
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="ic">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<div class="h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="h2">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="h1">$1</div>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br>')
}

// ── Connection check ──
let connTimer: ReturnType<typeof setTimeout> | null = null
async function checkConnection() {
  try {
    await checkProviderConnection(settingsStore.modelConfig)
    connected.value = true
  } catch {
    connected.value = false
  }
  connTimer = setTimeout(checkConnection, 30000)
}

onMounted(() => {
  checkConnection()
  // 从 localStorage 恢复详细模式偏好
  const saved = localStorage.getItem(DETAIL_KEY)
  if (saved !== null) showDetail.value = saved === '1'
})
onBeforeUnmount(() => { if (connTimer) clearTimeout(connTimer) })

// 详细模式偏好变更时持久化到 localStorage
watch(showDetail, (v) => {
  localStorage.setItem(DETAIL_KEY, v ? '1' : '0')
})

watch(() => props.visible, (v) => { if (v) nextTick(() => inputRef.value?.focus()) })
</script>

<style scoped>
.agents-cli {
  border-top: 2px solid var(--color-border);
  background: var(--color-cli-bg);
  color: var(--color-cli-text);
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 150px;
  position: relative;
}
.cli-resize-handle {
  position: absolute;
  top: -4px; left: 0; right: 0;
  height: 8px;
  cursor: ns-resize;
  z-index: 10;
}
.cli-resize-handle:hover { background: color-mix(in srgb, var(--color-accent) 30%, transparent); }
.cli-resize-handle::before {
  content: '';
  position: absolute;
  top: 3px; left: 50%;
  transform: translateX(-50%);
  width: 40px; height: 2px;
  background: var(--color-cli-border-subtle);
  border-radius: 2px;
}

/* ── Header ── */
.cli-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: var(--color-cli-surface);
  border-bottom: 1px solid var(--color-cli-border);
  flex-shrink: 0;
}
.cli-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 0.72rem;
  color: var(--color-cli-accent);
  letter-spacing: 0.3px;
}
.cli-indicator {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--color-danger);
  flex-shrink: 0;
  transition: background 0.3s;
}
.cli-indicator.online { background: var(--color-success); box-shadow: 0 0 5px color-mix(in srgb, var(--color-success) 50%, transparent); }
.cli-badge {
  font-size: 0.6rem;
  font-weight: 500;
  background: var(--color-cli-surface-raised);
  color: var(--color-cli-text-dim);
  padding: 1px 5px;
  border-radius: 3px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  text-transform: none;
}
.cli-header-actions { display: flex; gap: 2px; }
.cli-btn {
  background: transparent; border: none; color: var(--color-cli-text-disabled);
  cursor: pointer; padding: 2px 5px; font-size: 0.75rem;
  border-radius: 3px; transition: all 0.15s; line-height: 1;
}
.cli-btn:hover { color: var(--color-cli-text-muted); background: color-mix(in srgb, var(--color-cli-text) 6%, transparent); }

/* ── Body ── */
.cli-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
  cursor: text;
  scroll-behavior: smooth;
}
.cli-body::-webkit-scrollbar { width: 4px; }
.cli-body::-webkit-scrollbar-thumb { background: var(--color-cli-surface-raised); border-radius: 2px; }
.cli-body::-webkit-scrollbar-track { background: transparent; }

/* ── Welcome ── */
.cli-welcome { padding: 14px 10px; text-align: center; }
.welcome-logo { font-size: 1rem; font-weight: 700; color: var(--color-cli-accent); margin-bottom: 4px; }
.welcome-sub { font-size: 0.7rem; color: var(--color-cli-text-dim); margin-bottom: 10px; }
.welcome-hint { display: flex; flex-direction: column; gap: 4px; align-items: center; margin-bottom: 8px; }
.welcome-hint span { font-size: 0.7rem; color: var(--color-cli-text-disabled); margin-bottom: 2px; }
.hint-example {
  font-size: 0.68rem;
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 8%, transparent);
  padding: 2px 10px;
  border-radius: 4px;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.welcome-help { font-size: 0.68rem; color: var(--color-accent); cursor: pointer; }
.welcome-help:hover { text-decoration: underline; }

/* ── Messages ── */
.cli-msg {
  display: flex;
  gap: 6px;
  margin-bottom: 5px;
  line-height: 1.5;
  animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-3px); }
  to { opacity: 1; transform: translateY(0); }
}

/* User */
.msg-label-user { color: var(--color-warning); font-weight: 700; font-size: 0.82rem; flex-shrink: 0; width: 16px; }
.msg-text-user { color: var(--color-warning); font-size: 0.78rem; }

/* AI */
.msg-label-ai { color: var(--color-cli-accent); font-weight: 700; font-size: 0.82rem; flex-shrink: 0; width: 16px; }
.msg-text-ai { flex: 1; font-size: 0.78rem; color: var(--color-cli-text); min-width: 0; word-break: break-word; line-height: 1.6; }
.msg-text-ai :deep(pre) { background: var(--color-cli-surface); border: 1px solid var(--color-cli-border); border-radius: 4px; padding: 6px 8px; margin: 4px 0; overflow-x: auto; font-size: 0.72rem; color: var(--color-cli-accent); }
.msg-text-ai :deep(.ic) { background: var(--color-cli-surface-raised); padding: 1px 4px; border-radius: 3px; font-size: 0.74rem; color: var(--color-accent); }
.msg-text-ai :deep(.h1) { font-size: 0.88rem; font-weight: 700; color: var(--color-cli-text); margin: 6px 0 3px; }
.msg-text-ai :deep(.h2) { font-size: 0.82rem; font-weight: 700; color: var(--color-cli-text); margin: 5px 0 2px; }
.msg-text-ai :deep(.h3) { font-size: 0.78rem; font-weight: 600; color: var(--color-cli-text-muted); margin: 4px 0 2px; }
.msg-text-ai :deep(blockquote) { border-left: 2px solid var(--color-accent); padding: 2px 10px; margin: 4px 0; color: var(--color-cli-text-muted); font-style: italic; }
.msg-text-ai :deep(strong) { color: var(--color-cli-text); font-weight: 700; }
.msg-text-ai :deep(em) { color: var(--color-cli-text-muted); font-style: italic; }

/* Tool call */
.msg-label-tool { color: var(--color-success); font-size: 0.75rem; flex-shrink: 0; width: 16px; text-align: center; }
.msg-body-tool { flex: 1; font-size: 0.72rem; display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }
.tool-name { color: var(--color-success); font-weight: 600; }
.tool-args { color: var(--color-cli-text-dim); font-size: 0.68rem; }
.tool-status { font-size: 0.65rem; }
.tool-status.running { color: var(--color-warning); animation: pulse 1.2s ease-in-out infinite; }
.label-done { color: var(--color-success); }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
.tool-result-text { color: var(--color-cli-text-muted); font-size: 0.68rem; margin: 0; white-space: pre-wrap; }
.text-error { color: var(--color-danger); }
.label-error { color: var(--color-danger); }

/* Error */
.msg-label-error { color: var(--color-danger); font-weight: 700; flex-shrink: 0; width: 16px; }
.msg-text-error { color: var(--color-danger); font-size: 0.78rem; }

.msg-actions { flex-shrink: 0; opacity: 0; transition: opacity 0.15s; padding-top: 2px; }
.cli-msg:hover .msg-actions { opacity: 1; }
.msg-btn { background: transparent; border: none; color: var(--color-cli-text-disabled); cursor: pointer; font-size: 0.68rem; padding: 2px 4px; border-radius: 3px; }
.msg-btn:hover { color: var(--color-cli-text-muted); background: color-mix(in srgb, var(--color-cli-text) 6%, transparent); }

/* ── Thinking indicator ── */
.agent-thinking { padding: 6px 22px; }
.thinking-bar { display: flex; align-items: center; gap: 4px; }
.think-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--color-cli-accent); animation: thinkPulse 1.2s ease-in-out infinite; }
.think-dot:nth-child(2) { animation-delay: 0.2s; }
.think-dot:nth-child(3) { animation-delay: 0.4s; }
.think-text { font-size: 0.65rem; color: var(--color-cli-text-dim); margin-left: 4px; }
@keyframes thinkPulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }

/* ── Footer ── */
.cli-footer { flex-shrink: 0; border-top: 1px solid var(--color-cli-border); }
.cli-ctxbar {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 10px; background: var(--color-cli-surface);
  font-size: 0.58rem; color: var(--color-cli-text-disabled);
  border-bottom: 1px solid var(--color-cli-border);
}
.ctx-book { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctx-chapter { color: var(--color-accent); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctx-sep { color: var(--color-cli-border-subtle); }
.cli-input-row {
  display: flex; align-items: flex-end; gap: 6px;
  padding: 6px 10px; background: var(--color-cli-surface);
}
.cli-input {
  flex: 1;
  background: var(--color-cli-surface-raised); border: 1px solid var(--color-cli-border-subtle); color: var(--color-cli-text);
  font-family: inherit; font-size: 0.78rem;
  padding: 7px 10px; border-radius: 6px;
  outline: none; resize: none; line-height: 1.5;
  min-height: 32px; max-height: 120px;
}
.cli-input::placeholder { color: var(--color-cli-text-disabled); }
.cli-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent); }
.cli-input:disabled { opacity: 0.35; }
.cli-send {
  background: var(--color-accent); color: var(--color-text-on-accent); border: none;
  width: 30px; height: 30px; border-radius: 6px;
  cursor: pointer; font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background 0.15s;
}
.cli-send:hover:not(:disabled) { background: var(--color-accent-hover); }
.cli-send:disabled { opacity: 0.35; cursor: not-allowed; }
.cli-stop { background: var(--color-danger); font-size: 0.8rem; }
.cli-stop:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger) 75%, black); }

/* ── Raw LLM response (detail mode) ── */
.raw-response {
  margin: 2px 0 4px 22px;
  font-size: 0.68rem;
}
.raw-summary {
  cursor: pointer;
  color: var(--color-cli-text-disabled);
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 2px 0;
  user-select: none;
  list-style: none;
}
.raw-summary::-webkit-details-marker { display: none; }
.raw-summary:hover { color: var(--color-cli-text-dim); }
.raw-summary::before {
  content: '▸';
  display: inline-block;
  font-size: 0.6rem;
  transition: transform 0.15s;
  flex-shrink: 0;
}
details[open] > .raw-summary::before { transform: rotate(90deg); }
.raw-label {
  font-weight: 600;
  color: var(--color-cli-accent);
  font-size: 0.65rem;
  flex-shrink: 0;
}
.raw-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: italic;
}
.raw-content {
  background: var(--color-cli-surface);
  border: 1px solid var(--color-cli-border-subtle);
  border-radius: 4px;
  padding: 6px 8px;
  margin: 4px 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.66rem;
  color: var(--color-cli-text-muted);
  max-height: 300px;
  overflow-y: auto;
}

/* ── Detail toggle button ── */
.cli-detail-toggle.active {
  color: var(--color-accent) !important;
}
</style>
