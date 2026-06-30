import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { Book } from '../types'
import { searchBooks, type BookSearchHit, type NoteSearchHit } from '../lib/searchBooks'

interface SearchBarProps {
  books: Book[]
  onBookSelect: (book: Book) => void
}

export function SearchBar({ books, onBookSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchBooks(books, query), [books, query])

  const bookResults = results.filter(
    (hit): hit is BookSearchHit => hit.type === 'book',
  )
  const noteResults = results.filter(
    (hit): hit is NoteSearchHit => hit.type === 'note',
  )

  const showDropdown =
    open && focused && query.trim().length > 0 && results.length > 0

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
        setFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (book: Book) => {
    setQuery('')
    setOpen(false)
    setFocused(false)
    onBookSelect(book)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-[220px] lg:max-w-[280px]">
      <div
        className={`relative flex items-center rounded-full bg-apple-gray-50 transition-all duration-300 ease-out ${
          focused
            ? 'max-w-none shadow-sm ring-1 ring-black/5 lg:w-[320px]'
            : 'w-full'
        }`}
      >
        <Search
          size={14}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3.5 text-apple-gray-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setFocused(true)
            if (query.trim()) setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                setFocused(false)
              }
            }, 120)
          }}
          placeholder="Search books & notes"
          className="w-full rounded-full border-0 bg-transparent py-2 pr-4 pl-9 text-sm text-black placeholder:text-apple-gray-400 focus:outline-none"
          aria-label="Search books and notes"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-neutral-100 bg-white/95 shadow-lg backdrop-blur-md lg:left-auto lg:w-[360px]">
          {bookResults.length > 0 && (
            <div className="border-b border-zinc-100 py-2">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-apple-gray-400">
                Books
              </p>
              <ul role="listbox">
                {bookResults.map((hit) => (
                  <li key={`book-${hit.book.id}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(hit.book)}
                      className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-apple-gray-50"
                    >
                      <span className="text-sm font-medium tracking-[-0.01em] text-black">
                        {hit.book.title}
                      </span>
                      <span className="text-xs text-apple-gray-400">
                        {hit.book.author}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {noteResults.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-apple-gray-400">
                In Notes
              </p>
              <ul role="listbox">
                {noteResults.map((hit) => (
                  <li key={`note-${hit.book.id}-${hit.snippet.slice(0, 20)}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(hit.book)}
                      className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-apple-gray-50"
                    >
                      <span className="text-sm font-medium tracking-[-0.01em] text-black">
                        {hit.book.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-apple-gray-400">
                        {hit.snippet}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {open && focused && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-xl border border-neutral-100 bg-white/95 px-4 py-6 text-center text-xs text-apple-gray-400 shadow-lg backdrop-blur-md lg:left-auto lg:w-[360px]">
          No results found
        </div>
      )}
    </div>
  )
}
