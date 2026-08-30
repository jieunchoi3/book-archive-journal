import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { TasteCategory, TasteSticker } from '../types/taste'
import { hasTasteDate, normalizeHexColor, tasteTagLabel } from '../types/taste'
import { getTodayKey } from '../lib/weekUtils'
import { ColourWheelPicker } from './ColourWheelPicker'

export interface ColourPolaroidInput {
  categoryId: string
  subcategoryId?: string
  title: string
  note?: string
  dateKey?: string
  colorHex: string
}

interface ColourPolaroidEditorProps {
  mode: 'create' | 'edit'
  category: TasteCategory
  sticker?: TasteSticker
  onClose: () => void
  onSave: (input: ColourPolaroidInput) => void | Promise<void>
  onDelete?: () => void
}

export function ColourPolaroidEditor({
  mode,
  category,
  sticker,
  onClose,
  onSave,
  onDelete,
}: ColourPolaroidEditorProps) {
  const [colorHex, setColorHex] = useState(
    () => normalizeHexColor(sticker?.colorHex ?? '') ?? '#4A90D9',
  )
  const [title, setTitle] = useState(sticker?.title ?? '')
  const [note, setNote] = useState(sticker?.note ?? '')
  const [dateKey, setDateKey] = useState(sticker?.dateKey ?? getTodayKey())
  const [noDate, setNoDate] = useState(() =>
    sticker ? !hasTasteDate(sticker.dateKey) : false,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const hex = normalizeHexColor(colorHex)
    if (!hex) {
      setError('Pick a colour on the wheel.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave({
        categoryId: category.id,
        title: title.trim() || hex,
        note,
        dateKey: noDate ? '' : dateKey,
        colorHex: hex,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#fffaf0] shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-[#fffaf0]/95 px-5 py-4 backdrop-blur">
          <h2 className="text-[16px] font-semibold text-[#2b2118]">
            {mode === 'create' ? 'New colour' : 'Edit colour'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A7A6A] hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="mx-auto w-full max-w-[240px] rotate-[-1.5deg]">
            <div
              className="p-2.5 pb-0 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.45)] ring-1 ring-black/15"
              style={{ backgroundColor: '#fffac0' }}
            >
              <div
                className="aspect-square w-full ring-1 ring-black/10"
                style={{ backgroundColor: colorHex }}
              />
              <div className="px-0.5 py-3">
                <p className="truncate text-[12px] font-medium text-black">
                  {title.trim() || colorHex}
                </p>
                <p className="truncate text-[11px] text-black/50">
                  {note.trim() || tasteTagLabel(category, '')}
                </p>
              </div>
            </div>
          </div>

          <ColourWheelPicker value={colorHex} onChange={setColorHex} />

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-[#8A7A6A]">
              Name (optional)
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ocean blue"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-[#8A7A6A]">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-[#8A7A6A]">
              Date (optional)
            </span>
            <input
              type="date"
              value={noDate ? '' : dateKey}
              disabled={noDate}
              onChange={(e) => setDateKey(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30 disabled:bg-[#f0e6d4]/60 disabled:text-[#8A7A6A]"
            />
            <label className="mt-2 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={noDate}
                onChange={(e) => {
                  const next = e.target.checked
                  setNoDate(next)
                  if (!next && !hasTasteDate(dateKey)) setDateKey(getTodayKey())
                }}
                className="mt-0.5 h-3.5 w-3.5 accent-[#3a2010]"
              />
              <span className="text-[12px] leading-snug text-[#5c4a3a]">
                No date — only show in <span className="font-semibold">View all</span>
              </span>
            </label>
          </div>

          {error && <p className="text-[12px] text-[#FF3B30]">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full rounded-2xl bg-[#3a2010] py-3 text-[14px] font-semibold text-[#fffac0] disabled:opacity-40"
          >
            {busy ? 'Saving…' : mode === 'create' ? 'Save colour' : 'Save changes'}
          </button>

          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex w-full items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#C44]"
            >
              <Trash2 size={14} />
              Delete colour
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
