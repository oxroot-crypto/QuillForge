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
        <button class="cli-btn" title="复制全部" @click="copyAll">&#128203;</button>
        <button class="cli-btn" title="清除" @click="clearHistory">&#128465;</button>
        <button class="cli-btn" title="关闭" @click="$emit('close')">&#10005;</button>
      </div>
    </div>

    <!-- Messages -->
    <div class="cli-body" ref="bodyRef" @click="focusInput">
      <!-- Welcome -->
      <div v-if="messages.length === 0" class="cli-welcome">
        <div class="welcome-logo">⚡ QuillForge Agents</div>
        <div class="welcome-sub">{{ $t('agents.welcome') }} — 能读、能写、能改的 AI 助手</div>
        <div class="welcome-hint">
          <span>直接说出你的需求，例如:</span>
          <code class="hint-example">「审阅第三章，找出角色不一致的地方」</code>
          <code class="hint-example">「帮我创建一个反派角色」</code>
          <code class="hint-example">「润色选中的这段文字，让它更有张力」</code>
          <code class="hint-example">「写一个200字的新章节作为过渡」</code>
        </div>
        <div class="welcome-help">
          <span @click="showHelpCmd">输入 /help 查看所有命令</span>
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

        <!-- AI response -->
        <template v-else-if="msg.role === 'assistant'">
          <div class="msg-label-ai">✦</div>
          <div class="msg-text-ai" v-html="renderMarkdown(msg.content)"></div>
          <div class="msg-actions">
            <button class="msg-btn" title="复制" @click="copyText(msg.content)">&#128203;</button>
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
        <button v-if="running" class="cli-send cli-stop" @click="cancelAgent" title="中断">&#9632;</button>
        <button v-else class="cli-send" :disabled="!input.trim()" @click="onSubmit">&#x2191;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useBookStore } from '@/stores/book'
import { useSettingsStore } from '@/stores/settings'
import { checkProviderConnection } from '@/commands/ai'
import { saveSnapshot as saveSnapshotCmd } from '@/commands/history'
import { runAgent } from '@/agents/engine'
import { createTools, type ToolContext } from '@/agents/tools'
import type { AgentMessage } from '@/agents/types'
import { countWords } from '@/utils/content'

const props = defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

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

interface CliMessage {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error'
  content: string
  toolCall?: { name: string; args: Record<string, any> }
  status?: 'running' | 'done'
}

const messages = ref<CliMessage[]>([])
const history = ref<string[]>([])
const historyIndex = ref(-1)

// ── Agent Context (bridge to Pinia stores) ──
function buildToolContext(): ToolContext {
  return {
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
    updateWorldSetting: (text: string) => {
      if (bookStore.activeBookId) {
        bookStore.updateBookMeta(bookStore.activeBookId, { worldSetting: text })
      }
    },
    updateStorySetting: (text: string) => {
      if (bookStore.activeBookId) {
        bookStore.updateBookMeta(bookStore.activeBookId, { storySetting: text })
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
      outline: bookStore.buildOutlineContext() || '',
      characters: (book?.characters || [])
        .filter((c: any) => c.name)
        .map((c: any) => ({ name: c.name, role: c.role, description: c.description || '' })),
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

function formatArgs(args: Record<string, any>): string {
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
      let help = '═ QuillForge Agents 命令 ═\n\n'
      help += '你可以不用命令，直接用自然语言描述需求，Agent 会自动调用工具。\n\n'
      help += '▸ 可用命令:\n'
      help += '  /help          显示此帮助\n'
      help += '  /clear         清除对话\n'
      help += '  /context       显示当前上下文\n'
      help += '  /retry         重新执行上一条指令\n\n'
      help += '▸ 常用场景示例:\n'
      help += '  「审阅当前章节，找出问题」\n'
      help += '  「把主角改成 25 岁，更新角色描述」\n'
      help += '  「在章节末尾追加一段战斗描写」\n'
      help += '  「保存快照，然后把对话改得更自然」\n'
      help += '  「给我写一个世界观设定，修仙世界，三界六道」'
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

onMounted(() => { checkConnection() })
onBeforeUnmount(() => { if (connTimer) clearTimeout(connTimer) })

watch(() => props.visible, (v) => { if (v) nextTick(() => inputRef.value?.focus()) })
</script>

<style scoped>
.agents-cli {
  border-top: 2px solid var(--color-border);
  background: #0b1120;
  color: #e2e8f0;
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
.cli-resize-handle:hover { background: rgba(99,102,241,0.3); }
.cli-resize-handle::before {
  content: '';
  position: absolute;
  top: 3px; left: 50%;
  transform: translateX(-50%);
  width: 40px; height: 2px;
  background: #334155;
  border-radius: 2px;
}

/* ── Header ── */
.cli-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}
.cli-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 0.72rem;
  color: #818cf8;
  letter-spacing: 0.3px;
}
.cli-indicator {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  transition: background 0.3s;
}
.cli-indicator.online { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,0.5); }
.cli-badge {
  font-size: 0.6rem;
  font-weight: 500;
  background: #1e293b;
  color: #64748b;
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
  background: transparent; border: none; color: #475569;
  cursor: pointer; padding: 2px 5px; font-size: 0.75rem;
  border-radius: 3px; transition: all 0.15s; line-height: 1;
}
.cli-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.06); }

/* ── Body ── */
.cli-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
  cursor: text;
  scroll-behavior: smooth;
}
.cli-body::-webkit-scrollbar { width: 4px; }
.cli-body::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
.cli-body::-webkit-scrollbar-track { background: transparent; }

