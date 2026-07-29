/** Normalize for tolerant matching (case, accents, punctuation). */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Score how well `query` matches `text`.
 * Higher is better; 0 means no useful match.
 * Supports substring, word-prefix, and fuzzy subsequence matches.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = normalizeSearch(query)
  const t = normalizeSearch(text)
  if (!q || !t) return 0

  if (t === q) return 1000
  if (t.startsWith(q)) return 900 - Math.min(t.length - q.length, 80)

  const idx = t.indexOf(q)
  if (idx >= 0) {
    const wordStart = idx === 0 || t[idx - 1] === ' '
    return (wordStart ? 800 : 700) - Math.min(idx, 60)
  }

  // Word-prefix: every query token matches some word prefix
  const qTokens = q.split(' ').filter(Boolean)
  const tTokens = t.split(' ').filter(Boolean)
  if (qTokens.length > 1) {
    let tokenHits = 0
    for (const qt of qTokens) {
      if (tTokens.some((tt) => tt.startsWith(qt) || tt.includes(qt))) tokenHits++
    }
    if (tokenHits === qTokens.length) return 650 + tokenHits * 10
    if (tokenHits > 0) return 400 + tokenHits * 40
  }

  // Fuzzy subsequence (typo-tolerant / out-of-order-ish)
  let ti = 0
  let consecutive = 0
  let bestConsecutive = 0
  let firstMatch = -1
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (let j = ti; j < t.length; j++) {
      if (t[j] === ch) {
        found = j
        break
      }
    }
    if (found < 0) return 0
    if (firstMatch < 0) firstMatch = found
    if (found === ti) {
      consecutive++
      bestConsecutive = Math.max(bestConsecutive, consecutive)
    } else {
      consecutive = 1
    }
    ti = found + 1
  }

  const coverage = q.length / Math.max(t.length, 1)
  return Math.round(200 + bestConsecutive * 25 + coverage * 120 - Math.min(firstMatch, 40))
}

export function bestFieldScore(query: string, fields: Array<string | null | undefined>): number {
  let best = 0
  for (const field of fields) {
    if (!field) continue
    best = Math.max(best, fuzzyScore(query, field))
  }
  return best
}

export function rankByFuzzy<T>(
  query: string,
  items: T[],
  getFields: (item: T) => Array<string | null | undefined>,
  limit = 8,
): Array<{ item: T; score: number }> {
  const q = query.trim()
  if (!q) return []

  const scored: Array<{ item: T; score: number }> = []
  for (const item of items) {
    const score = bestFieldScore(q, getFields(item))
    if (score > 0) scored.push({ item, score })
  }
  scored.sort((a, b) => b.score - a.score || 0)
  return scored.slice(0, limit)
}
