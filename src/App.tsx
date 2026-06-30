import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Book, GenreFilter } from './types'
import { loadBooks, saveBooks } from './lib/bookStorage'
import { collectAllTags } from './lib/collectAllTags'
import { Header } from './components/Header'
import { CurrentlyReading } from './components/CurrentlyReading'
import { AllBooks } from './components/AllBooks'
import { BookDetailPage } from './components/BookDetailPage'
import { NoteOverlay } from './components/NoteOverlay'
import { RatingPromptModal } from './components/RatingPromptModal'

type View = 'archive' | 'detail' | 'add'

function App() {
  const [books, setBooks] = useState<Book[]>(() => loadBooks())
  const [activeGenre, setActiveGenre] = useState<GenreFilter>('All Books')
  const [view, setView] = useState<View>('archive')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [ratingPromptBook, setRatingPromptBook] = useState<Book | null>(null)

  const availableTags = useMemo(() => collectAllTags(books), [books])

  useEffect(() => {
    saveBooks(books)
  }, [books])

  const updateBook = useCallback((id: string, updates: Partial<Book>) => {
    setBooks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      saveBooks(next)
      return next
    })
  }, [])

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

  const handleSave = useCallback((book: Book) => {
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === book.id)
      const next = exists
        ? prev.map((b) => (b.id === book.id ? book : b))
        : [book, ...prev]
      saveBooks(next)
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setBooks((prev) => {
      const next = prev.filter((b) => b.id !== id)
      saveBooks(next)
      return next
    })
  }, [])

  const handleDeleteBook = useCallback(
    (book: Book) => {
      handleDelete(book.id)
    },
    [handleDelete],
  )

  const handleToggleFavorite = useCallback(
    (book: Book) => {
      updateBook(book.id, { favorite: !book.favorite })
    },
    [updateBook],
  )

  const handleMarkAsFinished = useCallback(
    (book: Book) => {
      const finishedUpdates: Partial<Book> = {
        currentlyReading: false,
        endDate: new Date().toISOString().split('T')[0],
      }

      updateBook(book.id, finishedUpdates)

      if (!book.rating || book.rating === 0) {
        setRatingPromptBook({ ...book, ...finishedUpdates })
      }
    },
    [updateBook],
  )

  const handleRatingPromptSave = useCallback(
    (rating: number) => {
      if (!ratingPromptBook) return
      updateBook(ratingPromptBook.id, { rating })
      setRatingPromptBook(null)
    },
    [ratingPromptBook, updateBook],
  )

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

      {view === 'detail' && selectedBook && (
        <BookDetailPage
          book={selectedBook}
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
