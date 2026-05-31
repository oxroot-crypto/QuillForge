// 重新导出所有后端命令
export { sendAiMessage, checkProviderConnection } from './ai'
export { saveApiKey, getApiKeyMasked, hasApiKey, deleteApiKey } from './keys'
export {
  getSupportedProviders,
  saveAllBooks,
  loadAllBooks,
  deleteBookDir,
  exportBookMarkdown,
} from './storage'
export { saveSnapshot, listSnapshots, getSnapshotData, deleteSnapshot } from './history'
export type { SnapshotInfo, SnapshotData } from './history'
export { spellCheckText } from './spell'
export type { SpellError } from './spell'
export { indexChapter, removeChapterIndex, searchChapters } from './search'
export type { SearchResult } from './search'
