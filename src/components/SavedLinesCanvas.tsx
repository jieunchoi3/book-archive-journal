import { Quote } from 'lucide-react'
import type { Book } from '../types'
import { collectMemorableLines } from '../lib/collectMemorableLines'

interface SavedLinesCanvasProps {
  books: Book[]
  onBookClick: (book: Book) => void
}

const cardStyles = [
  'bg-zinc-50 ring-zinc-100',
  'bg-stone-50 ring-stone-100',
  'bg-neutral-50 ring-neutral-100',
  'bg-slate-50 ring-slate-100',
]

export function SavedLinesCanvas({ books, onBookClick }: SavedLinesCanvasProps) {
  const lines = collectMemorableLines(books)

  if (lines.length === 0) return null

  const bookById = new Map(books.map((book) => [book.id, book]))

  return (
    <section className="border-b border-zinc-100 pb-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-apple-gray-400">
            책 속의 한 줄
          </h2>
          <p className="mt-2 text-sm text-apple-gray-400">
            마음에 새겨둔 문장들
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-apple-gray-400">
          {lines.length} saved
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lines.map((entry, index) => {
          const book = bookById.get(entry.bookId)
          if (!book) return null

          const style = cardStyles[index % cardStyles.length]
          const rotation = index % 2 === 0 ? '-rotate-1' : 'rotate-1'

          return (
            <button
              key={entry.bookId}
              type="button"
              onClick={() => onBookClick(book)}
              className={`group relative w-[280px] shrink-0 rounded-2xl p-6 text-left shadow-sm ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${style} ${rotation} hover:rotate-0`}
            >
              <Quote
                size={18}
                strokeWidth={1.5}
                className="mb-4 text-apple-gray-400/70"
              />
              <p className="line-clamp-5 text-[15px] leading-relaxed font-light tracking-[-0.01em] text-black">
                {entry.line}
              </p>
              <div className="mt-6 border-t border-black/5 pt-4">
                <p className="truncate text-xs font-medium tracking-[-0.01em] text-black">
                  {entry.bookTitle}
                </p>
                <p className="mt-1 truncate text-[11px] text-apple-gray-400">
                  {entry.bookAuthor}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