/* ── Welcome ── */
.cli-welcome { padding: 14px 10px; text-align: center; }
.welcome-logo { font-size: 1rem; font-weight: 700; color: #818cf8; margin-bottom: 4px; }
.welcome-sub { font-size: 0.7rem; color: #64748b; margin-bottom: 10px; }
.welcome-hint { display: flex; flex-direction: column; gap: 4px; align-items: center; margin-bottom: 8px; }
.welcome-hint span { font-size: 0.7rem; color: #475569; margin-bottom: 2px; }
.hint-example {
  font-size: 0.68rem;
  color: #22c55e;
  background: rgba(34,197,94,0.08);
  padding: 2px 10px;
  border-radius: 4px;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.welcome-help { font-size: 0.68rem; color: #6366f1; cursor: pointer; }
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
.msg-label-user { color: #f59e0b; font-weight: 700; font-size: 0.82rem; flex-shrink: 0; width: 16px; }
.msg-text-user { color: #fbbf24; font-size: 0.78rem; }

/* AI */
.msg-label-ai { color: #818cf8; font-weight: 700; font-size: 0.82rem; flex-shrink: 0; width: 16px; }
.msg-text-ai { flex: 1; font-size: 0.78rem; color: #e2e8f0; min-width: 0; word-break: break-word; line-height: 1.6; }
.msg-text-ai :deep(pre) { background: #0f172a; border: 1px solid #1e293b; border-radius: 4px; padding: 6px 8px; margin: 4px 0; overflow-x: auto; font-size: 0.72rem; color: #a5b4fc; }
.msg-text-ai :deep(.ic) { background: #1e293b; padding: 1px 4px; border-radius: 3px; font-size: 0.74rem; color: #f472b6; }
.msg-text-ai :deep(.h1) { font-size: 0.88rem; font-weight: 700; color: #f1f5f9; margin: 6px 0 3px; }
.msg-text-ai :deep(.h2) { font-size: 0.82rem; font-weight: 700; color: #e2e8f0; margin: 5px 0 2px; }
.msg-text-ai :deep(.h3) { font-size: 0.78rem; font-weight: 600; color: #cbd5e1; margin: 4px 0 2px; }
.msg-text-ai :deep(blockquote) { border-left: 2px solid #6366f1; padding: 2px 10px; margin: 4px 0; color: #94a3b8; font-style: italic; }
.msg-text-ai :deep(strong) { color: #f1f5f9; font-weight: 700; }
.msg-text-ai :deep(em) { color: #cbd5e1; font-style: italic; }

/* Tool call */
.msg-label-tool { color: #22c55e; font-size: 0.75rem; flex-shrink: 0; width: 16px; text-align: center; }
.msg-body-tool { flex: 1; font-size: 0.72rem; display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }
.tool-name { color: #22c55e; font-weight: 600; }
.tool-args { color: #64748b; font-size: 0.68rem; }
.tool-status { font-size: 0.65rem; }
.tool-status.running { color: #f59e0b; animation: pulse 1.2s ease-in-out infinite; }
.label-done { color: #22c55e; }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
.tool-result-text { color: #94a3b8; font-size: 0.68rem; margin: 0; white-space: pre-wrap; }
.text-error { color: #f87171; }
.label-error { color: #ef4444; }

/* Error */
.msg-label-error { color: #ef4444; font-weight: 700; flex-shrink: 0; width: 16px; }
.msg-text-error { color: #f87171; font-size: 0.78rem; }

.msg-actions { flex-shrink: 0; opacity: 0; transition: opacity 0.15s; padding-top: 2px; }
.cli-msg:hover .msg-actions { opacity: 1; }
.msg-btn { background: transparent; border: none; color: #475569; cursor: pointer; font-size: 0.68rem; padding: 2px 4px; border-radius: 3px; }
.msg-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.06); }

/* ── Thinking indicator ── */
.agent-thinking { padding: 6px 22px; }
.thinking-bar { display: flex; align-items: center; gap: 4px; }
.think-dot { width: 5px; height: 5px; border-radius: 50%; background: #818cf8; animation: thinkPulse 1.2s ease-in-out infinite; }
.think-dot:nth-child(2) { animation-delay: 0.2s; }
.think-dot:nth-child(3) { animation-delay: 0.4s; }
.think-text { font-size: 0.65rem; color: #64748b; margin-left: 4px; }
@keyframes thinkPulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }

/* ── Footer ── */
.cli-footer { flex-shrink: 0; border-top: 1px solid #1e293b; }
.cli-ctxbar {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 10px; background: #0f172a;
  font-size: 0.58rem; color: #475569;
  border-bottom: 1px solid #1e293b;
}
.ctx-book { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctx-chapter { color: #6366f1; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctx-sep { color: #334155; }
.cli-input-row {
  display: flex; align-items: flex-end; gap: 6px;
  padding: 6px 10px; background: #0f172a;
}
.cli-input {
  flex: 1;
  background: #1e293b; border: 1px solid #334155; color: #e2e8f0;
  font-family: inherit; font-size: 0.78rem;
  padding: 7px 10px; border-radius: 6px;
  outline: none; resize: none; line-height: 1.5;
  min-height: 32px; max-height: 120px;
}
.cli-input::placeholder { color: #475569; }
.cli-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
.cli-input:disabled { opacity: 0.35; }
.cli-send {
  background: #6366f1; color: #fff; border: none;
  width: 30px; height: 30px; border-radius: 6px;
  cursor: pointer; font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background 0.15s;
}
.cli-send:hover:not(:disabled) { background: #4f46e5; }
.cli-send:disabled { opacity: 0.35; cursor: not-allowed; }
.cli-stop { background: #ef4444; font-size: 0.8rem; }
.cli-stop:hover:not(:disabled) { background: #dc2626; }
</style>
