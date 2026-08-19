import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  diaryEntryHasPhoto,
  diaryGridImageUrl,
  isDiaryEntryEmpty,
  type DiaryEntry,
} from '../types/diary'
import { parseDateKey } from '../lib/weekUtils'

type Props = {
  year: number
  month: number
  entriesByDate: Record<string, DiaryEntry>
  ensureHydrated: (dateKey: string) => Promise<DiaryEntry>
  onOpenDay: (dateKey: string) => void
}

function pageImageUrl(entry: DiaryEntry | null | undefined): string | null {
  if (!entry) return null
  return entry.coverDataUrl || entry.thumbDataUrl || diaryGridImageUrl(entry)
}

function buildMonthPages(
  year: number,
  month: number,
  entriesByDate: Record<string, DiaryEntry>,
): DiaryEntry[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const pages: DiaryEntry[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const entry = entriesByDate[dateKey]
    if (!entry) continue
    if (isDiaryEntryEmpty(entry) && !diaryEntryHasPhoto(entry)) continue
    pages.push(entry)
  }
  return pages
}

export function DiaryFlipBook({
  year,
  month,
  entriesByDate,
  ensureHydrated,
  onOpenDay,
}: Props) {
  const pages = useMemo(
    () => buildMonthPages(year, month, entriesByDate),
    [year, month, entriesByDate],
  )
  const spreadCount = Math.max(1, Math.ceil(pages.length / 2))
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    setSpreadIndex(0)
  }, [year, month])

  useEffect(() => {
    if (spreadIndex > spreadCount - 1) {
      setSpreadIndex(Math.max(0, spreadCount - 1))
    }
  }, [spreadCount, spreadIndex])

  const left = pages[spreadIndex * 2] ?? null
  const right = pages[spreadIndex * 2 + 1] ?? null

  useEffect(() => {
    const keys = [left?.dateKey, right?.dateKey].filter(Boolean) as string[]
    const neighborLeft = pages[spreadIndex * 2 - 1]?.dateKey
    const neighborRight = pages[spreadIndex * 2 + 2]?.dateKey
    if (neighborLeft) keys.push(neighborLeft)
    if (neighborRight) keys.push(neighborRight)
    for (const key of keys) {
      void ensureHydrated(key)
    }
  }, [left?.dateKey, right?.dateKey, pages, spreadIndex, ensureHydrated])

  const go = useCallback(
    (dir: 'next' | 'prev') => {
      setSpreadIndex((i) => {
        const next = dir === 'next' ? Math.min(spreadCount - 1, i + 1) : Math.max(0, i - 1)
        if (next === i) return i
        setFlipDir(dir)
        window.setTimeout(() => setFlipDir(null), 320)
        return next
      })
    },
    [spreadCount],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go('next')
      if (e.key === 'ArrowLeft') go('prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (pages.length === 0) {
    return (
      <div className="flex min-h-[52vh] flex-col items-center justify-center rounded-2xl border border-hairline bg-white px-6 py-16 text-center shadow-sm">
        <BookOpen className="mb-3 text-[#C7C7CC]" size={28} />
        <p className="text-[15px] font-semibold text-[#1C1C1E]">No diary pages yet</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted">
          Add a photo or note on a day in the calendar, then come back to flip through them.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-2xl border border-hairline bg-[#EDE6DC] shadow-sm"
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          const end = e.changedTouches[0]?.clientX
          touchStartX.current = null
          if (start == null || end == null) return
          const dx = end - start
          if (Math.abs(dx) < 48) return
          if (dx < 0) go('next')
          else go('prev')
        }}
      >
        <div
          key={spreadIndex}
          className={`grid grid-cols-1 gap-px bg-[#D9D0C4] sm:grid-cols-2 ${
            flipDir === 'next'
              ? 'animate-[diary-flip-next_320ms_ease]'
              : flipDir === 'prev'
                ? 'animate-[diary-flip-prev_320ms_ease]'
                : ''
          }`}
        >
          <FlipPage
            entry={left}
            side="left"
            onOpen={left ? () => onOpenDay(left.dateKey) : undefined}
          />
          <FlipPage
            entry={right}
            side="right"
            onOpen={right ? () => onOpenDay(right.dateKey) : undefined}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go('prev')}
          disabled={spreadIndex === 0}
          className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[12px] font-medium text-[#1C1C1E] shadow-sm ring-1 ring-hairline disabled:opacity-35"
        >
          <ChevronLeft size={16} />
          Prev
        </button>
        <p className="text-[12px] tabular-nums text-muted">
          {spreadIndex + 1} / {spreadCount}
          <span className="mx-1.5 text-[#C7C7CC]">·</span>
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </p>
        <button
          type="button"
          onClick={() => go('next')}
          disabled={spreadIndex >= spreadCount - 1}
          className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[12px] font-medium text-[#1C1C1E] shadow-sm ring-1 ring-hairline disabled:opacity-35"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function FlipPage({
  entry,
  side,
  onOpen,
}: {
  entry: DiaryEntry | null
  side: 'left' | 'right'
  onOpen?: () => void
}) {
  if (!entry) {
    return (
      <div
        className={`flex min-h-[380px] flex-col bg-[#FBF8F2] px-5 py-6 sm:min-h-[520px] sm:px-7 sm:py-8 ${
          side === 'left' ? 'sm:border-r sm:border-[#E4D9C8]' : ''
        }`}
      >
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[12px] text-[#C7C7CC]">Blank page</p>
        </div>
      </div>
    )
  }

  const dayNum = parseDateKey(entry.dateKey).getDate()
  const imageUrl = pageImageUrl(entry)
  const title = entry.title.trim() || 'Untitled'
  const body = entry.body.trim()

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-[380px] w-full flex-col bg-[#FBF8F2] px-5 py-6 text-left transition hover:bg-[#FFFDF8] sm:min-h-[520px] sm:px-7 sm:py-8 ${
        side === 'left'
          ? 'sm:border-r sm:border-[#E4D9C8] sm:shadow-[inset_-10px_0_18px_-16px_rgba(60,40,20,0.28)]'
          : 'sm:shadow-[inset_10px_0_18px_-16px_rgba(60,40,20,0.28)]'
      }`}
    >
      <header className="mb-4 flex items-baseline gap-3">
        <span className="shrink-0 text-[28px] font-semibold tabular-nums leading-none tracking-tight text-[#1C1C1E] sm:text-[32px]">
          {dayNum}
        </span>
        <h2 className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-[#1C1C1E] sm:text-[16px]">
          {title}
        </h2>
      </header>

      <div className="relative mx-auto w-full max-w-[320px] overflow-hidden bg-[#E8E8ED] shadow-[0_10px_28px_-16px_rgba(40,20,10,0.45)] ring-1 ring-black/5">
        <div className="relative aspect-square w-full">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#F2F2F7] text-[12px] text-muted">
              No photo
            </div>
          )}
          <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
            {dayNum}
          </span>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-hidden">
        {body ? (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#3A3A3C] sm:text-[14px]">
            {body}
          </p>
        ) : (
          <p className="text-[13px] italic text-[#C7C7CC]">No diary text</p>
        )}
      </div>
    </button>
  )
}
