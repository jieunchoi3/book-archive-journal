import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Pencil, X } from 'lucide-react'
import type { DiaryEntry, DiaryPhotoLayer, DiaryStroke } from '../types/diary'
import { parseDateKey } from '../lib/weekUtils'
import { DiaryPhotoEditor } from './DiaryPhotoEditor'

interface DiaryDayEditorProps {
  dateKey: string
  entry: DiaryEntry
  onChange: (
    patch: Partial<Pick<DiaryEntry, 'title' | 'body' | 'layers' | 'frameColor' | 'canvasStrokes'>>,
  ) => void
  onClose: () => void
}

export function DiaryDayEditor({ dateKey, entry, onChange, onClose }: DiaryDayEditorProps) {
  const [title, setTitle] = useState(entry.title)
  const [body, setBody] = useState(entry.body)
  const [editingPhotos, setEditingPhotos] = useState(false)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(entry.title)
    setBody(entry.body)
  }, [entry.dateKey, entry.title, entry.body])

  useEffect(() => {
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current)
      if (bodyTimer.current) clearTimeout(bodyTimer.current)
    }
  }, [])

  const dateLabel = parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const queueTitle = (value: string) => {
    setTitle(value)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => onChange({ title: value }), 300)
  }

  const queueBody = (value: string) => {
    setBody(value)
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
                {dateLabel}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:gap-6 sm:p-6">
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
                    {entry.coverDataUrl || entry.layers.length > 0 || (entry.canvasStrokes?.length ?? 0) > 0 ? (
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
                    className="min-h-[240px] w-full flex-1 resize-none rounded-xl border border-hairline bg-[#FAFAFA] px-3.5 py-3 text-[14px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[#007AFF]/50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/15 sm:min-h-[320px]"
                  />
                </section>
              </div>
            </div>
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
