import { initialBooks } from '../data/initialBooks'
import type { Book } from '../types'

const STORAGE_KEY = 'reading-archive-books'

export function loadBooks(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return initialBooks
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return initialBooks
    }

    return parsed as Book[]
  } catch {
    return initialBooks
  }
}

export function saveBooks(books: Book[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
  } catch (error) {
    console.error('Failed to persist books to localStorage:', error)
  }
}
