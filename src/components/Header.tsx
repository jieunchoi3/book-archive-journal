import type { Book } from '../types'
import { SearchBar } from './SearchBar'

interface HeaderProps {
  books: Book[]
  onBookSelect: (book: Book) => void
}

export function Header({ books, onBookSelect }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-8 py-5">
        <h1 className="shrink-0 text-lg font-semibold tracking-[-0.02em] text-black">
          Reading Archive
        </h1>

        <div className="flex min-w-0 flex-1 items-center justify-end lg:justify-center">
          <SearchBar books={books} onBookSelect={onBookSelect} />
        </div>

        <span className="shrink-0 text-xs font-medium tracking-[0.08em] text-apple-gray-400">
          Jieun Choi
        </span>
      </div>
    </header>
  )
}
