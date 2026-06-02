import type { AgentTool, AgentContext } from './types'
import { countWords, stripHtml } from '@/utils/content'

function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// Find chapter by title substring or ID; fall back to active chapter
function resolveChapter(ctx: ToolContext, args: Record<string, any>): { id: string; title: string; content: string; status: string } | null {
  if (args.chapter) {
    const chapters = ctx.listChapters()
    const match = chapters.find(c => c.title.includes(String(args.chapter)) || c.id === args.chapter)
    if (match) return ctx.getChapterById(match.id)
  }
  return ctx.getChapter()
}

// Error message when chapter not found, listing available ones
function noChapterError(ctx: ToolContext, args: Record<string, any>): string {
  const chapters = ctx.listChapters()
  const list = chapters.length > 0
    ? chapters.map(c => `  · ${c.title} (${c.words}字)`).join('\n')
    : '  当前书籍没有任何章节，请先调用 create_chapter 创建章节。'
  return `错误：找不到章节${args.chapter ? `「${args.chapter}」` : ''}。\n现有章节:\n${list}`
}

// ── Tool Implementations ──
// These receive a context object with store accessors at runtime.

export interface ToolContext {
  getBook: () => any
  getChapter: () => any
  getChapterById: (id: string) => any
  getSelectedText: () => string
  updateChapter: (content: string) => void
  updateChapterById: (chapterId: string, content: string) => void
  renameChapter: (title: string) => void
  renameChapterById: (chapterId: string, title: string) => void
  createChapter: (title: string) => any
  deleteChapter: (id: string) => void
  addCharacter: (char: { name: string; role: string; description: string }) => any
  updateCharacter: (id: string, data: any) => void
  deleteCharacter: (id: string) => void
  updateWorldSetting: (text: string) => void
  updateStorySetting: (text: string) => void
  saveSnapshotById: (chapterId: string, label: string) => Promise<void>
  listChapters: () => { id: string; title: string; words: number; status: string }[]
  getOutline: () => string
  getStats: () => any
  getTodayStats: () => { wordsWritten: number; writingMinutes: number }
  getStreak: () => number
  getDailyGoal: () => number
}

