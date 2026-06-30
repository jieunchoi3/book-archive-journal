import { useCallback, useEffect, useState } from 'react'
import type { Book } from '../types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  deleteBook as deleteBookFromDb,
  fetchAllBooks,
  migrateFromLocalStorageIfNeeded,
  patchBook as patchBookInDb,
  upsertBook as upsertBookInDb,
} from '../lib/booksRepository'

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const data = await fetchAllBooks()
    setBooks(data)
    return data
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
      setLoading(false)
      return
    }

    let mounted = true

    const load = async () => {
      try {
        await migrateFromLocalStorageIfNeeded()
        const data = await fetchAllBooks()
        if (mounted) {
          setBooks(data)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load books from Supabase',
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    const channel = supabase
      .channel('books-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'books' },
        () => {
          refresh().catch(console.error)
        },
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const upsertBook = useCallback(async (book: Book) => {
    const saved = await upsertBookInDb(book)
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === saved.id)
      if (exists) {
        return prev.map((b) => (b.id === saved.id ? saved : b))
      }
      return [saved, ...prev]
    })
    return saved
  }, [])

  const patchBook = useCallback(async (id: string, updates: Partial<Book>) => {
    const saved = await patchBookInDb(id, updates)
    setBooks((prev) => prev.map((b) => (b.id === id ? saved : b)))
    return saved
  }, [])

  const deleteBook = useCallback(async (id: string) => {
    await deleteBookFromDb(id)
    setBooks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  return {
    books,
    loading,
    error,
    upsertBook,
    patchBook,
    deleteBook,
    refresh,
  }
}
