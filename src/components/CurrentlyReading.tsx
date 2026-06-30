import type { Book } from '../types'
import { BookCard } from './BookCard'

interface CurrentlyReadingProps {
  books: Book[]
  onBookClick: (book: Book) => void
  onToggleFavorite: (book: Book) => void
  onDeleteBook: (book: Book) => void
  onMarkAsFinished: (book: Book) => void
}

export function CurrentlyReading({
  books,
  onBookClick,
  onToggleFavorite,
  onDeleteBook,
  onMarkAsFinished,
}: CurrentlyReadingProps) {
  const reading = books.filter((b) => b.currentlyReading)

  if (reading.length === 0) return null

  return (
    <section className="border-b border-zinc-100 pb-12">
      <h2 className="mb-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-apple-gray-400">
        Currently Reading
      </h2>
      <div className="flex w-full flex-row flex-nowrap items-start justify-start gap-6 overflow-x-visible">
        {reading.map((book) => (
          <div key={book.id} className="min-w-0 max-w-[200px] flex-1 shrink">
            <BookCard
              book={book}
              size="large"
              onBookClick={onBookClick}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDeleteBook}
              onMarkAsFinished={onMarkAsFinished}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
