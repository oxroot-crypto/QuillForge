import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Book, Chapter, ChapterStatus, Character, OutlineItem, DailyStats } from '@/types'
import { saveAllBooks, loadAllBooks } from '@/commands/storage'
import { indexChapter, removeChapterIndex } from '@/commands/search'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function makeBook(title?: string): Book {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    title: title || '新书',
    description: '',
    worldSetting: '',
    storySetting: '',
    outline: [],
    characters: [],
    chapters: [],
    createdAt: now,
    updatedAt: now,
  }
}

export const useBookStore = defineStore('book', () => {
  const books = ref<Book[]>([])
  const activeBookId = ref<string>('')
  const activeChapterId = ref<string>('')

  const activeBook = computed(() => books.value.find((b) => b.id === activeBookId.value))
  const activeBookChapters = computed(() => activeBook.value?.chapters || [])
  const activeChapter = computed(() => {
    if (!activeBook.value) return undefined
    return activeBook.value.chapters.find((c) => c.id === activeChapterId.value)
  })

  // ---- Book CRUD ----
  function createBook(title?: string): Book {
    const book = makeBook(title)
    books.value.push(book)
    activeBookId.value = book.id
    return book
  }

  function deleteBook(id: string) {
    const idx = books.value.findIndex((b) => b.id === id)
    if (idx === -1) return
    books.value.splice(idx, 1)
    if (activeBookId.value === id) {
      activeBookId.value = books.value.length > 0 ? books.value[books.value.length - 1].id : ''
    }
  }

  function selectBook(id: string) {
    activeBookId.value = id
    activeChapterId.value = ''
  }

  function selectChapter(bookId: string, chapterId: string) {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return
    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (!chapter) return
    activeChapterId.value = chapterId
    // Ensure this chapter is indexed for search
    ensureIndexed(bookId, book.title, chapterId, chapter.title, chapter.content)
    return chapter
  }

  function updateBookMeta(id: string, data: Partial<Pick<Book, 'title' | 'description' | 'worldSetting' | 'storySetting'>>) {
    const book = books.value.find((b) => b.id === id)
    if (book) {
      Object.assign(book, data, { updatedAt: new Date().toISOString() })
    }
  }

  // ---- Chapter CRUD ----
  function createChapter(title?: string): Chapter | undefined {
    const book = activeBook.value
    if (!book) return undefined
    const chapter: Chapter = {
      id: generateId(),
      title: title || `新章节 ${book.chapters.length + 1}`,
      content: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      snapshots: [],
    }
    book.chapters.push(chapter)
    book.updatedAt = new Date().toISOString()
    return chapter
  }

  function deleteChapter(bookId: string, chapterId: string) {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return
    const idx = book.chapters.findIndex((c) => c.id === chapterId)
    if (idx === -1) return
    book.chapters.splice(idx, 1)
    book.updatedAt = new Date().toISOString()
    removeChapterFromIndex(bookId, chapterId)
  }

  function updateChapterContent(bookId: string, chapterId: string, content: string) {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return
    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (chapter) {
      const oldPlainLen = chapter.content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
      const newPlainLen = content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
      const delta = newPlainLen - oldPlainLen

      chapter.content = content
      chapter.updatedAt = new Date().toISOString()
      book.updatedAt = new Date().toISOString()

      // Track net positive word count
      if (delta > 0) trackWriting(delta)

      // Auto-index (fire-and-forget)
      scheduleIndex(bookId, book.title, chapterId, chapter.title, content)
    }
  }

  function renameChapter(bookId: string, chapterId: string, title: string) {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return
    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (chapter) {
      chapter.title = title
      chapter.updatedAt = new Date().toISOString()
    }
    // Sync linked outline item title
    const outline = book.outline.find((o) => o.chapterId === chapterId)
    if (outline) outline.title = title
  }

  function getActiveChapter(): Chapter | undefined {
    return undefined // active chapter is tracked by editor store via content
  }

  // ---- Character CRUD ----
  function addCharacter(char?: Partial<Character>): Character | undefined {
    const book = activeBook.value
    if (!book) return undefined
    const character: Character = {
      id: generateId(),
      name: char?.name || '',
      role: char?.role || 'supporting',
      description: char?.description || '',
      notes: char?.notes || '',
    }
    book.characters.push(character)
    book.updatedAt = new Date().toISOString()
    return character
  }

  function updateCharacter(characterId: string, data: Partial<Character>) {
    const book = activeBook.value
    if (!book) return
    const char = book.characters.find((c) => c.id === characterId)
    if (char) {
      Object.assign(char, data)
      book.updatedAt = new Date().toISOString()
    }
  }

  function deleteCharacter(characterId: string) {
    const book = activeBook.value
    if (!book) return
    const idx = book.characters.findIndex((c) => c.id === characterId)
    if (idx === -1) return
    book.characters.splice(idx, 1)
    book.updatedAt = new Date().toISOString()
  }

  // ---- Outline CRUD ----
  function addOutlineItem(item?: Partial<OutlineItem>): OutlineItem | undefined {
    const book = activeBook.value
    if (!book) return undefined
    const maxOrder = book.outline.reduce((max, o) => Math.max(max, o.order), 0)
    const outlineItem: OutlineItem = {
      id: generateId(),
      title: item?.title || '',
      description: item?.description || '',
      order: item?.order ?? maxOrder + 1,
    }
    book.outline.push(outlineItem)
    book.updatedAt = new Date().toISOString()
    return outlineItem
  }

  function updateOutlineItem(id: string, data: Partial<OutlineItem>) {
    const book = activeBook.value
    if (!book) return
    const item = book.outline.find((o) => o.id === id)
    if (item) {
      Object.assign(item, data)
      book.updatedAt = new Date().toISOString()
    }
  }

  function deleteOutlineItem(id: string) {
    const book = activeBook.value
    if (!book) return
    const idx = book.outline.findIndex((o) => o.id === id)
    if (idx === -1) return
    book.outline.splice(idx, 1)
    book.updatedAt = new Date().toISOString()
  }

  function reorderOutline(ids: string[]) {
    const book = activeBook.value
    if (!book) return
    ids.forEach((id, index) => {
      const item = book.outline.find((o) => o.id === id)
      if (item) item.order = index + 1
    })
    book.outline.sort((a, b) => a.order - b.order)
    book.updatedAt = new Date().toISOString()
  }

  // ---- Outline <-> Chapter linking ----
  function linkOutlineToChapter(outlineItemId: string, chapterId: string) {
    const book = activeBook.value
    if (!book) return
    // Unlink any previous outline from this chapter
    const prev = book.outline.find((o) => o.chapterId === chapterId)
    if (prev) prev.chapterId = undefined
    // Unlink any previous chapter from this outline item
    const chapter = book.chapters.find((c) => c.outlineItemId === outlineItemId)
    if (chapter) chapter.outlineItemId = undefined
    // Link
    const item = book.outline.find((o) => o.id === outlineItemId)
    const ch = book.chapters.find((c) => c.id === chapterId)
    if (item && ch) {
      item.chapterId = chapterId
      item.title = ch.title // Sync title from chapter
      ch.outlineItemId = outlineItemId
    }
    book.updatedAt = new Date().toISOString()
  }

  function unlinkOutlineFromChapter(outlineItemId: string) {
    const book = activeBook.value
    if (!book) return
    const item = book.outline.find((o) => o.id === outlineItemId)
    if (item && item.chapterId) {
      const chapter = book.chapters.find((c) => c.id === item.chapterId)
      if (chapter) chapter.outlineItemId = undefined
      item.chapterId = undefined
      book.updatedAt = new Date().toISOString()
    }
  }

  function getOutlineForChapter(chapterId: string): OutlineItem | undefined {
    const book = activeBook.value
    if (!book) return undefined
    return book.outline.find((o) => o.chapterId === chapterId)
  }

  /** Build outline context string for AI operations on the active chapter */
  function buildOutlineContext(): string {
    const chId = activeChapterId.value
    if (!chId) return ''
    const outline = getOutlineForChapter(chId)
    if (!outline) return ''
    return `【当前章节大纲】${outline.title}${outline.description ? `：${outline.description}` : ''}`
  }

  // ---- Chapter Status ----
  function updateChapterStatus(bookId: string, chapterId: string, status: ChapterStatus) {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return
    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (chapter) {
      chapter.status = status
      chapter.updatedAt = new Date().toISOString()
      book.updatedAt = new Date().toISOString()
    }
  }

  // ---- Writing Goal & Daily Stats ----
  const dailyGoal = ref(2000)
  const dailyStats = ref<DailyStats[]>([])
  // Internal tracking
  let lastWriteTs = 0
  let writingTimerId: ReturnType<typeof setInterval> | null = null

  function loadDailyStats() {
    try {
      const raw = localStorage.getItem('quillforge_daily_stats')
      if (raw) {
        const parsed = JSON.parse(raw)
        dailyStats.value = parsed.stats || []
        if (typeof parsed.goal === 'number') dailyGoal.value = parsed.goal
      }
    } catch { /* ignore */ }
  }

  function persistDailyStats() {
    try {
      localStorage.setItem('quillforge_daily_stats', JSON.stringify({
        stats: dailyStats.value,
        goal: dailyGoal.value,
      }))
    } catch { /* ignore */ }
  }

  function getTodayKey(): string {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function trackWriting(deltaWords: number) {
    if (deltaWords <= 0) return
    const key = getTodayKey()
    let today = dailyStats.value.find((s) => s.date === key)
    if (!today) {
      today = { date: key, wordsWritten: 0, writingSeconds: 0 }
      dailyStats.value.push(today)
      if (dailyStats.value.length > 365) {
        dailyStats.value = dailyStats.value.slice(-365)
      }
    }
    today.wordsWritten += deltaWords
    lastWriteTs = Date.now()
    if (!writingTimerId) startWritingTimer()
    persistDailyStats()
  }

  function startWritingTimer() {
    writingTimerId = setInterval(() => {
      if (Date.now() - lastWriteTs > 120_000) {
        stopWritingTimer()
        return
      }
      const key = getTodayKey()
      const today = dailyStats.value.find((s) => s.date === key)
      if (today) {
        today.writingSeconds += 10
        persistDailyStats()
      }
    }, 10_000)
  }

  function stopWritingTimer() {
    if (writingTimerId) {
      clearInterval(writingTimerId)
      writingTimerId = null
    }
  }

  function setDailyGoal(goal: number) {
    dailyGoal.value = Math.max(100, Math.min(100_000, goal))
    persistDailyStats()
  }

  function getTodayStats(): { wordsWritten: number; writingMinutes: number } {
    const key = getTodayKey()
    const today = dailyStats.value.find((s) => s.date === key)
    return {
      wordsWritten: today?.wordsWritten || 0,
      writingMinutes: Math.floor((today?.writingSeconds || 0) / 60),
    }
  }

  function getWritingStreak(): number {
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${day}`
      const stat = dailyStats.value.find((s) => s.date === key)
      if (stat && stat.wordsWritten > 0) {
        streak++
      } else if (i === 0) {
        // Today has no data yet — check if yesterday had writing
        continue
      } else {
        break
      }
    }
    return streak
  }

  function getBookStats(bookId: string) {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return { chapters: 0, words: 0, characters: 0 }
    const words = book.chapters.reduce(
      (sum, c) => sum + c.content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length,
      0,
    )
    return {
      chapters: book.chapters.length,
      words,
      characters: book.characters.length,
    }
  }

  // ---- Persistence ----
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let lastSavedSnapshot: string = ''

  async function saveToDisk() {
    try {
      const json = JSON.stringify(books.value)
      if (json === lastSavedSnapshot) return // Skip if unchanged
      lastSavedSnapshot = json
      await saveAllBooks(json)
    } catch (e) {
      console.error('自动保存失败:', e)
    }
  }

  function scheduleAutoSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveToDisk, 800)
  }

  async function loadFromDisk() {
    try {
      const json = await loadAllBooks()
      if (json && json.length > 2) {
        const parsed = JSON.parse(json) as Book[]
        // Migration: ensure all chapters have status field
        for (const book of parsed) {
          for (const chapter of book.chapters) {
            if (!chapter.status) (chapter as Chapter).status = 'draft'
          }
        }
        books.value = parsed
        lastSavedSnapshot = json
        if (parsed.length > 0) {
          activeBookId.value = parsed[0].id
        }
        // Index all chapters for search immediately after loading
        indexAllChapters()
      }
    } catch (e) {
      console.error('加载数据失败:', e)
    }
  }

  // Watch for changes and auto-save
  if (typeof window !== 'undefined') {
    loadDailyStats()
    watch(
      books,
      () => scheduleAutoSave(),
      { deep: true },
    )
  }

  // ---- Auto-index (debounced) ----
  let indexTimer: ReturnType<typeof setTimeout> | null = null
  const indexedChapters = new Set<string>()

  function ensureIndexed(bookId: string, bookTitle: string, chapterId: string, chapterTitle: string, content: string) {
    const key = `${bookId}:${chapterId}`
    if (indexedChapters.has(key)) return
    indexedChapters.add(key)
    indexChapter(bookId, bookTitle, chapterId, chapterTitle, content).catch((e) =>
      console.error('索引失败:', e),
    )
  }

  function indexAllChapters() {
    for (const book of books.value) {
      for (const chapter of book.chapters) {
        ensureIndexed(book.id, book.title, chapter.id, chapter.title, chapter.content)
      }
    }
  }

  function scheduleIndex(bookId: string, bookTitle: string, chapterId: string, chapterTitle: string, content: string) {
    if (indexTimer) clearTimeout(indexTimer)
    indexTimer = setTimeout(async () => {
      try {
        await indexChapter(bookId, bookTitle, chapterId, chapterTitle, content)
      } catch (e) {
        console.error('索引更新失败:', e)
      }
    }, 2000)
  }

  function removeChapterFromIndex(bookId: string, chapterId: string) {
    removeChapterIndex(bookId, chapterId).catch((e) =>
      console.error('索引删除失败:', e),
    )
  }

  return {
    books,
    activeBookId,
    activeChapterId,
    activeBook,
    activeBookChapters,
    activeChapter,
    createBook,
    deleteBook,
    selectBook,
    selectChapter,
    updateBookMeta,
    createChapter,
    deleteChapter,
    updateChapterContent,
    renameChapter,
    getActiveChapter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    getBookStats,
    addOutlineItem,
    updateOutlineItem,
    deleteOutlineItem,
    reorderOutline,
    linkOutlineToChapter,
    unlinkOutlineFromChapter,
    getOutlineForChapter,
    buildOutlineContext,
    saveToDisk,
    loadFromDisk,
    removeChapterFromIndex,
    // Chapter status
    updateChapterStatus,
    // Writing goal & daily stats
    dailyGoal,
    dailyStats,
    setDailyGoal,
    getTodayStats,
    getWritingStreak,
  }
})
