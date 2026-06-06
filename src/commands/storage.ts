// 存储命令封装——书籍持久化（加载/保存/删除/导出）与提供商信息获取。
import { invoke } from '@tauri-apps/api/core'
import type { ProviderInfo } from '@/types'

/** 获取支持的所有 LLM 提供商列表及模型信息 */
export async function getSupportedProviders(): Promise<ProviderInfo[]> {
  return invoke('get_supported_providers')
}

export async function saveAllBooks(data: string): Promise<void> {
  return invoke('save_all_books', { data })
}

export async function loadAllBooks(): Promise<string> {
  return invoke('load_all_books')
}

export async function deleteBookDir(bookId: string): Promise<void> {
  return invoke('delete_book_dir', { bookId })
}

export async function exportBookMarkdown(
  bookTitle: string,
  chaptersJson: string,
): Promise<string> {
  return invoke('export_book_markdown', { bookTitle, chaptersJson })
}
