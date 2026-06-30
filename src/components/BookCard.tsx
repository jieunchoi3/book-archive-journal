import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle,
  MoreHorizontal,
  Star,
  Trash2,
} from 'lucide-react'
import type { Book } from '../types'
import { BookCover } from './BookCover'

interface BookCardProps {
  book: Book
  size?: 'large' | 'small'
  dimmed?: boolean
  onBookClick: (book: Book) => void
  onToggleFavorite: (book: Book) => void
  onDelete: (book: Book) => void
  onMarkAsFinished: (book: Book) => void
}

export function BookCard({
  book,
  size = 'small',
  dimmed = false,
  onBookClick,
  onToggleFavorite,
  onDelete,
  onMarkAsFinished,
}: BookCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const textSize =
    size === 'large'
      ? 'text-sm font-medium tracking-[-0.01em]'
      : 'text-xs font-medium tracking-[-0.01em]'

  const gapClass = size === 'large' ? 'mx-2' : 'mx-1.5'
  const coverMargin = size === 'large' ? 'mb-4' : 'mb-3'

  return (
    <div className="group/card min-w-0">
      <BookCover
        book={book}
        size={size}
        dimmed={dimmed}
        onClick={() => onBookClick(book)}
        className={coverMargin}
      />

      <div className="relative flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onBookClick(book)}
          className={`min-w-0 flex-1 truncate text-left ${textSize} text-black`}
        >
          {book.title}
          <span className={`${gapClass} font-light text-apple-gray-400`}>|</span>
          <span className="font-normal text-apple-gray-400">{book.author}</span>
        </button>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((prev) => !prev)
            }}
            className="rounded-md p-1 text-apple-gray-400 transition-colors hover:bg-apple-gray-50 hover:text-black"
            aria-label="Book actions"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={16} strokeWidth={1.5} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 bottom-full z-50 mb-1.5 min-w-[168px] rounded-xl border border-neutral-100 bg-white/80 p-1.5 shadow-lg backdrop-blur-md">
              <MenuButton
                icon={
                  <Star
                    size={14}
                    strokeWidth={1.5}
                    className={book.favorite ? 'fill-black text-black' : ''}
                  />
                }
                label={book.favorite ? 'Unfavorite' : 'Favorite'}
                onClick={() => {
                  onToggleFavorite(book)
                  setMenuOpen(false)
                }}
              />
              <MenuButton
                icon={<Trash2 size={14} strokeWidth={1.5} />}
                label="Delete Book"
                className="text-red-500 hover:text-red-600"
                onClick={() => {
                  onDelete(book)
                  setMenuOpen(false)
                }}
              />
              {book.currentlyReading && (
                <MenuButton
                  icon={<CheckCircle size={14} strokeWidth={1.5} />}
                  label="Mark as Finished"
                  onClick={() => {
                    onMarkAsFinished(book)
                    setMenuOpen(false)
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuButton({
  icon,
  label,
  onClick,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-black transition-colors hover:bg-apple-gray-50 ${className}`}
    >
      {icon}
      {label}
    </button>
  )
}
