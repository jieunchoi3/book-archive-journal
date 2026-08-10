import { useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useTasteStickers } from '../hooks/useTasteStickers'
import { compressImageSource } from '../lib/diaryImage'
import { getTodayKey } from '../lib/weekUtils'
import { TASTE_KINDS, tasteKindMeta, type TasteKind, type TasteSticker } from '../types/taste'

const POLAROID_FRAMES = ['#fffac0', '#42240f', '#947762', '#662a00'] as const

/** Five pills to match the Figma row (기타 shows under 전체). */
const CATEGORY_PILLS: { id: TasteKind | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'song', label: '노래' },
  { id: 'music', label: '음악' },
  { id: 'movie', label: '영화' },
  { id: 'place', label: '장소' },
]

function monthTitle(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' })
}

function formatPolaroidDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-')
  if (!y || !m || !d) return dateKey
  return `${y}.${Number(m)}.${Number(d)}`
}

export function TasteStickerView() {
  const taste = useTasteStickers()
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<TasteSticker | null>(null)

  const shiftMonth = (delta: number) => {
    taste.setBrowseMode('month')
    const d = new Date(taste.year, taste.month + delta, 1)
    taste.setViewMonth(d.getFullYear(), d.getMonth())
  }

  const selectAllTime = () => {
    taste.setBrowseMode('atlas')
  }

  const selectMonthMode = () => {
    taste.setBrowseMode('month')
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-24">
      <img
        aria-hidden
        src="/taste/stripe-bg.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#2b1508]/20" />

      <div className="relative z-10 mx-auto w-full max-w-[1240px] px-4 pt-4 sm:px-6 sm:pt-6">
        {/* Month / 전체 */}
        <header className="mb-2 flex items-center justify-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-full p-2 text-[#fffac0]/90 transition hover:bg-white/10 hover:text-[#fffac0]"
            aria-label="Previous month"
          >
            <ChevronLeft size={28} strokeWidth={2.25} />
          </button>

          <div className="min-w-0 flex-1 text-center sm:flex-none sm:px-6">
            {taste.browseMode === 'atlas' ? (
              <button
                type="button"
                onClick={selectMonthMode}
                className="taste-month-title text-[42px] leading-none tracking-[0.06em] text-[#fffac0] drop-shadow-[0_2px_0_rgba(40,20,10,0.45)] sm:text-[50px]"
              >
                전체
              </button>
            ) : (
              <button
                type="button"
                onClick={selectMonthMode}
                className="taste-month-title text-[40px] leading-[0.95] tracking-[0.05em] text-[#fffac0] drop-shadow-[0_2px_0_rgba(40,20,10,0.45)] sm:text-[50px]"
              >
                <span className="block">{monthTitle(taste.year, taste.month)}</span>
                <span className="block text-[0.72em] tracking-[0.08em]">{taste.year}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-full p-2 text-[#fffac0]/90 transition hover:bg-white/10 hover:text-[#fffac0]"
            aria-label="Next month"
          >
            <ChevronRight size={28} strokeWidth={2.25} />
          </button>
        </header>

        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={selectAllTime}
            className={`rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-wide transition ${
              taste.browseMode === 'atlas'
                ? 'bg-[#fffac0] text-[#3a2010] shadow-sm'
                : 'bg-[#fffde8]/35 text-[#fffac0] ring-1 ring-[#fffac0]/35 hover:bg-[#fffde8]/50'
            }`}
          >
            전체 보기
          </button>
        </div>

        {/* Category pills — below month */}
        <div className="mb-5 flex gap-2 overflow-x-auto px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {CATEGORY_PILLS.map((pill) => {
            const active = taste.kindFilter === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => taste.setKindFilter(pill.id)}
                className={`h-11 min-w-[4.5rem] flex-1 rounded-full px-3 text-[13px] font-semibold tracking-wide transition sm:h-12 sm:min-w-0 ${
                  active
                    ? 'bg-[#fffac0] text-[#3a2010] shadow-[0_4px_14px_rgba(0,0,0,0.18)]'
                    : 'bg-[#fffde8]/35 text-[#2b2118]/80 ring-1 ring-white/25 backdrop-blur-[2px] hover:bg-[#fffde8]/50'
                }`}
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        {taste.loading ? (
          <p className="py-24 text-center text-sm text-[#fffac0]/80">불러오는 중…</p>
        ) : taste.visibleStickers.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} allTime={taste.browseMode === 'atlas'} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-3">
            {taste.visibleStickers.map((sticker, i) => (
              <PolaroidCard
                key={sticker.id}
                sticker={sticker}
                frame={POLAROID_FRAMES[i % POLAROID_FRAMES.length]!}
                delayMs={Math.min(i * 30, 240)}
                onClick={() => setSelected(sticker)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-[#fffac0] px-4 py-3 text-[13px] font-semibold text-[#3a2010] shadow-lg sm:bottom-24 sm:right-6"
      >
        <Plus size={16} />
        붙이기
      </button>

      {showAdd && (
        <PolaroidEditor
          mode="create"
          onClose={() => setShowAdd(false)}
          onSave={async (input) => {
            const created = taste.addSticker(input)
            if (created) {
              setShowAdd(false)
              if (taste.browseMode === 'month') {
                const [y, m] = created.dateKey.split('-').map(Number)
                if (y && m) taste.setViewMonth(y, m - 1)
              }
            }
          }}
        />
      )}

      {selected && (
        <PolaroidEditor
          mode="edit"
          sticker={selected}
          onClose={() => setSelected(null)}
          onSave={async (input) => {
            taste.updateSticker(selected.id, input)
            setSelected(null)
          }}
          onDelete={() => {
            taste.deleteSticker(selected.id)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function PolaroidCard({
  sticker,
  frame,
  delayMs,
  onClick,
}: {
  sticker: TasteSticker
  frame: string
  delayMs: number
  onClick: () => void
}) {
  const meta = tasteKindMeta(sticker.kind)
  const lightFrame = frame === '#fffac0'
  const titleColor = lightFrame ? '#000' : '#fffac0'
  const noteColor = lightFrame ? 'rgba(53,42,42,0.62)' : 'rgba(255,250,192,0.7)'
  const dateColor = lightFrame ? 'rgba(112,105,105,0.79)' : 'rgba(255,250,192,0.55)'

  return (
    <div style={{ animation: `taste-pop 420ms ease-out ${delayMs}ms both` }}>
      <button
        type="button"
        onClick={onClick}
        className="group w-full text-left transition-transform duration-200 hover:-translate-y-1"
        style={{ transform: `rotate(${sticker.tilt}deg)` }}
      >
        <div
          className="flex aspect-[293/425] flex-col gap-2.5 overflow-hidden p-2.5 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/20"
          style={{ backgroundColor: frame }}
        >
          <div className="relative min-h-0 flex-[1.15] overflow-hidden bg-white">
            {sticker.imageDataUrl ? (
              <img
                src={sticker.imageDataUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#C7C7CC]">
                <ImagePlus size={22} />
              </div>
            )}
          </div>
          <div className="relative flex min-h-[5.5rem] flex-col px-0.5 pb-1 pt-0.5">
            <p
              className="line-clamp-2 text-[12px] font-medium leading-snug"
              style={{ color: titleColor }}
            >
              {meta.label} {sticker.title}
              {sticker.subtitle ? ` ${sticker.subtitle}` : ''}
            </p>
            {sticker.note ? (
              <p className="mt-1 line-clamp-3 text-[12px] leading-snug" style={{ color: noteColor }}>
                {sticker.note}
              </p>
            ) : null}
            <p
              className="mt-auto pt-2 text-right text-[10px] tabular-nums"
              style={{ color: dateColor }}
            >
              {formatPolaroidDate(sticker.dateKey)}
            </p>
          </div>
        </div>
      </button>
    </div>
  )
}

function EmptyState({ onAdd, allTime }: { onAdd: () => void; allTime: boolean }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="mb-5 w-40 rotate-[-2deg] p-2.5 shadow-[0_14px_36px_-14px_rgba(0,0,0,0.5)] ring-1 ring-black/25"
        style={{ backgroundColor: '#fffac0' }}
      >
        <div className="flex aspect-square items-center justify-center bg-white text-[#C7C7CC]">
          <ImagePlus size={28} />
        </div>
        <p className="px-0.5 py-3 text-left text-[12px] text-black/80">사진 올리기</p>
      </div>
      <p className="text-[15px] font-semibold text-[#fffac0]">
        {allTime ? '아직 폴라로이드가 없어요' : '이번 달 폴라로이드가 없어요'}
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-[#fffac0]/75">
        사진을 올리고 노래·영화·장소 취향을 붙여보세요
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#fffac0] px-4 py-2.5 text-[13px] font-semibold text-[#3a2010]"
      >
        <Plus size={15} />
        붙이기
      </button>
    </div>
  )
}

function PolaroidEditor({
  mode,
  sticker,
  onClose,
  onSave,
  onDelete,
}: {
  mode: 'create' | 'edit'
  sticker?: TasteSticker
  onClose: () => void
  onSave: (input: {
    kind: TasteKind
    title: string
    subtitle?: string
    note?: string
    dateKey?: string
    imageDataUrl?: string
  }) => void | Promise<void>
  onDelete?: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<TasteKind>(sticker?.kind ?? 'song')
  const [title, setTitle] = useState(sticker?.title ?? '')
  const [subtitle, setSubtitle] = useState(sticker?.subtitle ?? '')
  const [note, setNote] = useState(sticker?.note ?? '')
  const [dateKey, setDateKey] = useState(sticker?.dateKey ?? getTodayKey())
  const [imageDataUrl, setImageDataUrl] = useState(sticker?.imageDataUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPickFile = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일을 선택해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const compressed = await compressImageSource(file, 1200, 0.86)
      setImageDataUrl(compressed)
    } catch {
      setError('사진을 읽지 못했어요. 다른 파일을 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      await onSave({ kind, title, subtitle, note, dateKey, imageDataUrl })
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
            {mode === 'create' ? '폴라로이드 붙이기' : '폴라로이드 수정'}
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
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-white disabled:opacity-60"
              >
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#8A7A6A]">
                    <ImagePlus size={28} />
                    <span className="text-[12px] font-medium">사진 업로드</span>
                  </div>
                )}
                {imageDataUrl && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                    변경
                  </span>
                )}
              </button>
              <div className="px-0.5 py-3">
                <p className="truncate text-[12px] font-medium text-black">
                  {title.trim() || '제목…'}
                </p>
                <p className="truncate text-[11px] text-black/50">
                  {note.trim() || tasteKindMeta(kind).label}
                </p>
              </div>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap gap-1.5">
            {TASTE_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  kind === k.id
                    ? 'bg-[#3a2010] text-[#fffac0]'
                    : 'bg-[#f0e6d4] text-[#3a2010] hover:bg-[#e8dcc8]'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <Field label="제목">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Doja Cat Woman"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
              autoFocus
            />
          </Field>

          <Field label="부제 (선택)">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="아티스트 / 감독 / 동네"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
            />
          </Field>

          <Field label="메모 (선택)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="왜 마음에 들었는지"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
            />
          </Field>

          <Field label="날짜">
            <input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
            />
          </Field>

          {error && <p className="text-[12px] text-[#FF3B30]">{error}</p>}

          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => void submit()}
            className="w-full rounded-2xl bg-[#3a2010] py-3 text-[14px] font-semibold text-[#fffac0] disabled:opacity-40"
          >
            {busy ? '저장 중…' : mode === 'create' ? '붙이기' : '저장'}
          </button>

          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex w-full items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#C44]"
            >
              <Trash2 size={14} />
              떼어내기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[#8A7A6A]">{label}</span>
      {children}
    </label>
  )
}
