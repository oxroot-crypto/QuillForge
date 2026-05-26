import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Book, Chapter, Character } from '@/types'
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
      chapter.content = content
      chapter.updatedAt = new Date().toISOString()
      book.updatedAt = new Date().toISOString()
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
    saveToDisk,
    loadFromDisk,
    removeChapterFromIndex,
  }
})