export function createTools(ctx: ToolContext): AgentTool[] {
  return [
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
      name: 'read_chapters_list',
      description: '列出当前书籍的所有章节',
      parameters: {},
      execute: async () => {
        const list = ctx.listChapters()
        if (list.length === 0) return '当前书籍没有章节。'
        return list.map((c, i) => `${i + 1}. ${c.title || '未命名'} (${c.words}字, ${c.status})`).join('\n')
      },
    },
    {
      name: 'read_selection',
      description: '读取编辑器中选中的文本',
      parameters: {},
      execute: async () => {
        const sel = ctx.getSelectedText()
        if (!sel) return '没有选中的文本。'
        return `选中文本 (${countWords(sel)}字):\n${stripHtml(sel).slice(0, 2000)}`
      },
    },
    {
      name: 'read_book_info',
      description: '读取当前书籍的设定信息（世界观、角色、大纲）',
      parameters: {},
      execute: async () => {
        const book = ctx.getBook()
        if (!book) return '没有打开的书籍。'
        let result = `书名: ${book.title}\n`
        if (book.description) result += `简介: ${book.description}\n`
        if (book.worldSetting) result += `\n【世界观】\n${book.worldSetting}\n`
        if (book.storySetting) result += `\n【剧情总结】\n${book.storySetting}\n`
        const outline = ctx.getOutline()
        if (outline) result += `\n【大纲】\n${outline}\n`
        if (book.characters.length > 0) {
          result += `\n【角色 (${book.characters.length}个)】\n`
          result += book.characters
            .filter((c: any) => c.name)
            .map((c: any) => `  [${c.id}] ${c.name} (${c.role}): ${c.description || '无描述'}`)
            .join('\n')
        }
        return result
      },
    },
    {
      name: 'read_stats',
      description: '读取写作统计数据',
      parameters: {},
      execute: async () => {
        const book = ctx.getBook()
        const stats = ctx.getStats()
        const today = ctx.getTodayStats()
        const streak = ctx.getStreak()
        const goal = ctx.getDailyGoal()
        let result = `📊 全书统计\n`
        result += `  章节数: ${stats.chapters}\n`
        result += `  总字数: ${stats.words}\n`
        result += `  角色数: ${stats.characters}\n`
        result += `\n📝 今日写作\n`
        result += `  已写: ${today.wordsWritten}字\n`
        result += `  时长: ${today.writingMinutes}分钟\n`
        if (streak > 0) result += `  连续写作: ${streak}天 🔥\n`
        if (goal > 0) result += `  目标: ${today.wordsWritten}/${goal}字\n`
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
        const content = String(args.content || '')
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
        return `✅ 章节「${ch.title}」已更新。\n新字数: ${countWords(html)}字${snapshotLabel}${args.title ? `\n新标题: ${args.title}` : ''}`
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
        const appendText = String(args.content || '').trim()
        if (!appendText) return '错误：追加内容不能为空。'
        // Auto-save snapshot if chapter has existing content
        const plainOld = stripHtml(ch.content)
        if (plainOld.length > 0) {
          await ctx.saveSnapshotById(ch.id, 'AI追加前备份')
        }
        const newHtml = ch.content.replace('</div>\n</div>', '') + `<p>${appendText.replace(/\n/g, '<br>')}</p>`
        ctx.updateChapterById(ch.id, newHtml)
        const snapshotLabel = plainOld.length > 0 ? '，已自动保存快照' : ''
        return `✅ 已追加 ${countWords(appendText)} 字内容到章节「${ch.title}」末尾${snapshotLabel}。`
      },
    },
    {
      name: 'create_chapter',
      description: '在书籍中创建一个新章节',
      parameters: {
        title: { type: 'string', description: '章节标题', required: true },
        content: { type: 'string', description: '可选的章节初始内容（纯文本）' },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        const title = String(args.title || '新章节').trim()
        if (!title) return '错误：章节标题不能为空。'
        // Check for duplicate title
        const existing = ctx.listChapters().find(c => c.title === title)
        if (existing) {
          return `错误：章节「${title}」已存在！不要再重复创建了。直接用 edit_chapter 写入内容：\nTOOL: edit_chapter | chapter=${title} | content\n（完整正文，不要创建新章节）`
        }
        const rawContent = String(args.content || '').trim()
        // Reject content that's too short (AI sometimes passes garbage to fake writing)
        if (rawContent && countWords(rawContent) < 20) {
          return `错误：章节内容太少（${countWords(rawContent)}字），请至少写20字以上。如果暂时没有内容，请创建空章节后用 edit_chapter 写入。`
        }
        const content = rawContent ? textToHtml(rawContent) : ''
        const chapter = ctx.createChapter(title)
        if (content && chapter) {
          ctx.updateChapter(content)
        }
        return `✅ 已创建章节「${title}」${content ? `(${countWords(content)}字)` : ''}`
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

    // ── Character tools ──
    {
      name: 'add_character',
      description: '添加一个新角色',
      parameters: {
        name: { type: 'string', description: '角色名称', required: true },
        role: { type: 'string', description: '角色定位', enum: ['protagonist', 'supporting', 'antagonist', 'background'] },
        description: { type: 'string', description: '角色描述（外貌、性格、背景）' },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        ctx.addCharacter({
          name: String(args.name || ''),
          role: String(args.role || 'supporting'),
          description: String(args.description || ''),
        })
        return `✅ 已添加角色「${args.name}」(定位: ${args.role || 'supporting'})`
      },
    },
    {
      name: 'update_character',
      description: '更新角色信息。使用 read_book_info 先查看角色ID。',
      parameters: {
        id: { type: 'string', description: '角色ID', required: true },
        name: { type: 'string', description: '新名称' },
        role: { type: 'string', description: '新定位', enum: ['protagonist', 'supporting', 'antagonist', 'background'] },
        description: { type: 'string', description: '新描述' },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        let char = book.characters.find((c: any) => c.id === args.id)
        // Fallback: try lookup by name if ID not found
        if (!char && args.id) {
          char = book.characters.find((c: any) => c.name === args.id)
        }
        if (!char) {
          const ids = book.characters.filter((c: any) => c.name).map((c: any) => `  [${c.id}] ${c.name}`).join('\n')
          return `错误：未找到ID为 ${args.id} 的角色。\n现有角色:\n${ids || '  无'}`
        }
        const data: any = {}
        if (args.name) data.name = String(args.name)
        if (args.role) data.role = String(args.role)
        if (args.description !== undefined) data.description = String(args.description)
        ctx.updateCharacter(String(args.id), data)
        return `✅ 角色「${char.name}」已更新`
      },
    },
    {
      name: 'delete_character',
      description: '删除一个角色',
      parameters: {
        id: { type: 'string', description: '角色ID', required: true },
      },
      execute: async (args) => {
        ctx.deleteCharacter(String(args.id))
        return `✅ 角色已删除`
      },
    },

    // ── Book setting tools ──
    {
      name: 'update_world_setting',
      description: '更新世界观设定',
      parameters: {
        content: { type: 'string', description: '世界观设定内容', required: true },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        ctx.updateWorldSetting(String(args.content || ''))
        return `✅ 世界观设定已更新`
      },
    },
    {
      name: 'update_story_setting',
      description: '更新剧情总结',
      parameters: {
        content: { type: 'string', description: '剧情总结内容', required: true },
      },
      execute: async (args) => {
        const book = ctx.getBook()
        if (!book) return '错误：没有打开的书籍。'
        ctx.updateStorySetting(String(args.content || ''))
        return `✅ 剧情总结已更新`
      },
    },
  ]
}
