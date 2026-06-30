import { assertSupabaseConfigured, supabase } from './supabase'
import type { Book, NoteBlock } from '../types'

const STORAGE_KEY = 'reading-archive-books'

interface BookRow {
  id: string
  title: string
  author: string
  cover_url: string | null
  start_date: string | null
  end_date: string | null
  currently_reading: boolean
  favorite: boolean
  tags: string[]
  rating: number | null
  notes: NoteBlock[]
  added_at: string
  created_at?: string
  updated_at?: string
}

function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    currentlyReading: row.currently_reading,
    favorite: row.favorite,
    tags: row.tags ?? [],
    rating: row.rating ?? undefined,
    notes: row.notes ?? [],
    addedAt: row.added_at,
  }
}

function bookToRow(book: Book): BookRow {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    cover_url: book.coverUrl ?? null,
    start_date: book.startDate ?? null,
    end_date: book.endDate ?? null,
    currently_reading: book.currentlyReading,
    favorite: book.favorite ?? false,
    tags: book.tags,
    rating: book.rating ?? null,
    notes: book.notes,
    added_at: book.addedAt,
  }
}

function partialBookToRow(updates: Partial<Book>): Partial<BookRow> {
  const row: Partial<BookRow> = {}

  if (updates.title !== undefined) row.title = updates.title
  if (updates.author !== undefined) row.author = updates.author
  if (updates.coverUrl !== undefined) row.cover_url = updates.coverUrl ?? null
  if (updates.startDate !== undefined) row.start_date = updates.startDate ?? null
  if (updates.endDate !== undefined) row.end_date = updates.endDate ?? null
  if (updates.currentlyReading !== undefined) {
    row.currently_reading = updates.currentlyReading
  }
  if (updates.favorite !== undefined) row.favorite = updates.favorite
  if (updates.tags !== undefined) row.tags = updates.tags
  if (updates.rating !== undefined) row.rating = updates.rating ?? null
  if (updates.notes !== undefined) row.notes = updates.notes
  if (updates.addedAt !== undefined) row.added_at = updates.addedAt

  return row
}

export async function fetchAllBooks(): Promise<Book[]> {
  assertSupabaseConfigured()
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('added_at', { ascending: false })

  if (error) throw error
  return (data as BookRow[]).map(rowToBook)
}

export async function upsertBook(book: Book): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .upsert(bookToRow(book), { onConflict: 'id' })
    .select('*')
    .single()

  if (error) throw error
  return rowToBook(data as BookRow)
}

export async function patchBook(
  id: string,
  updates: Partial<Book>,
): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update(partialBookToRow(updates))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return rowToBook(data as BookRow)
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) throw error
}

export async function migrateFromLocalStorageIfNeeded(): Promise<number> {
  const existing = await fetchAllBooks()
  if (existing.length > 0) return 0

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return 0

  let books: Book[]
  try {
    books = JSON.parse(raw) as Book[]
    if (!Array.isArray(books)) return 0
  } catch {
    return 0
  }

  for (const book of books) {
    await upsertBook(book)
  }

  localStorage.removeItem(STORAGE_KEY)
  return books.length
}
