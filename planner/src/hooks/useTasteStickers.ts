import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TasteKind, TasteSticker, TasteStore } from '../types/taste'
import { emptyTasteStore, tasteKindMeta } from '../types/taste'
import { loadTasteStore, saveTasteStore } from '../lib/tasteStorage'
import { generateId, getTodayKey } from '../lib/weekUtils'
import { useAuth } from './useAuth'

export type TasteBrowseMode = 'month' | 'atlas'

export type TasteStickerInput = {
  kind: TasteKind
  title: string
  subtitle?: string
  note?: string
  link?: string
  dateKey?: string
  imageDataUrl?: string
}

export type TasteStickerPatch = Partial<
  Pick<
    TasteSticker,
    'title' | 'subtitle' | 'note' | 'link' | 'kind' | 'dateKey' | 'imageDataUrl'
  >
>

export interface TasteActions {
  loading: boolean
  stickers: TasteSticker[]
  year: number
  month: number
  setViewMonth: (year: number, month: number) => void
  browseMode: TasteBrowseMode
  setBrowseMode: (mode: TasteBrowseMode) => void
  kindFilter: TasteKind | 'all'
  setKindFilter: (kind: TasteKind | 'all') => void
  visibleStickers: TasteSticker[]
  monthCount: number
  addSticker: (input: TasteStickerInput) => TasteSticker | null
  updateSticker: (id: string, patch: TasteStickerPatch) => void
  deleteSticker: (id: string) => void
}

function randomTilt() {
  const options = [-3.5, -2, -1, 1.5, 2.5, 3.5]
  return options[Math.floor(Math.random() * options.length)] ?? 2
}

function normalizeSticker(raw: TasteSticker): TasteSticker {
  return {
    ...raw,
    imageDataUrl: raw.imageDataUrl ?? '',
    subtitle: raw.subtitle ?? '',
    note: raw.note ?? '',
    link: raw.link ?? '',
  }
}

export function useTasteStickers(): TasteActions {
  const { user } = useAuth()
  const userId = user.id
  const today = new Date()
  const [store, setStore] = useState<TasteStore>(emptyTasteStore)
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonthState] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }))
  const [browseMode, setBrowseMode] = useState<TasteBrowseMode>('month')
  const [kindFilter, setKindFilter] = useState<TasteKind | 'all'>('all')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const loaded = await loadTasteStore(userId)
        if (cancelled) return
        const normalized = loaded.stickers.map(normalizeSticker)
        // Polaroid redesign: drop legacy text-only demo cards (no photo).
        const stickers = normalized.filter((s) => s.imageDataUrl)
        const next = { stickers }
        setStore(next)
        if (stickers.length !== normalized.length) {
          void saveTasteStore(userId, next)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const persist = useCallback(
    (next: TasteStore) => {
      setStore(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void saveTasteStore(userId, next).catch((e) =>
          console.error('[taste] save failed', e),
        )
      }, 300)
    },
    [userId],
  )

  const monthPrefix = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`

  const visibleStickers = useMemo(() => {
    let list = store.stickers
    if (browseMode === 'month') {
      list = list.filter((s) => s.dateKey.startsWith(monthPrefix))
    }
    if (kindFilter !== 'all') {
      list = list.filter((s) => s.kind === kindFilter)
    }
    return [...list].sort(
      (a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt.localeCompare(a.createdAt),
    )
  }, [store.stickers, browseMode, monthPrefix, kindFilter])

  const monthCount = useMemo(
    () => store.stickers.filter((s) => s.dateKey.startsWith(monthPrefix)).length,
    [store.stickers, monthPrefix],
  )

  const addSticker: TasteActions['addSticker'] = useCallback(
    ({ kind, title, subtitle, note, link, dateKey, imageDataUrl }) => {
      const trimmed = title.trim()
      if (!trimmed) return null
      const sticker: TasteSticker = {
        id: generateId(),
        kind,
        title: trimmed,
        subtitle: subtitle?.trim() ?? '',
        note: note?.trim() ?? '',
        link: link?.trim() ?? '',
        imageDataUrl: imageDataUrl ?? '',
        dateKey: dateKey || getTodayKey(),
        createdAt: new Date().toISOString(),
        tilt: randomTilt(),
        accent: tasteKindMeta(kind).accent,
      }
      persist({ stickers: [sticker, ...store.stickers] })
      return sticker
    },
    [persist, store.stickers],
  )

  const updateSticker: TasteActions['updateSticker'] = useCallback(
    (id, patch) => {
      persist({
        stickers: store.stickers.map((s) => {
          if (s.id !== id) return s
          const next = { ...s, ...patch }
          if (patch.kind) next.accent = tasteKindMeta(patch.kind).accent
          if (patch.title != null) next.title = patch.title.trim()
          if (patch.subtitle != null) next.subtitle = patch.subtitle.trim()
          if (patch.note != null) next.note = patch.note.trim()
          if (patch.link != null) next.link = patch.link.trim()
          return next
        }),
      })
    },
    [persist, store.stickers],
  )

  const deleteSticker = useCallback(
    (id: string) => {
      persist({ stickers: store.stickers.filter((s) => s.id !== id) })
    },
    [persist, store.stickers],
  )

  const setViewMonth = useCallback((year: number, month: number) => {
    setViewMonthState({ year, month })
  }, [])

  return {
    loading,
    stickers: store.stickers,
    year: viewMonth.year,
    month: viewMonth.month,
    setViewMonth,
    browseMode,
    setBrowseMode,
    kindFilter,
    setKindFilter,
    visibleStickers,
    monthCount,
    addSticker,
    updateSticker,
    deleteSticker,
  }
}
