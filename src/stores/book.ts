import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Book, Chapter, Character } from '@/types'
import { saveAllBooks, loadAllBooks } from '@/commands/llm'

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

  const activeBook = computed(() => books.value.find((b) => b.id === activeBookId.value))
  const activeBookChapters = computed(() => activeBook.value?.chapters || [])

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
  }

  function updateChapterContent(bookId: string, chapterId: string, content: string) {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return
    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (chapter) {
      chapter.content = content
      chapter.updatedAt = new Date().toISOString()
      book.updatedAt = new Date().toISOString()
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

  async function saveToDisk() {
    try {
      const json = JSON.stringify(books.value)
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
        if (parsed.length > 0) {
          activeBookId.value = parsed[0].id
        }
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

  return {
    books,
    activeBookId,
    activeBook,
    activeBookChapters,
    createBook,
    deleteBook,
    selectBook,
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
  }
})
