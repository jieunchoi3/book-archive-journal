import { useEffect, useMemo } from 'react'
import type { Book, GenreFilter } from '../types'
import {
  formatMonthLabel,
  formatYearLabel,
  groupBooksByYearMonth,
} from '../lib/groupBooksByDate'
import { AddBookCard } from './BookCover'
import { BookCard } from './BookCard'

interface AllBooksProps {
  books: Book[]
  activeGenre: GenreFilter
  onGenreChange: (genre: GenreFilter) => void
  onBookClick: (book: Book) => void
  onAddBook: () => void
  onToggleFavorite: (book: Book) => void
  onDeleteBook: (book: Book) => void
  onMarkAsFinished: (book: Book) => void
}

function getAvailableGenres(books: Book[]): GenreFilter[] {
  const tagCounts = new Map<string, number>()

  for (const book of books) {
    for (const tag of book.tags) {
      const trimmed = tag.trim()
      if (!trimmed) continue
      tagCounts.set(trimmed, (tagCounts.get(trimmed) ?? 0) + 1)
    }
  }

  const sortedTags = [...tagCounts.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )

  return ['All Books', ...sortedTags]
}

export function AllBooks({
  books,
  activeGenre,
  onGenreChange,
  onBookClick,
  onAddBook,
  onToggleFavorite,
  onDeleteBook,
  onMarkAsFinished,
}: AllBooksProps) {
  const availableGenres = useMemo(() => getAvailableGenres(books), [books])

  useEffect(() => {
    if (!availableGenres.includes(activeGenre)) {
      onGenreChange('All Books')
    }
  }, [activeGenre, availableGenres, onGenreChange])

  const filtered =
    activeGenre === 'All Books'
      ? books
      : books.filter((b) => b.tags.includes(activeGenre))

  const grouped = useMemo(() => groupBooksByYearMonth(filtered), [filtered])

  return (
    <section className="pt-12">
      <div className="mb-10 flex items-end justify-between gap-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-apple-gray-400">
          All Books
        </h2>
      </div>

      {books.length > 0 && (
        <div className="mb-10 flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-zinc-100 pb-4">
          {availableGenres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => onGenreChange(genre)}
              className={`relative pb-3 text-sm font-medium tracking-[-0.01em] transition-colors ${
                activeGenre === genre
                  ? 'text-black'
                  : 'text-apple-gray-400 hover:text-black'
              }`}
            >
              {genre}
              {activeGenre === genre && (
                <span className="absolute right-0 bottom-0 left-0 h-[2px] bg-black" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mb-10 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <AddBookCard onClick={onAddBook} />
      </div>

      {grouped.length === 0 ? (
        filtered.length === 0 && books.length > 0 ? (
          <p className="text-sm text-apple-gray-400">
            No books match this genre.
          </p>
        ) : null
      ) : (
        <div className="space-y-14">
          {grouped.map(({ year, months }) => (
            <div key={year}>
              <h3 className="mb-8 text-2xl font-semibold tracking-[-0.03em] text-black">
                {formatYearLabel(year)}
              </h3>

              <div className="space-y-10">
                {months.map(({ month, books: monthBooks }) => (
                  <div key={`${year}-${month}`}>
                    <h4 className="mb-5 text-sm font-medium tracking-[-0.01em] text-apple-gray-400">
                      {formatMonthLabel(month)}
                    </h4>
                    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {monthBooks.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          dimmed={book.currentlyReading}
                          onBookClick={onBookClick}
                          onToggleFavorite={onToggleFavorite}
                          onDelete={onDeleteBook}
                          onMarkAsFinished={onMarkAsFinished}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
