// Agent 工具实现——编辑、创建、角色、设定等工具的定义和执行函数。
// 通过 ToolContext 桥接 Pinia store，所有对书籍/章节的修改都经 store 方法完成。
import type { AgentTool } from './types'
import type { Book, Chapter, Character } from '@/types'
import { countWords, stripHtml } from '@/utils/content'

/** 转换 AI 传入的转义字符——\\n → 真实换行，\\t → tab */
function unescapeText(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

/** 将纯文本段落转为简单 HTML——双换行分段，单换行转 <br> */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/**
 * 按章节标题（模糊匹配）或 ID 解析目标章节。
 * 不传 chapter 参数时回退到当前活跃章节。
 */
function resolveChapter(ctx: ToolContext, args: Record<string, string>): { id: string; title: string; content: string; status: string } | null {
  if (args.chapter) {
    const chapters = ctx.listChapters()
    const match = chapters.find(c => c.title.includes(String(args.chapter)) || c.id === args.chapter)
    if (match) return ctx.getChapterById(match.id) ?? null
  }
  return ctx.getChapter() ?? null
}

/** 查找章节关联的大纲——用于 edit / append 时提醒 AI 遵循大纲 */
function getOutlineForChapter(ctx: ToolContext, chapterId: string): string {
  const outlines = ctx.listOutlines()
  const outline = outlines.find((o) => o.chapterId === chapterId)
  if (!outline?.description) return ''
  return `\n📋 本章大纲要求：${outline.description}`
}

/** 章节未找到时的错误提示——列出所有可用章节供 AI 参考 */
function noChapterError(ctx: ToolContext, args: Record<string, string>): string {
  const chapters = ctx.listChapters()
  const list = chapters.length > 0
    ? chapters.map(c => `  · ${c.title} (${c.words}字)`).join('\n')
    : '  当前书籍没有任何章节，请先调用 create_chapter 创建章节。'
  return `错误：找不到章节${args.chapter ? `「${args.chapter}」` : ''}。\n现有章节:\n${list}`
}

// ── Tool Implementations ──
// These receive a context object with store accessors at runtime.

/**
 * 工具执行时的运行时上下文——桥接 Pinia store，提供对书籍/章节/角色/设定数据的读写。
 * 每个方法签名与 bookStore / editorStore 的对应方法保持一致。
 */
export interface ToolContext {
  getBook: () => Book | null | undefined
  getChapter: () => Chapter | null | undefined
  getChapterById: (id: string) => Chapter | null | undefined
  getSelectedText: () => string
  updateChapter: (content: string) => void
  updateChapterById: (chapterId: string, content: string) => void
  renameChapter: (title: string) => void
  renameChapterById: (chapterId: string, title: string) => void
  createChapter: (title: string) => Chapter | undefined
  deleteChapter: (id: string) => void
  addCharacter: (char: { name: string; role: string; description: string }) => Character | undefined
  updateCharacter: (id: string, data: Partial<Pick<Character, 'name' | 'role' | 'description'>>) => void
  deleteCharacter: (id: string) => void
  createBook: (title: string) => Book | undefined
  updateBookMeta: (data: Record<string, string>) => void
  saveSnapshotById: (chapterId: string, label: string) => Promise<void>
  addOutlineItem: (chapterId: string, description: string) => string | undefined
  updateOutlineItem: (outlineId: string, description: string) => void
  deleteOutlineItem: (outlineId: string) => void
  listOutlines: () => { id: string; title: string; chapterId?: string; description: string }[]
  listChapters: () => { id: string; title: string; words: number; status: string }[]
  getOutline: () => string
  getStats: () => { chapters: number; words: number; characters: number }
  getTodayStats: () => { wordsWritten: number; writingMinutes: number }
  getStreak: () => number
  getDailyGoal: () => number
}

export function createTools(ctx: ToolContext): AgentTool[] {
  return [
    // ── Book lifecycle ──
    {
      name: 'create_book',
      description: '创建一本新书。仅在当前没有任何书籍时调用。创建成功后自动切换为当前书。',
      parameters: {
        title: { type: 'string', description: '书名', required: true },
      },
      execute: async (args) => {
        const title = String(args.title || '').trim()
        if (!title) return '错误：书名不能为空。'
        const existing = ctx.getBook()
        if (existing) return `错误：已存在书籍「${existing.title}」，不需要重复创建。直接在当前书里操作即可。`
        const book = ctx.createBook(title)
        if (!book) return '错误：创建书籍失败。'
        return `✅ 已创建书籍「${title}」，现在可以添加世界观、角色和章节了。`
      },
    },
    // ── Read tools ──
    {
      name: 'read_chapter',
      description: '读取指定章节的完整内容。不传 chapter 则读取当前选中章节。',
      parameters: {
        chapter: { type: 'string', description: '可选：章节标题（支持模糊匹配）或章节ID' },
      },
      execute: async (args) => {
        const ch = resolveChapter(ctx, args)
        if (!ch) return noChapterError(ctx, args)
        const plain = stripHtml(ch.content)
        return `章节: ${ch.title || '未命名'}\n字数: ${countWords(ch.content)}\n状态: ${ch.status}\n\n内容:\n${plain.slice(0, 4000)}${plain.length > 4000 ? '\n...(内容较长，已截断)' : ''}`
      },
    },
    {
      name: 'read_book_info',
      description: '读取当前书籍的全部信息：书名、简介、世界观、剧情总结、章节列表、大纲（含ID）、角色（含ID）、写作统计。一次调用获取所有上下文。',
      parameters: {},
      execute: async () => {
        const book = ctx.getBook()
        if (!book) return '没有打开的书籍。'
        let result = `书名: ${book.title}\n`
        if (book.description) result += `简介: ${book.description}\n`
        if (book.worldSetting) result += `\n【世界观】\n${book.worldSetting}\n`
        if (book.storySetting) result += `\n【剧情总结】\n${book.storySetting}\n`
        // 章节列表
        const chList = ctx.listChapters()
        result += `\n【章节 (${chList.length}章)】\n`
        result += chList.length > 0
          ? chList.map((c, i) => `${i + 1}. ${c.title || '未命名'} (${c.words}字, ${c.status})`).join('\n')
          : '  暂无章节'
        result += '\n'
        // 大纲
        const outlines = ctx.listOutlines()
        if (outlines.length > 0) {
          result += `\n【大纲 (${outlines.length}项)】\n`
          result += outlines.map((o, i) => `  [${o.id}] ${o.title || '未关联'}：${o.description?.slice(0, 100) || '(无描述)'}`).join('\n')
          result += '\n'
        }
        // 角色
        if (book.characters.length > 0) {
          result += `\n【角色 (${book.characters.length}个)】\n`
          result += book.characters
            .filter((c) => c.name)
            .map((c) => `  [${c.id}] ${c.name} (${c.role}): ${c.description || '无描述'}`)
            .join('\n')
          result += '\n'
        }
        // 统计
        const stats = ctx.getStats()
        const today = ctx.getTodayStats()
        const streak = ctx.getStreak()
        const goal = ctx.getDailyGoal()
        result += `\n📊 统计: ${stats.chapters}章 / ${stats.words}字 / ${stats.characters}角色`
        result += `\n📝 今日: ${today.wordsWritten}字 / ${today.writingMinutes}分钟`
        if (streak > 0) result += ` / 连续${streak}天`
        if (goal > 0) result += ` / 目标${goal}字`
        return result
      },
    },

// ── Write tools ──
    {
      name: 'edit_chapter',
      description: '编辑章节内容。用新的内容替换整个章节。不传 chapter 则编辑当前选中章节。修改前会自动保存快照备份。',
      parameters: {
        content: { type: 'string', description: '新的章节内容（纯文本，会自动转换为HTML格式）', required: true },
        title: { type: 'string', description: '可选的新章节标题' },
        chapter: { type: 'string', description: '可选：章节标题（支持模糊匹配）或章节ID' },
      },
      execute: async (args) => {
        const ch = resolveChapter(ctx, args)
        if (!ch) return noChapterError(ctx, args)
        const content = unescapeText(String(args.content || ''))
        if (!content.trim()) return '错误：内容不能为空。'
        // Auto-save snapshot if chapter has existing content
        const plainOld = stripHtml(ch.content)
        if (plainOld.length > 0) {
          await ctx.saveSnapshotById(ch.id, 'AI编辑前备份')
        }
        const html = textToHtml(content)
        ctx.updateChapterById(ch.id, html)
        if (args.title) ctx.renameChapterById(ch.id, String(args.title))
        const snapshotLabel = plainOld.length > 0 ? '，已自动保存原版快照' : ''
        const outlineHint = getOutlineForChapter(ctx, ch.id)
        return `✅ 章节「${ch.title}」已更新。\n新字数: ${countWords(html)}字${snapshotLabel}${args.title ? `\n新标题: ${args.title}` : ''}${outlineHint}`
      },
    },
    {
      name: 'append_chapter',
      description: '在指定章节末尾追加内容。不传 chapter 则追加到当前选中章节。修改前会自动保存快照备份。',
      parameters: {
        content: { type: 'string', description: '要追加的内容（纯文本）', required: true },
        chapter: { type: 'string', description: '可选：章节标题（支持模糊匹配）或章节ID' },
      },
      execute: async (args) => {
        const ch = resolveChapter(ctx, args)
        if (!ch) return noChapterError(ctx, args)
        const appendText = unescapeText(String(args.content || '').trim())
        if (!appendText) return '错误：追加内容不能为空。'
        // Auto-save snapshot if chapter has existing content
        const plainOld = stripHtml(ch.content)
        if (plainOld.length > 0) {
          await ctx.saveSnapshotById(ch.id, 'AI追加前备份')
        }
        const newHtml = ch.content.replace('</div>\n</div>', '') + `<p>${appendText.replace(/\n/g, '<br>')}</p>`
        ctx.updateChapterById(ch.id, newHtml)
        const snapshotLabel = plainOld.length > 0 ? '，已自动保存快照' : ''
        const outlineHint = getOutlineForChapter(ctx, ch.id)
        return `✅ 已追加 ${countWords(appendText)} 字内容到章节「${ch.title}」末尾${snapshotLabel}。${outlineHint}`
      },
    },
    {
      name: 'create_chapter',
      description: '创建新章节。可同时指定大纲描述（推荐批量建大纲时使用），也可带初始正文。',
      parameters: {
        title: { type: 'string', description: '章节标题', required: true },
        outline: { type: 'string', description: '可选：大纲描述——剧情要点、伏笔、冲突等。传了则自动创建关联大纲项' },
        content: { type: 'string', description: '可选：章节初始正文（纯文本，少于20字会被拒绝）' },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        const title = String(args.title || '新章节').trim()
        if (!title) return '错误：章节标题不能为空。'
        // Check for duplicate title
        const existing = ctx.listChapters().find(c => c.title === title)
        if (existing) {
          const hint = args.outline
            ? `章节「${title}」已存在！如果需要补大纲，请用 create_outline | chapter=${title} | description=...`
            : `错误：章节「${title}」已存在！用 edit_chapter 写入内容，或用 create_outline 补大纲。`
          return hint
        }
        // Handle optional content
        const rawContent = unescapeText(String(args.content || '').trim())
        if (rawContent && countWords(rawContent) < 20) {
          return `错误：章节内容太少（${countWords(rawContent)}字），请至少写20字以上。如仅建空章请去掉 content 参数。`
        }
        const htmlContent = rawContent ? textToHtml(rawContent) : ''
        const chapter = ctx.createChapter(title)
        if (!chapter) return '错误：创建章节失败。'
        if (htmlContent) ctx.updateChapter(htmlContent)
        // Handle optional outline
        let outlineMsg = ''
        if (args.outline) {
          const desc = unescapeText(String(args.outline).trim())
          if (desc) {
            const outlineId = ctx.addOutlineItem(chapter.id, desc)
            if (outlineId) outlineMsg = ` + 大纲 [${outlineId}]`
          }
        }
        return `✅ 已创建章节「${title}」${htmlContent ? `(${countWords(htmlContent)}字)` : ''}${outlineMsg}`
      },
    },
    {
      name: 'rename_chapter',
      description: '重命名指定章节。不传 chapter 则重命名当前选中章节。',
      parameters: {
        title: { type: 'string', description: '新标题', required: true },
        chapter: { type: 'string', description: '可选：要重命名的章节标题（支持模糊匹配）或章节ID' },
      },
      execute: async (args) => {
        const ch = resolveChapter(ctx, args)
        if (!ch) return noChapterError(ctx, args)
        const title = String(args.title || '').trim()
        if (!title) return '错误：标题不能为空。'
        ctx.renameChapterById(ch.id, title)
        return `✅ 章节「${ch.title}」已重命名为「${title}」`
      },
    },

    // ── Outline tools ──
    {
      name: 'create_outline',
      description: '为指定章节创建大纲项。先 create_chapter 创建章节（content 可省略），再用此工具添加大纲描述。',
      parameters: {
        chapter: { type: 'string', description: '章节标题（支持模糊匹配）或 ID', required: true },
        description: { type: 'string', description: '大纲描述——本章剧情要点、伏笔、核心冲突、角色互动等', required: true },
      },
      execute: async (args) => {
        const ch = resolveChapter(ctx, args)
        if (!ch) return noChapterError(ctx, args)
        const desc = unescapeText(String(args.description || '').trim())
        if (!desc) return '错误：大纲描述不能为空。'
        const outlineId = ctx.addOutlineItem(ch.id, desc)
        if (!outlineId) return '错误：创建大纲失败。'
        return `✅ 已为章节「${ch.title}」创建大纲 [${outlineId}]：${desc.slice(0, 60)}${desc.length > 60 ? '…' : ''}`
      },
    },
    {
      name: 'update_outline',
      description: '更新指定大纲项的描述。先 read_outline 查看大纲 ID。',
      parameters: {
        id: { type: 'string', description: '大纲项 ID（从 read_outline 获取）', required: true },
        description: { type: 'string', description: '新的大纲描述', required: true },
      },
      execute: async (args) => {
        const desc = unescapeText(String(args.description || '').trim())
        if (!desc) return '错误：大纲描述不能为空。'
        ctx.updateOutlineItem(String(args.id), desc)
        return `✅ 大纲项 [${args.id}] 已更新`
      },
    },
    {
      name: 'delete_outline',
      description: '删除指定大纲项。先 read_outline 查看大纲 ID。不会删除关联的章节。',
      parameters: {
        id: { type: 'string', description: '大纲项 ID（从 read_outline 获取）', required: true },
      },
      execute: async (args) => {
        ctx.deleteOutlineItem(String(args.id))
        return `✅ 大纲项 [${args.id}] 已删除`
      },
    },
    // ── Character tools ──
    {
      name: 'upsert_character',
      description: '添加或更新角色。传 id 且存在 → 更新；不传 id 或 id 不存在 → 新建。每次只能操作一个角色。',
      parameters: {
        name: { type: 'string', description: '角色名称', required: true },
        role: { type: 'string', description: '角色定位', enum: ['protagonist', 'supporting', 'antagonist', 'background'] },
        description: { type: 'string', description: '角色描述（外貌、性格、背景）' },
        id: { type: 'string', description: '可选：角色ID。传入且存在时更新而非新建' },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        const name = String(args.name || '').trim()
        if (!name) return '错误：角色名称不能为空。'
        const role = String(args.role || 'supporting')
        const desc = String(args.description || '')
        // Try update by id first, then by name
        let char = args.id ? book.characters.find((c) => c.id === args.id) : undefined
        if (!char && args.id) char = book.characters.find((c) => c.name === args.id || c.name === name)
        if (!char) char = book.characters.find((c) => c.name === name)
        if (char) {
          ctx.updateCharacter(char.id, { name, role, description: desc })
          return `✅ 角色「${char.name}」已更新 → 「${name}」(${role})`
        }
        ctx.addCharacter({ name, role, description: desc })
        return `✅ 已添加角色「${name}」(${role})`
      },
    },
    {
      name: 'delete_character',
      description: '删除角色。支持按 ID 或名称查找（优先 ID）。',
      parameters: {
        id: { type: 'string', description: '角色ID 或名称', required: true },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        let char = book.characters.find((c) => c.id === args.id || c.name === args.id)
        if (!char) {
          const ids = book.characters.filter((c) => c.name).map((c) => `  [${c.id}] ${c.name}`).join('\n')
          return `错误：未找到角色「${args.id}」。\n现有角色:\n${ids || '  无'}`
        }
        ctx.deleteCharacter(char.id)
        return `✅ 角色「${char.name}」已删除`
      },
    },

    // ── Book meta tools ──
    {
      name: 'update_book_info',
      description: '修改书籍的基本信息：书名（title）、简介（description）、世界观设定（worldSetting）、剧情总结（storySetting）。传哪些改哪些，不传的字段不变。',
      parameters: {
        title: { type: 'string', description: '新书名' },
        description: { type: 'string', description: '新简介' },
        worldSetting: { type: 'string', description: '新世界观设定' },
        storySetting: { type: 'string', description: '新剧情总结' },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        const data: Record<string, string> = {}
        if (args.title) data.title = String(args.title)
        if (args.description) data.description = String(args.description)
        if (args.worldSetting) data.worldSetting = unescapeText(String(args.worldSetting))
        if (args.storySetting) data.storySetting = unescapeText(String(args.storySetting))
        if (Object.keys(data).length === 0) {
          return '错误：至少需要传一个参数（title / description / worldSetting / storySetting）。'
        }
        ctx.updateBookMeta(data)
        const updatedFields = Object.keys(data).map(k => {
          const label: Record<string, string> = { title: '书名', description: '简介', worldSetting: '世界观', storySetting: '剧情总结' }
          return label[k] || k
        }).join('、')
        return `✅ 已更新${updatedFields}`
      },
    },
  ]
}
