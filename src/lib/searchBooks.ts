import Fuse from 'fuse.js'
import type { Book } from '../types'

export interface BookSearchHit {
  type: 'book'
  book: Book
  score: number
}

export interface NoteSearchHit {
  type: 'note'
  book: Book
  snippet: string
  score: number
}

export type SearchHit = BookSearchHit | NoteSearchHit

const NOTE_TEXT_TYPES = new Set(['heading', 'subheading', 'body', 'quote', 'thought'])

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSnippet(text: string, query: string, maxLength = 96): string {
  const normalized = text.replace(/\s+/g, ' ')
  if (!normalized) return ''

  const lowerText = normalized.toLowerCase()
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)
  let matchIndex = -1

  for (const keyword of keywords) {
    const idx = lowerText.indexOf(keyword)
    if (idx !== -1) {
      matchIndex = idx
      break
    }
  }

  if (matchIndex === -1) {
    return normalized.length > maxLength
      ? `${normalized.slice(0, maxLength).trim()}…`
      : normalized
  }

  const start = Math.max(0, matchIndex - 28)
  const end = Math.min(normalized.length, matchIndex + maxLength - 28)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < normalized.length ? '…' : ''

  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`
}

interface NoteSearchItem {
  book: Book
  text: string
}

export function searchBooks(books: Book[], query: string): SearchHit[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const bookFuse = new Fuse(books, {
    keys: ['title', 'author'],
    threshold: 0.45,
    ignoreLocation: true,
    minMatchCharLength: 1,
  })

  const noteItems: NoteSearchItem[] = books.flatMap((book) =>
    book.notes
      .filter((note) => NOTE_TEXT_TYPES.has(note.type))
      .map((note) => ({
        book,
        text: stripHtml(note.content),
      }))
      .filter((item) => item.text.length > 0),
  )

  const noteFuse = new Fuse(noteItems, {
    keys: ['text'],
    threshold: 0.45,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })

  const bookHits: BookSearchHit[] = bookFuse.search(trimmed).map((result) => ({
    type: 'book',
    book: result.item,
    score: result.score ?? 0,
  }))

  const bookResults = bookHits.slice(0, 5)

  const noteHitsByBook = new Map<string, NoteSearchHit>()
  for (const result of noteFuse.search(trimmed)) {
    const { book, text } = result.item
    const score = result.score ?? 0
    const existing = noteHitsByBook.get(book.id)

    if (!existing || score < existing.score) {
      noteHitsByBook.set(book.id, {
        type: 'note',
        book,
        snippet: buildSnippet(text, trimmed),
        score,
      })
    }
  }

  const noteResults = [...noteHitsByBook.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)

  return [...bookResults, ...noteResults]
}
