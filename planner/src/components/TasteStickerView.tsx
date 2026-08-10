import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ImagePlus,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import { useTasteStickers } from '../hooks/useTasteStickers'
import { compressImageSource } from '../lib/diaryImage'
import { getTodayKey } from '../lib/weekUtils'
import {
  categoryAllowsYoutube,
  isLightPolaroidStrip,
  parseYouTubeId,
  tasteCategoryMeta,
  youtubeEmbedUrl,
  youtubeThumbUrl,
  type TasteCategory,
  type TasteSticker,
} from '../types/taste'

/** Browsers block unmuted autoplay until the page gets a real gesture. */
let tasteSoundUnlocked = false

function useTasteSoundUnlock() {
  const [unlocked, setUnlocked] = useState(tasteSoundUnlocked)
  useEffect(() => {
    if (tasteSoundUnlocked) return
    const unlock = () => {
      tasteSoundUnlocked = true
      setUnlocked(true)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])
  return unlocked
}

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
  const soundUnlocked = useTasteSoundUnlock()
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<TasteSticker | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showBackground, setShowBackground] = useState(false)

  const shiftMonth = (delta: number) => {
    taste.setBrowseMode('month')
    const d = new Date(taste.year, taste.month + delta, 1)
    taste.setViewMonth(d.getFullYear(), d.getMonth())
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-24">
      <img
        aria-hidden
        key={taste.backgroundUrl.slice(0, 64)}
        src={taste.backgroundUrl}
        alt=""
        className={`pointer-events-none absolute inset-0 h-full w-full ${
          taste.hasCustomBackground ? 'object-cover' : 'object-fill'
        }`}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#2b1508]/20" />

      <div className="relative z-10 mx-auto w-full max-w-[1240px] px-4 pt-4 sm:px-6 sm:pt-6">
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
                onClick={() => taste.setBrowseMode('month')}
                className="taste-month-title text-[42px] leading-none tracking-[0.06em] text-[#fffac0] drop-shadow-[0_2px_0_rgba(40,20,10,0.45)] sm:text-[50px]"
              >
                All
              </button>
            ) : (
              <button
                type="button"
                onClick={() => taste.setBrowseMode('month')}
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

        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => taste.setBrowseMode('atlas')}
            className={`rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-wide transition ${
              taste.browseMode === 'atlas'
                ? 'bg-[#fffac0] text-[#3a2010] shadow-sm'
                : 'bg-[#fffde8]/35 text-[#fffac0] ring-1 ring-[#fffac0]/35 hover:bg-[#fffde8]/50'
            }`}
          >
            View all
          </button>
          <button
            type="button"
            onClick={() => setShowBackground(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#fffde8]/35 px-3 py-1.5 text-[12px] font-semibold text-[#fffac0] ring-1 ring-[#fffac0]/35 hover:bg-[#fffde8]/50"
          >
            <ImageIcon size={13} />
            Background
          </button>
          <button
            type="button"
            onClick={() => setShowCategories(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#fffde8]/35 px-3 py-1.5 text-[12px] font-semibold text-[#fffac0] ring-1 ring-[#fffac0]/35 hover:bg-[#fffde8]/50"
          >
            <Settings2 size={13} />
            Categories
          </button>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2.5 [&::-webkit-scrollbar]:hidden">
          <FilterPill
            label="All"
            active={taste.kindFilter === 'all'}
            onClick={() => taste.setKindFilter('all')}
          />
          {taste.categories.map((cat) => (
            <FilterPill
              key={cat.id}
              label={cat.name}
              active={taste.kindFilter === cat.id}
              onClick={() => taste.setKindFilter(cat.id)}
            />
          ))}
        </div>

        {taste.loading ? (
          <p className="py-24 text-center text-sm text-[#fffac0]/80">Loading…</p>
        ) : taste.visibleStickers.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} allTime={taste.browseMode === 'atlas'} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-3">
            {taste.visibleStickers.map((sticker, i) => (
              <PolaroidCard
                key={sticker.id}
                sticker={sticker}
                category={tasteCategoryMeta(taste.categories, sticker.categoryId)}
                delayMs={Math.min(i * 30, 240)}
                soundUnlocked={soundUnlocked}
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
        Add
      </button>

      {showCategories && (
        <CategoryManager
          categories={taste.categories}
          onClose={() => setShowCategories(false)}
          onAdd={(name) => taste.addCategory(name)}
          onRename={(id, name) => taste.renameCategory(id, name)}
          onDelete={(id) => taste.deleteCategory(id)}
        />
      )}

      {showBackground && (
        <BackgroundEditor
          monthLabel={`${monthTitle(taste.year, taste.month)} ${taste.year}`}
          monthKey={taste.monthKey}
          previewUrl={taste.backgroundUrl}
          hasCustom={taste.hasCustomBackground}
          onClose={() => setShowBackground(false)}
          onSave={(dataUrl) => {
            taste.setMonthBackground(taste.monthKey, dataUrl)
            setShowBackground(false)
          }}
          onReset={() => {
            taste.clearMonthBackground(taste.monthKey)
            setShowBackground(false)
          }}
        />
      )}

      {showAdd && (
        <PolaroidEditor
          key={`create-${taste.kindFilter}`}
          mode="create"
          categories={taste.categories}
          initialCategoryId={
            taste.kindFilter !== 'all' &&
            taste.categories.some((c) => c.id === taste.kindFilter)
              ? taste.kindFilter
              : undefined
          }
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
          categories={taste.categories}
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

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 shrink-0 rounded-full px-3.5 text-[13px] font-semibold tracking-wide transition sm:h-12 sm:min-w-0 sm:flex-1 ${
        active
          ? 'bg-[#fffac0] text-[#3a2010] shadow-[0_4px_14px_rgba(0,0,0,0.18)]'
          : 'bg-[#fffde8]/35 text-[#2b2118]/80 ring-1 ring-white/25 backdrop-blur-[2px] hover:bg-[#fffde8]/50'
      }`}
    >
      {label}
    </button>
  )
}

function BackgroundEditor({
  monthLabel,
  monthKey,
  previewUrl,
  hasCustom,
  onClose,
  onSave,
  onReset,
}: {
  monthLabel: string
  monthKey: string
  previewUrl: string
  hasCustom: boolean
  onClose: () => void
  onSave: (dataUrl: string) => void
  onReset: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [draftUrl, setDraftUrl] = useState(hasCustom ? previewUrl : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyFile = useCallback(async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please paste or choose an image file.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Wide scrapbook backgrounds — keep detail but cap size for IndexedDB.
      const compressed = await compressImageSource(file, 2000, 0.82)
      setDraftUrl(compressed)
    } catch {
      setError('Couldn’t read that image. Try another one.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items?.length) return
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        void applyFile(file)
        return
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [applyFile])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#fffaf0] shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-[#fffaf0]/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-[16px] font-semibold text-[#2b2118]">Month background</h2>
            <p className="text-[12px] text-[#8A7A6A]">
              {monthLabel} · {monthKey}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A7A6A] hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="overflow-hidden rounded-2xl ring-1 ring-black/10">
            <img
              src={draftUrl || previewUrl}
              alt=""
              className="aspect-[16/10] w-full object-cover"
            />
          </div>

          <p className="text-[13px] leading-relaxed text-[#5C4E40]">
            Copy any image and paste it here (⌘V), or upload a file. August can keep the default
            stripe — other months can each have their own look.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void applyFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#3a2010] px-3 py-2.5 text-[13px] font-semibold text-[#fffac0] disabled:opacity-40"
            >
              <ImagePlus size={15} />
              {busy ? 'Working…' : 'Upload image'}
            </button>
            {hasCustom || draftUrl ? (
              <button
                type="button"
                onClick={onReset}
                className="rounded-xl bg-[#f0e6d4] px-3 py-2.5 text-[13px] font-semibold text-[#3a2010]"
              >
                Use default stripe
              </button>
            ) : null}
          </div>

          {error && <p className="text-[12px] text-[#FF3B30]">{error}</p>}

          <button
            type="button"
            disabled={busy || !draftUrl}
            onClick={() => {
              if (draftUrl) onSave(draftUrl)
            }}
            className="w-full rounded-2xl bg-[#3a2010] py-3 text-[14px] font-semibold text-[#fffac0] disabled:opacity-40"
          >
            Save background for this month
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryManager({
  categories,
  onClose,
  onAdd,
  onRename,
  onDelete,
}: {
  categories: TasteCategory[]
  onClose: () => void
  onAdd: (name: string) => TasteCategory | null
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const created = onAdd(draft)
    if (!created) {
      setError(draft.trim() ? 'That name is already used.' : 'Enter a category name.')
      return
    }
    setDraft('')
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#fffaf0] shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-[#fffaf0]/95 px-5 py-4 backdrop-blur">
          <h2 className="text-[16px] font-semibold text-[#2b2118]">Categories</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A7A6A] hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5">
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-black/5"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.accent }}
                />
                {editingId === cat.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-[13px] outline-none focus:border-[#3a2010]/30"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRename(cat.id, editingName)
                          setEditingId(null)
                        }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onRename(cat.id, editingName)
                        setEditingId(null)
                      }}
                      className="rounded-lg p-1.5 text-[#34C759] hover:bg-[#34C759]/10"
                      aria-label="Save name"
                    >
                      <Check size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#2b2118]">
                      {cat.name}
                      {categoryAllowsYoutube(cat) ? (
                        <span className="ml-1.5 text-[10px] font-normal text-[#8A7A6A]">
                          · YouTube
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cat.id)
                        setEditingName(cat.name)
                      }}
                      className="rounded-lg p-1.5 text-[#8A7A6A] hover:bg-black/5"
                      aria-label={`Rename ${cat.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={categories.length <= 1}
                      onClick={() => {
                        if (
                          confirm(
                            `Delete “${cat.name}”? Polaroids in it move to another category.`,
                          )
                        ) {
                          onDelete(cat.id)
                        }
                      }}
                      className="rounded-lg p-1.5 text-[#C44] hover:bg-[#C44]/10 disabled:opacity-30"
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="flex gap-2 pt-1">
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setError(null)
              }}
              placeholder="New category name"
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter') add()
              }}
            />
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1 rounded-xl bg-[#3a2010] px-3 py-2.5 text-[13px] font-semibold text-[#fffac0]"
            >
              <Plus size={15} />
              Add
            </button>
          </div>
          {error && <p className="text-[12px] text-[#FF3B30]">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function PolaroidCard({
  sticker,
  category,
  delayMs,
  soundUnlocked,
  onClick,
}: {
  sticker: TasteSticker
  category: TasteCategory
  delayMs: number
  soundUnlocked: boolean
  onClick: () => void
}) {
  const strip = sticker.stripColor || '#fffac0'
  const lightFrame = isLightPolaroidStrip(strip)
  const titleColor = lightFrame ? '#000' : '#fffac0'
  const noteColor = lightFrame ? 'rgba(53,42,42,0.62)' : 'rgba(255,250,192,0.7)'
  const dateColor = lightFrame ? 'rgba(112,105,105,0.79)' : 'rgba(255,250,192,0.55)'
  const youtubeId = categoryAllowsYoutube(category)
    ? parseYouTubeId(sticker.link)
    : null
  const coverSrc =
    sticker.imageDataUrl || (youtubeId ? youtubeThumbUrl(youtubeId) : '')
  const [hovering, setHovering] = useState(false)
  const playOnHover = Boolean(youtubeId && hovering)

  return (
    <div style={{ animation: `taste-pop 420ms ease-out ${delayMs}ms both` }}>
      <div
        className="group w-full text-left transition-transform duration-200 hover:-translate-y-1.5"
        style={{ transform: `rotate(${sticker.tilt}deg)` }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div
          className="flex aspect-[293/425] flex-col gap-2.5 overflow-hidden p-2.5 ring-1 ring-black/15 transition-[box-shadow] duration-200 [box-shadow:0_1px_2px_rgba(20,10,0,0.18),0_8px_16px_-4px_rgba(20,10,0,0.35),0_22px_40px_-12px_rgba(20,10,0,0.45)] group-hover:[box-shadow:0_2px_4px_rgba(20,10,0,0.2),0_14px_28px_-6px_rgba(20,10,0,0.4),0_36px_56px_-16px_rgba(20,10,0,0.5)]"
          style={{ backgroundColor: strip }}
        >
          <div className="relative min-h-0 flex-[1.15] overflow-hidden bg-white">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt=""
                className={`h-full w-full object-cover transition-opacity ${
                  playOnHover ? 'opacity-0' : 'opacity-100'
                }`}
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#C7C7CC]">
                <ImagePlus size={22} />
              </div>
            )}

            {playOnHover && youtubeId && (
              <iframe
                key={`${youtubeId}-${soundUnlocked ? 'loud' : 'soft'}`}
                title={sticker.title}
                src={youtubeEmbedUrl(youtubeId, {
                  autoplay: true,
                  mute: !soundUnlocked,
                })}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}

            {youtubeId && !playOnHover && (
              <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                <Volume2 size={11} />
                Hover to play
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClick}
            className="relative flex min-h-[5.5rem] flex-col px-0.5 pb-1 pt-0.5 text-left"
          >
            <p
              className="line-clamp-2 text-[12px] font-medium leading-snug"
              style={{ color: titleColor }}
            >
              {sticker.title}
              {sticker.subtitle ? ` ${sticker.subtitle}` : ''}
            </p>
            {sticker.note ? (
              <p className="mt-1 line-clamp-3 text-[12px] leading-snug" style={{ color: noteColor }}>
                {sticker.note}
              </p>
            ) : null}
            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={
                  lightFrame
                    ? { backgroundColor: 'rgba(255,255,255,0.95)', color: '#3a2010' }
                    : { backgroundColor: 'rgba(255,250,192,0.2)', color: '#fffac0' }
                }
              >
                {category.name}
              </span>
              <p className="text-right text-[10px] tabular-nums" style={{ color: dateColor }}>
                {formatPolaroidDate(sticker.dateKey)}
              </p>
            </div>
          </button>
        </div>
      </div>
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
        <p className="px-0.5 py-3 text-left text-[12px] text-black/80">Add a photo</p>
      </div>
      <p className="text-[15px] font-semibold text-[#fffac0]">
        {allTime ? 'No polaroids yet' : 'No polaroids this month'}
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-[#fffac0]/75">
        Upload a photo and capture whatever you’re into.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#fffac0] px-4 py-2.5 text-[13px] font-semibold text-[#3a2010]"
      >
        <Plus size={15} />
        Add polaroid
      </button>
    </div>
  )
}

function PolaroidEditor({
  mode,
  sticker,
  categories,
  initialCategoryId,
  onClose,
  onSave,
  onDelete,
}: {
  mode: 'create' | 'edit'
  sticker?: TasteSticker
  categories: TasteCategory[]
  /** Prefill category when adding from a filtered category view. */
  initialCategoryId?: string
  onClose: () => void
  onSave: (input: {
    categoryId: string
    title: string
    subtitle?: string
    note?: string
    link?: string
    dateKey?: string
    imageDataUrl?: string
  }) => void | Promise<void>
  onDelete?: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const resolveCategoryId = () => {
    if (sticker?.categoryId && categories.some((c) => c.id === sticker.categoryId)) {
      return sticker.categoryId
    }
    if (
      initialCategoryId &&
      categories.some((c) => c.id === initialCategoryId)
    ) {
      return initialCategoryId
    }
    return categories[0]?.id ?? 'other'
  }

  const [categoryId, setCategoryId] = useState(resolveCategoryId)
  const [title, setTitle] = useState(sticker?.title ?? '')
  const [subtitle, setSubtitle] = useState(sticker?.subtitle ?? '')
  const [note, setNote] = useState(sticker?.note ?? '')
  const [link, setLink] = useState(sticker?.link ?? '')
  const [dateKey, setDateKey] = useState(sticker?.dateKey ?? getTodayKey())
  const [imageDataUrl, setImageDataUrl] = useState(sticker?.imageDataUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep create-form category in sync with the filter tab the user added from.
  useEffect(() => {
    if (mode !== 'create' || !initialCategoryId) return
    if (categories.some((c) => c.id === initialCategoryId)) {
      setCategoryId(initialCategoryId)
    }
  }, [mode, initialCategoryId, categories])

  const activeCategory = tasteCategoryMeta(categories, categoryId)
  const youtubeEnabled = categoryAllowsYoutube(activeCategory)

  const onPickFile = useCallback(async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const compressed = await compressImageSource(file, 1200, 0.86)
      setImageDataUrl(compressed)
    } catch {
      setError('Couldn’t read that photo. Try another file.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items?.length) return
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        void onPickFile(file)
        return
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onPickFile])

  const submit = async () => {
    if (!title.trim()) {
      setError('Add a title.')
      return
    }
    const trimmedLink = link.trim()
    if (youtubeEnabled && trimmedLink && !parseYouTubeId(trimmedLink)) {
      setError('Paste a valid YouTube link (or leave it blank).')
      return
    }
    if (youtubeEnabled && !imageDataUrl && !parseYouTubeId(trimmedLink)) {
      setError('Add a photo or a YouTube link.')
      return
    }
    if (!youtubeEnabled && !imageDataUrl) {
      setError('Add a photo.')
      return
    }
    setBusy(true)
    try {
      await onSave({
        categoryId,
        title,
        subtitle,
        note,
        link: youtubeEnabled ? trimmedLink : '',
        dateKey,
        imageDataUrl,
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
            {mode === 'create' ? 'New polaroid' : 'Edit polaroid'}
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
                    <span className="text-[12px] font-medium">Upload photo</span>
                    <span className="text-[10px] text-[#8A7A6A]/80">or paste (⌘V)</span>
                  </div>
                )}
                {imageDataUrl && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                    Change
                  </span>
                )}
              </button>
              <div className="px-0.5 py-3">
                <p className="truncate text-[12px] font-medium text-black">
                  {title.trim() || 'Title…'}
                </p>
                <p className="truncate text-[11px] text-black/50">
                  {note.trim() || activeCategory.name}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#8A7A6A]">
              Tip: copy an image and paste it here
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap gap-1.5">
            {categories.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setCategoryId(k.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  categoryId === k.id
                    ? 'bg-[#3a2010] text-[#fffac0]'
                    : 'bg-[#f0e6d4] text-[#3a2010] hover:bg-[#e8dcc8]'
                }`}
              >
                {k.name}
              </button>
            ))}
          </div>

          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Doja Cat — Woman"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
              autoFocus
            />
          </Field>

          <Field label="Subtitle (optional)">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Artist, director, neighborhood…"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
            />
          </Field>

          <Field label="Note (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why it stuck with you"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
            />
          </Field>

          {youtubeEnabled && (
            <Field label="YouTube link">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3a2010]/30"
              />
              <p className="mt-1 text-[11px] text-[#8A7A6A]">
                Hover the polaroid to play. Click anywhere once on the page first so sound can unmute.
              </p>
            </Field>
          )}

          <Field label="Date">
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
            {busy ? 'Saving…' : mode === 'create' ? 'Save polaroid' : 'Save changes'}
          </button>

          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex w-full items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#C44]"
            >
              <Trash2 size={14} />
              Delete polaroid
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
