import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  /** Accent colour for the search icon. */
  accentClassName?: string
  emptyLabel?: string
  maxResults?: number
}

export function PageSearch({
  placeholder = 'Search…',
  suggestions,
  onSelect,
  accentClassName = 'text-[#007AFF]',
  emptyLabel = 'No matches',
  maxResults = 8,
}: PageSearchProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [focused, setFocused] = useState(false)
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

  const showDropdown = focused && query.trim().length > 0

  useEffect(() => {
    setActiveIndex(0)
  }, [query, results.length])

  useEffect(() => {
    if (!showDropdown) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuery('')
        setFocused(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showDropdown])

  const pick = (suggestion: SearchSuggestion) => {
    onSelect(suggestion)
    setQuery('')
    setFocused(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={rootRef} className="relative z-30 w-full">
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-white px-3 shadow-sm focus-within:border-[#007AFF]/40 focus-within:ring-2 focus-within:ring-[#007AFF]/15">
        <Search size={16} className={`shrink-0 ${accentClassName}`} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-[#1C1C1E] outline-none placeholder:text-muted"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown && results[activeIndex]
              ? `${listId}-${results[activeIndex].id}`
              : undefined
          }
          onKeyDown={(e) => {
            if (!showDropdown) return
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
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="rounded-md p-1 text-muted hover:bg-[#F2F2F7]"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-72 overflow-auto rounded-xl border border-hairline bg-white py-1 shadow-xl"
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
                  className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors ${
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
