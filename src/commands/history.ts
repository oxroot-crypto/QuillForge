import { useBookStore } from '@/stores/book'
import type { Snapshot } from '@/types'

export interface SnapshotInfo {
  timestamp: string
  label: string
  word_count: number
  title: string
}

function countWords(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
}

// ---- In-memory snapshot operations ----
// Snapshots are stored inside Chapter.snapshots and auto-persisted via bookStore.saveToDisk

export async function saveSnapshot(
  bookId: string,
  chapterId: string,
  content: string,
  label: string,
  title?: string,
): Promise<string> {
  const store = useBookStore()
  const book = store.books.find((b) => b.id === bookId)
  if (!book) throw new Error('Book not found')
  const chapter = book.chapters.find((c) => c.id === chapterId)
  if (!chapter) throw new Error('Chapter not found')

  const timestamp = new Date().toISOString()
  const snapshot: Snapshot = {
    timestamp,
    label,
    word_count: countWords(content),
    title: title || chapter.title,
    content,
  }

  if (!chapter.snapshots) {
    chapter.snapshots = []
  }
  chapter.snapshots.push(snapshot)

  // Prune: keep max 100 snapshots per chapter
  if (chapter.snapshots.length > 100) {
    chapter.snapshots = chapter.snapshots.slice(-100)
  }

  return timestamp
}

export async function listSnapshots(
  bookId: string,
  chapterId: string,
): Promise<SnapshotInfo[]> {
  const store = useBookStore()
  const book = store.books.find((b) => b.id === bookId)
  if (!book) return []
  const chapter = book.chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.snapshots) return []

  return [...chapter.snapshots]
    .reverse()
    .map((s: Snapshot) => ({
      timestamp: s.timestamp,
      label: s.label,
      word_count: s.word_count,
      title: s.title || '',
    }))
}

export interface SnapshotData {
  title: string
  content: string
}

export async function deleteSnapshot(
  bookId: string,
  chapterId: string,
  timestamp: string,
): Promise<void> {
  const store = useBookStore()
  const book = store.books.find((b) => b.id === bookId)
  if (!book) throw new Error('Book not found')
  const chapter = book.chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.snapshots) throw new Error('Snapshot not found')

  const idx = chapter.snapshots.findIndex((s: Snapshot) => s.timestamp === timestamp)
  if (idx === -1) throw new Error('Snapshot not found')
  chapter.snapshots.splice(idx, 1)
}

export async function getSnapshotData(
  bookId: string,
  chapterId: string,
  timestamp: string,
): Promise<SnapshotData> {
  const store = useBookStore()
  const book = store.books.find((b) => b.id === bookId)
  if (!book) throw new Error('Book not found')
  const chapter = book.chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.snapshots) throw new Error('Snapshot not found')

  const snap = chapter.snapshots.find((s: Snapshot) => s.timestamp === timestamp)
  if (!snap) throw new Error('Snapshot not found')

  return { title: snap.title || '', content: snap.content }
}
