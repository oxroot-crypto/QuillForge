// 全文搜索命令封装——索引章节内容、删除索引、执行搜索，数据走 Rust 内存索引。
import { invoke } from '@tauri-apps/api/core'

/** 搜索结果——与 Rust 端 SearchResult 结构镜像 */
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
