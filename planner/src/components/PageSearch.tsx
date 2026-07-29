import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { rankByFuzzy } from '../lib/fuzzyMatch'

export interface SearchSuggestion {
  id: string
  title: string
  subtitle?: string
  meta?: string
  /** Extra fields used only for fuzzy matching (not shown). */
  haystack?: string[]
}

interface PageSearchProps {
  placeholder?: string
  suggestions: SearchSuggestion[]
  onSelect: (suggestion: SearchSuggestion) => void
  /** Accent for the open search field focus ring / icon. */
  accentClassName?: string
  emptyLabel?: string
  maxResults?: number
}

export function PageSearch({
  placeholder = 'Search…',
  suggestions,
  onSelect,
  accentClassName = 'text-[#007AFF] focus:ring-[#007AFF]/25',
  emptyLabel = 'No matches',
  maxResults = 8,
}: PageSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const results = useMemo(() => {
    return rankByFuzzy(
      query,
      suggestions,
      (s) => [s.title, s.subtitle, s.meta, ...(s.haystack ?? [])],
      maxResults,
    ).map((r) => r.item)
  }, [query, suggestions, maxResults])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, results.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const pick = (suggestion: SearchSuggestion) => {
    onSelect(suggestion)
    setQuery('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F2F7] px-3 py-1.5 text-[12px] font-medium text-[#48484A] transition-colors hover:bg-[#E5E5EA]"
        aria-label="Search"
      >
        <Search size={14} />
        Search
      </button>
    )
  }

  return (
    <div ref={rootRef} className="relative z-30 w-full min-w-[220px] max-w-sm sm:w-72">
      <div className="flex items-center gap-1 rounded-xl border border-hairline bg-white px-2 shadow-sm focus-within:ring-2 focus-within:ring-[#007AFF]/20">
        <Search size={15} className={`shrink-0 ${accentClassName.split(' ')[0] ?? 'text-[#007AFF]'}`} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-[#1C1C1E] outline-none placeholder:text-muted"
          role="combobox"
          aria-expanded={query.trim().length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined
          }
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && results[activeIndex]) {
              e.preventDefault()
              pick(results[activeIndex])
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (query) setQuery('')
            else setOpen(false)
          }}
          className="rounded-md p-1 text-muted hover:bg-[#F2F2F7]"
          aria-label={query ? 'Clear search' : 'Close search'}
        >
          <X size={14} />
        </button>
      </div>

      {query.trim() && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-auto rounded-xl border border-hairline bg-white py-1 shadow-xl"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-[12px] text-muted">{emptyLabel}</li>
          ) : (
            results.map((item, index) => (
              <li key={item.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  id={`${listId}-${item.id}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(item)}
                  className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                    index === activeIndex ? 'bg-[#007AFF]/10' : 'hover:bg-[#F5F5F7]'
                  }`}
                >
                  <span className="truncate text-[13px] font-medium text-[#1C1C1E]">
                    {item.title}
                  </span>
                  {(item.subtitle || item.meta) && (
                    <span className="flex items-center gap-2 truncate text-[11px] text-muted">
                      {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                      {item.meta && (
                        <span className="shrink-0 tabular-nums opacity-80">{item.meta}</span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

/** Small helper for pages that want an inline hint under the control. */
export function SearchHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[10px] text-muted">{children}</p>
}
