import { useState } from 'react'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import type { Book } from '../types'
import { CoverUploadPlaceholder } from './BookCover'
import { StarRating } from './StarRating'
import { TagPills } from './TagPills'
import { Toggle } from './Toggle'
import { canFetchBookCover, fetchBookCover } from '../lib/fetchBookCover'

interface BasicInfoSectionProps {
  book: Book
  onChange: (updates: Partial<Book>) => void
  defaultCollapsed?: boolean
  availableTags?: string[]
}

export function BasicInfoSection({
  book,
  onChange,
  defaultCollapsed = false,
  availableTags = [],
}: BasicInfoSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [isFetchingCover, setIsFetchingCover] = useState(false)

  const canAutoFetch = canFetchBookCover(book.title, book.author)

  const handleAutoFetchCover = async () => {
    if (!canAutoFetch || isFetchingCover) return

    setIsFetchingCover(true)
    try {
      const coverUrl = await fetchBookCover(book.title, book.author)
      if (coverUrl) {
        onChange({ coverUrl })
      }
    } finally {
      setIsFetchingCover(false)
    }
  }

  const handleCurrentlyReadingToggle = (checked: boolean) => {
    onChange({
      currentlyReading: checked,
      endDate: checked ? undefined : book.endDate,
    })
  }

  return (
    <section className="border-b border-zinc-100">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between px-8 py-4 transition-colors hover:bg-apple-gray-50/50"
        aria-expanded={!collapsed}
      >
        <div className="flex min-w-0 items-center gap-4">
          <h3 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-apple-gray-400">
            Basic Info
          </h3>
          {collapsed && book.title && (
            <span className="truncate text-sm font-medium tracking-[-0.01em] text-black">
              {book.title}
              <span className="mx-2 font-light text-apple-gray-400">|</span>
              <span className="font-normal text-apple-gray-400">
                {book.author}
              </span>
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`shrink-0 text-apple-gray-400 transition-transform duration-200 ${
            collapsed ? '' : 'rotate-180'
          }`}
        />
      </button>

      {!collapsed && (
        <div className="px-8 pb-8">
          <div className="flex flex-col gap-8 sm:flex-row">
            <div className="shrink-0">
              <CoverUploadPlaceholder
                bookId={book.id}
                coverUrl={book.coverUrl}
                onUpload={(url) => onChange({ coverUrl: url })}
              />
              <button
                type="button"
                onClick={handleAutoFetchCover}
                disabled={!canAutoFetch || isFetchingCover}
                className="mt-3 flex w-full max-w-[160px] items-center justify-center gap-1.5 rounded-lg border border-apple-gray-100 bg-white px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-black transition-all hover:border-apple-gray-400 hover:bg-apple-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-apple-gray-100 disabled:hover:bg-white"
              >
                {isFetchingCover ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-apple-gray-400" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} strokeWidth={1.5} className="text-apple-gray-400" />
                    Auto-fetch Cover
                  </>
                )}
              </button>
              <p className="mt-2 max-w-[160px] text-center text-[9px] uppercase tracking-[0.1em] text-apple-gray-400">
                Adjust Sizing
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Title">
                  <input
                    type="text"
                    value={book.title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    placeholder="Book title"
                    className="field-input"
                  />
                </Field>
                <Field label="Author">
                  <input
                    type="text"
                    value={book.author}
                    onChange={(e) => onChange({ author: e.target.value })}
                    placeholder="Author name"
                    className="field-input"
                  />
                </Field>
              </div>

              <Field label="Read Date">
                <div className="flex items-center gap-4">
                  <input
                    type="date"
                    value={book.startDate ?? ''}
                    onChange={(e) => onChange({ startDate: e.target.value })}
                    className="field-input flex-1"
                  />
                  {!book.currentlyReading && (
                    <>
                      <span className="text-apple-gray-400">↔</span>
                      <input
                        type="date"
                        value={book.endDate ?? ''}
                        onChange={(e) => onChange({ endDate: e.target.value })}
                        className="field-input flex-1"
                      />
                    </>
                  )}
                  {book.currentlyReading && (
                    <span className="text-xs text-apple-gray-400 italic">
                      In progress — end date hidden
                    </span>
                  )}
                </div>
              </Field>

              <Toggle
                label="Currently Reading (On/Off)"
                checked={book.currentlyReading}
                onChange={handleCurrentlyReadingToggle}
              />

              <Field label="Tags">
                <TagPills
                  tags={book.tags}
                  availableTags={availableTags}
                  onChange={(tags) => onChange({ tags })}
                />
              </Field>

              <Field label="Rating">
                <StarRating
                  value={book.rating}
                  onChange={(rating) => onChange({ rating })}
                  disabled={book.currentlyReading}
                />
              </Field>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-apple-gray-400">
        {label}
      </label>
      {children}
    </div>
  )
}
