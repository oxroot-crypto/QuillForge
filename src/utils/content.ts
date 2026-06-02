/**
 * Strip HTML tags, returning plain text.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Count words in HTML content.
 * - CJK characters: each character counts as one word
 * - English / non-CJK: split by whitespace, count non-empty tokens
 * Handles mixed Chinese-English text correctly.
 */
export function countWords(html: string): number {
  const plain = stripHtml(html).trim()
  if (!plain) return 0

  // Match CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g
  const cjkMatch = plain.match(cjkRegex)
  const cjkCount = cjkMatch ? cjkMatch.length : 0

  // Replace CJK chars with space, then split remaining by whitespace
  const nonCjk = plain.replace(cjkRegex, ' ').trim()
  const enCount = nonCjk ? nonCjk.split(/\s+/).filter(Boolean).length : 0

  return cjkCount + enCount
}
