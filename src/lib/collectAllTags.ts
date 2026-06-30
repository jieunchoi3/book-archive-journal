import type { Book } from '../types'

export function collectAllTags(books: Book[]): string[] {
  const tagSet = new Set<string>()

  for (const book of books) {
    for (const tag of book.tags) {
      const trimmed = tag.trim()
      if (trimmed) tagSet.add(trimmed)
    }
  }

  return [...tagSet].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}
