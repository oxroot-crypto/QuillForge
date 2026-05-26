import { invoke } from '@tauri-apps/api/core'
import type { ProviderInfo } from '@/types'

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
