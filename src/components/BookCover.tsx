import { Camera, Star } from 'lucide-react'
import type { Book } from '../types'

interface BookCoverProps {
  book?: Book
  size?: 'large' | 'small'
  dimmed?: boolean
  onClick?: () => void
  className?: string
}
const sizeClasses = {
  large: 'aspect-[2/3] w-full max-w-[200px] shrink min-w-0',
  small: 'aspect-[2/3] w-full',
}

function getCoverGradient(title: string): string {
  const hash = title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const shades = [
    'from-zinc-900 to-zinc-700',
    'from-zinc-800 to-zinc-600',
    'from-zinc-700 to-zinc-500',
    'from-neutral-900 to-neutral-700',
    'from-stone-800 to-stone-600',
  ]
  return shades[hash % shades.length]
}

export function BookCover({
  book,
  size = 'small',
  dimmed = false,
  onClick,
  className = '',
}: BookCoverProps) {
  const title = book?.title ?? ''
  const gradient = getCoverGradient(title)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl bg-apple-gray-50 shadow-sm transition-all duration-300 hover:shadow-md ${sizeClasses[size]} ${dimmed ? 'opacity-45' : 'opacity-100'} ${className}`}
    >
      {book?.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={book.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-4`}
        >
          <span className="text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
            {title.split(' ').slice(0, 2).join(' ')}
          </span>
          <span className="mt-2 text-center text-xs font-light leading-tight text-white/80">
            {title}
          </span>
        </div>
      )}
      {book?.rating != null && book.rating > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={size === 'large' ? 16 : 14}
                strokeWidth={1.5}
                className={
                  star <= book.rating!
                    ? 'fill-white text-white drop-shadow-sm'
                    : 'fill-white/25 text-white/40'
                }
              />
            ))}
          </div>
        </div>
      )}
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 transition-all group-hover:ring-black/10" />
    </button>
  )
}

export function AddBookCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex aspect-[2/3] w-full flex-col items-center justify-center rounded-xl border border-dashed border-apple-gray-100 bg-apple-gray-50/50 transition-all duration-300 hover:border-apple-gray-400 hover:bg-apple-gray-50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-apple-gray-100 bg-white shadow-sm transition-all group-hover:border-apple-gray-400 group-hover:shadow">
        <span className="text-xl font-light text-apple-gray-400 transition-colors group-hover:text-black">
          +
        </span>
      </div>
      <span className="mt-3 text-[10px] font-medium uppercase tracking-[0.15em] text-apple-gray-400 transition-colors group-hover:text-black">
        Add New Book
      </span>
    </button>
  )
}

export function CoverUploadPlaceholder({
  coverUrl,
  onUpload,
}: {
  coverUrl?: string
  onUpload: (url: string) => void
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(URL.createObjectURL(file))
    }
  }

  return (
    <label className="group relative flex aspect-[2/3] w-full max-w-[160px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-apple-gray-100 bg-apple-gray-50/50 transition-all hover:border-apple-gray-400 hover:bg-apple-gray-50">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {coverUrl ? (
        <img
          src={coverUrl}
          alt="Book cover"
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <Camera
            size={20}
            strokeWidth={1.5}
            className="text-apple-gray-400 transition-colors group-hover:text-black"
          />
          <span className="mt-2 px-2 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-apple-gray-400 transition-colors group-hover:text-black">
            Upload Cover
          </span>
        </>
      )}
    </label>
  )
}
