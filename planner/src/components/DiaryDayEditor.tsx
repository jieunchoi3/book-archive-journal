import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, Pencil, X } from 'lucide-react'
import type { DiaryEntry, DiaryPhotoLayer, DiaryStroke } from '../types/diary'
import { formatDateKey, parseDateKey } from '../lib/weekUtils'
import { DiaryPhotoEditor } from './DiaryPhotoEditor'

interface DiaryDayEditorProps {
  dateKey: string
  entry: DiaryEntry
  getEntry: (dateKey: string) => DiaryEntry
  onChange: (
    patch: Partial<Pick<DiaryEntry, 'title' | 'body' | 'layers' | 'frameColor' | 'canvasStrokes'>>,
  ) => void
  onNavigateDate: (dateKey: string) => void
  onClose: () => void
}

function shiftDateKey(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + days)
  return formatDateKey(d)
}

function formatDayLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function DayPreviewCard({
  entry,
  dateKey,
  dimmed,
}: {
  entry: DiaryEntry
  dateKey: string
  dimmed?: boolean
}) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-3 px-6 ${
        dimmed ? 'opacity-55' : ''
      }`}
    >
      <p className="text-center text-[13px] font-medium text-muted">{formatDayLabel(dateKey)}</p>
      {entry.coverDataUrl ? (
        <img
          src={entry.coverDataUrl}
          alt=""
          className="aspect-square w-full max-w-[280px] rounded-2xl object-cover shadow-md ring-1 ring-hairline"
        />
      ) : (
        <div className="flex aspect-square w-full max-w-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-[#FAFAFA] text-muted">
          <ImagePlus size={24} strokeWidth={1.5} />
          <span className="mt-2 text-[12px]">No photo yet</span>
        </div>
      )}
      {entry.title ? (
        <p className="line-clamp-2 max-w-[280px] text-center text-[14px] font-semibold text-[#1C1C1E]">
          {entry.title}
        </p>
      ) : null}
    </div>
  )
}

export function DiaryDayEditor({
  dateKey,
  entry,
  getEntry,
  onChange,
  onNavigateDate,
  onClose,
}: DiaryDayEditorProps) {
  const [title, setTitle] = useState(entry.title)
  const [body, setBody] = useState(entry.body)
  const [editingPhotos, setEditingPhotos] = useState(false)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const navigatingRef = useRef(false)
  const pendingTitle = useRef(entry.title)
  const pendingBody = useRef(entry.body)

  const prevKey = shiftDateKey(dateKey, -1)
  const nextKey = shiftDateKey(dateKey, 1)
  const prevEntry = getEntry(prevKey)
  const nextEntry = getEntry(nextKey)

  const flushPending = useCallback(() => {
    if (titleTimer.current) {
      clearTimeout(titleTimer.current)
      titleTimer.current = null
    }
    if (bodyTimer.current) {
      clearTimeout(bodyTimer.current)
      bodyTimer.current = null
    }
    const patch: Partial<Pick<DiaryEntry, 'title' | 'body'>> = {}
    if (pendingTitle.current !== entry.title) patch.title = pendingTitle.current
    if (pendingBody.current !== entry.body) patch.body = pendingBody.current
    if (Object.keys(patch).length) onChange(patch)
  }, [entry.title, entry.body, onChange])

  useEffect(() => {
    setTitle(entry.title)
    setBody(entry.body)
    pendingTitle.current = entry.title
    pendingBody.current = entry.body
  }, [entry.dateKey, entry.title, entry.body])

  useEffect(() => {
    const el = scrollerRef.current
    if (el) {
      // Jump to the middle (current day) panel without animation.
      el.scrollTop = el.clientHeight
    }
    // Allow the next navigation only after we've re-centered.
    requestAnimationFrame(() => {
      navigatingRef.current = false
    })
  }, [dateKey])

  useEffect(() => {
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current)
      if (bodyTimer.current) clearTimeout(bodyTimer.current)
    }
  }, [])

  // Keep scroll locked on the middle panel after layout/resize.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const sync = () => {
      if (navigatingRef.current) return
      const page = Math.round(el.scrollTop / Math.max(el.clientHeight, 1))
      if (page === 1) return
      el.scrollTop = el.clientHeight
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dateKey])

  const goTo = useCallback(
    (nextDateKey: string) => {
      if (navigatingRef.current || editingPhotos) return
      navigatingRef.current = true
      flushPending()
      onNavigateDate(nextDateKey)
    },
    [editingPhotos, flushPending, onNavigateDate],
  )

  const handleScroll = () => {
    const el = scrollerRef.current
    if (!el || navigatingRef.current || editingPhotos) return
    const h = el.clientHeight
    if (h <= 0) return
    const page = el.scrollTop / h
    // Settled near top panel → previous day
    if (page < 0.35) {
      goTo(prevKey)
      return
    }
    // Settled near bottom panel → next day
    if (page > 1.65) {
      goTo(nextKey)
    }
  }

  const queueTitle = (value: string) => {
    setTitle(value)
    pendingTitle.current = value
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => onChange({ title: value }), 300)
  }

  const queueBody = (value: string) => {
    setBody(value)
    pendingBody.current = value
    if (bodyTimer.current) clearTimeout(bodyTimer.current)
    bodyTimer.current = setTimeout(() => onChange({ body: value }), 300)
  }

  const saveLayers = (result: {
    layers: DiaryPhotoLayer[]
    frameColor: string
    canvasStrokes: DiaryStroke[]
  }) => {
    onChange({
      layers: result.layers,
      frameColor: result.frameColor,
      canvasStrokes: result.canvasStrokes,
    })
    setEditingPhotos(false)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-4"
        onClick={onClose}
      >
        <div
          className="flex h-[80vh] w-[80vw] max-w-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="diary-day-title"
        >
          <header className="flex shrink-0 items-start justify-between border-b border-hairline px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Diary</p>
              <h2
                id="diary-day-title"
                className="mt-0.5 text-[18px] font-semibold text-[#1C1C1E] sm:text-[20px]"
              >
                {formatDayLabel(dateKey)}
              </h2>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                <ChevronUp size={12} />
                Scroll for other days
                <ChevronDown size={12} />
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                flushPending()
                onClose()
              }}
              className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </header>

          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
            onScroll={handleScroll}
            style={{ scrollBehavior: navigatingRef.current ? 'auto' : undefined }}
          >
            {/* Previous day (above) */}
            <section className="h-full snap-start snap-always">
              <DayPreviewCard entry={prevEntry} dateKey={prevKey} dimmed />
            </section>

            {/* Current day */}
            <section className="h-full snap-start snap-always">
              <div className="grid h-full gap-5 overflow-y-auto p-5 sm:grid-cols-2 sm:gap-6 sm:p-6">
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                      Canvas
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingPhotos(true)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-[#007AFF] hover:bg-[#007AFF]/8"
                    >
                      {entry.coverDataUrl ||
                      entry.layers.length > 0 ||
                      (entry.canvasStrokes?.length ?? 0) > 0 ? (
                        <>
                          <Pencil size={13} /> Edit
                        </>
                      ) : (
                        <>
                          <ImagePlus size={13} /> Draw or add photo
                        </>
                      )}
                    </button>
                  </div>

                  {entry.coverDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setEditingPhotos(true)}
                      className="block w-full overflow-hidden rounded-2xl ring-1 ring-hairline"
                    >
                      <img
                        src={entry.coverDataUrl}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingPhotos(true)}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-[#FAFAFA] text-muted hover:bg-[#F2F2F7]"
                    >
                      <ImagePlus size={28} strokeWidth={1.5} />
                      <span className="text-[13px] font-medium">Draw or upload for this day</span>
                      <span className="px-6 text-center text-[11px]">
                        Sketch on the frame, or add photos to crop, resize, and stack
                      </span>
                    </button>
                  )}

                  {entry.layers.length > 1 && (
                    <p className="mt-2 text-[11px] text-muted">
                      {entry.layers.length} photo layers
                    </p>
                  )}
                </section>

                <div className="flex min-h-0 flex-col gap-5">
                  <section>
                    <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => queueTitle(e.target.value)}
                      placeholder="A title for this day…"
                      className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-2.5 text-[15px] font-semibold text-[#1C1C1E] outline-none placeholder:font-normal placeholder:text-[#C7C7CC] focus:border-[#007AFF]/50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/15"
                    />
                  </section>

                  <section className="flex min-h-0 flex-1 flex-col">
                    <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
                      What happened
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => queueBody(e.target.value)}
                      placeholder="Write about your day…"
                      rows={10}
                      className="min-h-[200px] w-full flex-1 resize-none rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-3 text-[14px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[#007AFF]/50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/15 sm:min-h-[280px]"
                    />
                  </section>
                </div>
              </div>
            </section>

            {/* Next day (below) */}
            <section className="h-full snap-start snap-always">
              <DayPreviewCard entry={nextEntry} dateKey={nextKey} dimmed />
            </section>
          </div>
        </div>
      </div>

      {editingPhotos && (
        <DiaryPhotoEditor
          layers={entry.layers}
          canvasStrokes={entry.canvasStrokes ?? []}
          frameColor={entry.frameColor}
          onSave={saveLayers}
          onClose={() => setEditingPhotos(false)}
        />
      )}
    </>
  )
}
