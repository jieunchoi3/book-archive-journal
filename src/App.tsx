import { useCallback, useMemo, useState } from 'react'
import type { Book, GenreFilter } from './types'
import { collectAllTags } from './lib/collectAllTags'
import { useBooks } from './hooks/useBooks'
import { Header } from './components/Header'
import { CurrentlyReading } from './components/CurrentlyReading'
import { AllBooks } from './components/AllBooks'
import { BookDetailPage } from './components/BookDetailPage'
import { NoteOverlay } from './components/NoteOverlay'
import { RatingPromptModal } from './components/RatingPromptModal'

type View = 'archive' | 'detail' | 'add'

function App() {
  const { books, loading, error, upsertBook, patchBook, deleteBook } = useBooks()
  const [activeGenre, setActiveGenre] = useState<GenreFilter>('All Books')
  const [view, setView] = useState<View>('archive')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [ratingPromptBook, setRatingPromptBook] = useState<Book | null>(null)

  const availableTags = useMemo(() => collectAllTags(books), [books])

  const openBook = useCallback((book: Book) => {
    setSelectedBook(book)
    setView('detail')
  }, [])

  const openNewBook = useCallback(() => {
    setView('add')
  }, [])

  const closeDetail = useCallback(() => {
    setView('archive')
    setSelectedBook(null)
  }, [])

  const closeAddOverlay = useCallback(() => {
    setView('archive')
  }, [])

  const handleSave = useCallback(
    async (book: Book) => {
      await upsertBook(book)
      closeDetail()
      closeAddOverlay()
    },
    [upsertBook, closeDetail, closeAddOverlay],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteBook(id)
      closeDetail()
    },
    [deleteBook, closeDetail],
  )

  const handleDeleteBook = useCallback(
    (book: Book) => {
      void handleDelete(book.id)
    },
    [handleDelete],
  )

  const handleToggleFavorite = useCallback(
    (book: Book) => {
      void patchBook(book.id, { favorite: !book.favorite })
    },
    [patchBook],
  )

  const handleMarkAsFinished = useCallback(
    (book: Book) => {
      const finishedUpdates: Partial<Book> = {
        currentlyReading: false,
        endDate: new Date().toISOString().split('T')[0],
      }

      void patchBook(book.id, finishedUpdates)

      if (!book.rating || book.rating === 0) {
        setRatingPromptBook({ ...book, ...finishedUpdates })
      }
    },
    [patchBook],
  )

  const handleRatingPromptSave = useCallback(
    (rating: number) => {
      if (!ratingPromptBook) return
      void patchBook(ratingPromptBook.id, { rating })
      setRatingPromptBook(null)
    },
    [ratingPromptBook, patchBook],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-apple-gray-400">Loading your library…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-8">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-black">Unable to connect to Supabase</p>
          <p className="mt-2 text-sm text-apple-gray-400">{error}</p>
          <p className="mt-4 text-xs text-apple-gray-400">
            Add your credentials to <code>.env.local</code> and run the SQL schema in
            Supabase.
          </p>
        </div>
      </div>
    )
  }

  const detailBook =
    selectedBook && view === 'detail'
      ? books.find((b) => b.id === selectedBook.id) ?? selectedBook
      : null

  return (
    <div className="min-h-screen bg-white">
      {view !== 'detail' && (
        <>
          <Header books={books} onBookSelect={openBook} />

          <main className="mx-auto max-w-[1400px] px-8 py-12">
            <CurrentlyReading
              books={books}
              onBookClick={openBook}
              onToggleFavorite={handleToggleFavorite}
              onDeleteBook={handleDeleteBook}
              onMarkAsFinished={handleMarkAsFinished}
            />
            <AllBooks
              books={books}
              activeGenre={activeGenre}
              onGenreChange={setActiveGenre}
              onBookClick={openBook}
              onAddBook={openNewBook}
              onToggleFavorite={handleToggleFavorite}
              onDeleteBook={handleDeleteBook}
              onMarkAsFinished={handleMarkAsFinished}
            />
          </main>
        </>
      )}

      {view === 'detail' && detailBook && (
        <BookDetailPage
          book={detailBook}
          availableTags={availableTags}
          onClose={closeDetail}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {view === 'add' && (
        <NoteOverlay
          availableTags={availableTags}
          onClose={closeAddOverlay}
          onSave={handleSave}
        />
      )}

      {ratingPromptBook && (
        <RatingPromptModal
          bookTitle={ratingPromptBook.title}
          onSave={handleRatingPromptSave}
          onClose={() => setRatingPromptBook(null)}
        />
      )}

      <style>{`
        .field-input {
          width: 100%;
          border: 0;
          border-bottom: 1px solid #e5e5ea;
          background: transparent;
          padding: 0.375rem 0;
          font-size: 0.875rem;
          color: #000000;
          transition: border-color 0.2s;
        }
        .field-input:focus {
          outline: none;
          border-bottom-color: #000000;
        }
        .field-input::placeholder {
          color: #8e8e93;
        }
      `}</style>
    </div>
  )
}

export default App
