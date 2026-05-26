import { invoke } from '@tauri-apps/api/core'

export interface SearchResult {
  book_id: string
  book_title: string
  chapter_id: string
  chapter_title: string
  snippet: string
  score: number
}

export async function indexChapter(
  bookId: string,
  bookTitle: string,
  chapterId: string,
  title: string,
  content: string,
): Promise<void> {
  return invoke('index_chapter', { bookId, bookTitle, chapterId, title, content })
}

export async function removeChapterIndex(
  bookId: string,
  chapterId: string,
): Promise<void> {
  return invoke('remove_chapter_index', { bookId, chapterId })
}

export async function searchChapters(
  query: string,
  scopeBookId?: string,
): Promise<SearchResult[]> {
  return invoke('search_chapters', { query, scopeBookId: scopeBookId || null })
}
