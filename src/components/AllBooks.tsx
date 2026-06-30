import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Book, GenreFilter } from '../types'
import {
  filterBooksByDate,
  formatMonthLabel,
  formatYearLabel,
  getAvailableMonths,
  getAvailableYears,
  sortBooksByArchiveDate,
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
  const [activeYear, setActiveYear] = useState<number | null>(null)
  const [activeMonth, setActiveMonth] = useState<number | null>(null)

  const availableGenres = useMemo(() => getAvailableGenres(books), [books])

  useEffect(() => {
    if (!availableGenres.includes(activeGenre)) {
      onGenreChange('All Books')
    }
  }, [activeGenre, availableGenres, onGenreChange])

  const genreFiltered = useMemo(
    () =>
      activeGenre === 'All Books'
        ? books
        : books.filter((b) => b.tags.includes(activeGenre)),
    [books, activeGenre],
  )

  const availableYears = useMemo(
    () => getAvailableYears(genreFiltered),
    [genreFiltered],
  )

  const availableMonths = useMemo(
    () => (activeYear !== null ? getAvailableMonths(genreFiltered, activeYear) : []),
    [genreFiltered, activeYear],
  )

  useEffect(() => {
    if (activeYear !== null && !availableYears.includes(activeYear)) {
      setActiveYear(null)
      setActiveMonth(null)
    }
  }, [activeYear, availableYears])

  useEffect(() => {
    if (
      activeMonth !== null &&
      (activeYear === null || !availableMonths.includes(activeMonth))
    ) {
      setActiveMonth(null)
    }
  }, [activeMonth, activeYear, availableMonths])

  const dateFiltered = useMemo(
    () => filterBooksByDate(genreFiltered, activeYear, activeMonth),
    [genreFiltered, activeYear, activeMonth],
  )

  const sorted = useMemo(
    () => sortBooksByArchiveDate(dateFiltered),
    [dateFiltered],
  )

  const handleYearChange = (year: number | null) => {
    setActiveYear(year)
    setActiveMonth(null)
  }

  return (
    <section className="pt-12">
      {books.length > 0 && (
        <div className="mb-8 flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-zinc-100 pb-4">
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

      {books.length > 0 && availableYears.length > 0 && (
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => handleYearChange(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-[-0.01em] transition-colors ${
                activeYear === null
                  ? 'bg-black text-white'
                  : 'bg-apple-gray-50 text-apple-gray-400 hover:text-black'
              }`}
            >
              전체
            </button>
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => handleYearChange(year)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-[-0.01em] transition-colors ${
                  activeYear === year
                    ? 'bg-black text-white'
                    : 'bg-apple-gray-50 text-apple-gray-400 hover:text-black'
                }`}
              >
                {formatYearLabel(year)}
              </button>
            ))}
          </div>

          {activeYear !== null && availableMonths.length > 0 && (
            <div className="relative shrink-0">
              <select
                value={activeMonth ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setActiveMonth(value ? Number(value) : null)
                }}
                className="appearance-none rounded-full border border-apple-gray-100 bg-white py-2 pr-9 pl-4 text-xs font-medium tracking-[-0.01em] text-black transition-colors hover:border-apple-gray-400 focus:border-black focus:outline-none"
                aria-label="월별 필터"
              >
                <option value="">전체 월</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-apple-gray-400"
              />
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 && books.length > 0 ? (
        <p className="mb-8 text-sm text-apple-gray-400">
          선택한 필터에 맞는 책이 없습니다.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <AddBookCard onClick={onAddBook} />
        {sorted.map((book) => (
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
    </section>
  )
}
