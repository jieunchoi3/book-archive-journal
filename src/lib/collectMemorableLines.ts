import type { Book } from '../types'

export interface MemorableLineEntry {
  bookId: string
  bookTitle: string
  bookAuthor: string
  line: string
  addedAt: string
}

export function collectMemorableLines(books: Book[]): MemorableLineEntry[] {
  return books
    .filter((book) => book.memorableLine?.trim())
    .map((book) => ({
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      line: book.memorableLine!.trim(),
      addedAt: book.addedAt,
    }))
    .sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    )
}
