import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { formatDiaryTagLabel, getEntryTagFolders } from '../lib/diaryTags'
import { isDiaryEntryEmpty } from '../types/diary'
import type {
  DiaryBodyImage,
  DiaryEntry,
  DiaryPhotoLayer,
  DiaryStroke,
  DiaryTagFolder,
  DiaryTagTreeNode,
} from '../types/diary'
import { formatDateKey, generateId, parseDateKey } from '../lib/weekUtils'
import { compressImageSource } from '../lib/diaryImage'
import { handleClipboardImagePaste } from '../lib/clipboardImage'
import { DiaryPhotoEditor } from './DiaryPhotoEditor'
import { DiaryTagFields } from './DiaryTagFields'

function noteTabLabel(entry: DiaryEntry, index: number): string {
  const title = entry.title.trim()
  if (title) return title.length > 22 ? `${title.slice(0, 22)}…` : title
  const tags = getEntryTagFolders(entry)
  if (tags[0]?.mainTag) {
    const label = formatDiaryTagLabel(tags[0].mainTag)
    return label.length > 22 ? `${label.slice(0, 22)}…` : label
  }
  if (!isDiaryEntryEmpty(entry)) return `Note ${index + 1}`
  return `New note ${index + 1}`
}

interface DiaryDayEditorProps {
  dateKey: string
  entry: DiaryEntry
  dayEntries: DiaryEntry[]
  tagTree: DiaryTagTreeNode[]
  getEntry: (dateKey: string) => DiaryEntry
  onSelectEntry: (entryId: string) => void
  onAddEntry: () => void | Promise<void>
  onDeleteEntry: (entryId: string) => void | Promise<void>
  onChange: (
    patch: Partial<
      Pick<
        DiaryEntry,
        | 'title'
        | 'body'
        | 'tagFolders'
        | 'mainTag'
        | 'subTag'
        | 'bodyImages'
        | 'layers'
        | 'frameColor'
        | 'canvasStrokes'
      >
    >,
  ) => void
  onTagsChange?: (folders: DiaryTagFolder[]) => void
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
  dayEntries,
  tagTree,
  getEntry,
  onSelectEntry,
  onAddEntry,
  onDeleteEntry,
  onChange,
  onTagsChange,
  onNavigateDate,
  onClose,
}: DiaryDayEditorProps) {
  const [title, setTitle] = useState(entry.title)
  const [body, setBody] = useState(entry.body)
  const [bodyImages, setBodyImages] = useState<DiaryBodyImage[]>(entry.bodyImages ?? [])
  const [editingPhotos, setEditingPhotos] = useState(false)
  const [addingBodyImage, setAddingBodyImage] = useState(false)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyFileInputRef = useRef<HTMLInputElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const navigatingRef = useRef(false)
  const pendingTitle = useRef(entry.title)
  const pendingBody = useRef(entry.body)

  const notesForDay = useMemo(() => {
    if (dayEntries.length > 0) return dayEntries
    return [entry]
  }, [dayEntries, entry])

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
    setBodyImages(entry.bodyImages ?? [])
    pendingTitle.current = entry.title
    pendingBody.current = entry.body
  }, [entry.id, entry.dateKey, entry.title, entry.body, entry.bodyImages])

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

  const addBodyImage = useCallback(
    async (source: File | string) => {
      setAddingBodyImage(true)
      try {
        const src = await compressImageSource(source, 2400, 0.9)
        setBodyImages((prev) => {
          const next: DiaryBodyImage[] = [...prev, { id: generateId(), src }]
          onChange({ bodyImages: next })
          return next
        })
      } catch (e) {
        console.warn('[diary] body image add failed', e)
      } finally {
        setAddingBodyImage(false)
      }
    },
    [onChange],
  )

  const removeBodyImage = useCallback(
    (id: string) => {
      const next = bodyImages.filter((image) => image.id !== id)
      setBodyImages(next)
      onChange({ bodyImages: next })
    },
    [bodyImages, onChange],
  )

  const handleBodyImageFiles = (files: FileList | null) => {
    if (!files?.length) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file?.type.startsWith('image/')) void addBodyImage(file)
    }
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
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
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
              <p className="mt-2 text-[12px] text-muted">
                {notesForDay.length === 1
                  ? 'One note for this day — add another for reflections, travel, etc.'
                  : `${notesForDay.length} notes for this day — switch tabs or add another.`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {notesForDay.map((dayEntry, index) => {
                    const active = dayEntry.id === entry.id
                    return (
                      <button
                        key={dayEntry.id}
                        type="button"
                        onClick={() => {
                          if (active) return
                          flushPending()
                          onSelectEntry(dayEntry.id)
                        }}
                        className={`max-w-[160px] truncate rounded-full px-3 py-1 text-[11px] font-medium ${
                          active
                            ? 'bg-[#FF2D55] text-white'
                            : 'bg-[#F2F2F7] text-[#636366] hover:bg-[#E8E8ED]'
                        }`}
                      >
                        {noteTabLabel(dayEntry, index)}
                      </button>
                    )
                  })}
                  {notesForDay.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        flushPending()
                        void onDeleteEntry(entry.id)
                      }}
                      className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-[#FF3B30] hover:bg-[#FF3B30]/10"
                    >
                      <Trash2 size={12} />
                      Delete note
                    </button>
                  )}
                </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  flushPending()
                  void onAddEntry()
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF2D55] px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#E0264A]"
              >
                <Plus size={15} strokeWidth={2.5} />
                Add another note
              </button>
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
            </div>
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

                  <DiaryTagFields
                    tagFolders={entry.tagFolders ?? []}
                    mainTag={entry.mainTag}
                    subTag={entry.subTag}
                    tagTree={tagTree}
                    onChange={(patch) => {
                      onChange(patch)
                      onTagsChange?.(patch.tagFolders)
                    }}
                  />

                  <section className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-[12px] font-semibold uppercase tracking-wide text-muted">
                        What happened
                      </label>
                      <button
                        type="button"
                        onClick={() => bodyFileInputRef.current?.click()}
                        disabled={addingBodyImage}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-[#007AFF] hover:bg-[#007AFF]/8 disabled:opacity-50"
                      >
                        <ImagePlus size={13} />
                        {addingBodyImage ? 'Adding…' : 'Add photo'}
                      </button>
                      <input
                        ref={bodyFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleBodyImageFiles(e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </div>
                    <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-[#FAFAFA] focus-within:border-[#007AFF]/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#007AFF]/15 sm:min-h-[240px]">
                      <textarea
                        value={body}
                        onChange={(e) => queueBody(e.target.value)}
                        onPaste={(e) => {
                          handleClipboardImagePaste(e.nativeEvent, (source) => {
                            void addBodyImage(source)
                          })
                        }}
                        placeholder="Write about your day, or paste / add a photo of handwritten notes…"
                        rows={6}
                        className="min-h-[120px] w-full flex-1 resize-none border-0 bg-transparent px-3.5 py-3 text-[14px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] sm:min-h-[140px]"
                      />
                      {bodyImages.length > 0 && (
                        <div className="shrink-0 border-t border-hairline px-3 py-3">
                          <p className="mb-2 text-[11px] font-medium text-muted">
                            Handwritten notes ({bodyImages.length})
                          </p>
                          <div className="flex flex-col items-center gap-3">
                            {bodyImages.map((image) => (
                              <div
                                key={image.id}
                                className="group relative w-fit max-w-full"
                              >
                                {image.src ? (
                                  <img
                                    src={image.src}
                                    alt="Handwritten note"
                                    className="block max-h-[min(420px,45vh)] w-auto max-w-full rounded-lg object-contain shadow-sm ring-1 ring-black/5"
                                  />
                                ) : (
                                  <div className="flex h-32 w-48 items-center justify-center rounded-lg bg-[#F2F2F7] text-[12px] text-muted">
                                    Loading…
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeBodyImage(image.id)}
                                  className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                                  aria-label="Remove note photo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
