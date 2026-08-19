import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  TasteCategory,
  TasteSticker,
  TasteStore,
  TasteSubcategory,
} from '../types/taste'
import {
  DEFAULT_TASTE_BACKGROUND,
  DEFAULT_TASTE_CATEGORIES,
  emptyTasteStore,
  monthKeyFromParts,
  nextCategoryAccent,
  parseYouTubeId,
  randomPolaroidStripColor,
  hasTasteDate,
  stripColorFromId,
  tasteCategoryMeta,
  tasteSubcategoryMeta,
} from '../types/taste'
import { loadTasteStore, saveTasteStore } from '../lib/tasteStorage'
import { generateId, getTodayKey } from '../lib/weekUtils'
import { useAuth } from './useAuth'

export type TasteBrowseMode = 'month' | 'atlas'

export type TasteStickerInput = {
  categoryId: string
  subcategoryId?: string
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
    | 'title'
    | 'subtitle'
    | 'note'
    | 'link'
    | 'categoryId'
    | 'subcategoryId'
    | 'dateKey'
    | 'imageDataUrl'
  >
>

export interface TasteActions {
  loading: boolean
  stickers: TasteSticker[]
  categories: TasteCategory[]
  year: number
  month: number
  monthKey: string
  /** Resolved background for the viewed month (custom or default stripe). */
  backgroundUrl: string
  hasCustomBackground: boolean
  setViewMonth: (year: number, month: number) => void
  browseMode: TasteBrowseMode
  setBrowseMode: (mode: TasteBrowseMode) => void
  kindFilter: string | 'all'
  setKindFilter: (kind: string | 'all') => void
  subFilter: string | 'all'
  setSubFilter: (sub: string | 'all') => void
  visibleStickers: TasteSticker[]
  monthCount: number
  addSticker: (input: TasteStickerInput) => TasteSticker | null
  updateSticker: (id: string, patch: TasteStickerPatch) => void
  deleteSticker: (id: string) => void
  addCategory: (name: string) => TasteCategory | null
  renameCategory: (id: string, name: string) => void
  deleteCategory: (id: string) => void
  addSubcategory: (categoryId: string, name: string) => TasteSubcategory | null
  renameSubcategory: (categoryId: string, subcategoryId: string, name: string) => void
  deleteSubcategory: (categoryId: string, subcategoryId: string) => void
  setMonthBackground: (monthKey: string, dataUrl: string) => void
  clearMonthBackground: (monthKey: string) => void
}

function randomTilt() {
  const options = [-3.5, -2, -1, 1.5, 2.5, 3.5]
  return options[Math.floor(Math.random() * options.length)] ?? 2
}

type LegacyCategory = Omit<TasteCategory, 'subcategories'> & {
  subcategories?: TasteSubcategory[]
}

type LegacySticker = Omit<TasteSticker, 'stripColor' | 'categoryId' | 'subcategoryId'> & {
  kind?: string
  categoryId?: string
  subcategoryId?: string
  stripColor?: string
}

function normalizeSubcategories(raw: TasteSubcategory[] | undefined): TasteSubcategory[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((s) => ({
      id: s.id || generateId(),
      name: (s.name || 'Untitled').trim() || 'Untitled',
    }))
    .filter((s) => Boolean(s.id))
}

function normalizeCategories(raw: TasteCategory[] | undefined): TasteCategory[] {
  if (!raw || raw.length === 0) {
    return DEFAULT_TASTE_CATEGORIES.map((c) => ({
      ...c,
      subcategories: c.subcategories.map((s) => ({ ...s })),
    }))
  }
  return (raw as LegacyCategory[]).map((c) => ({
    id: c.id,
    name: (c.name || 'Untitled').trim() || 'Untitled',
    accent: c.accent || '#AF52DE',
    youtube: Boolean(c.youtube) || c.id === 'music' || c.name.trim().toLowerCase() === 'music',
    subcategories: normalizeSubcategories(c.subcategories),
  }))
}

function resolveSubcategoryId(
  category: TasteCategory,
  subcategoryId: string | undefined | null,
): string {
  if (!subcategoryId) return ''
  return tasteSubcategoryMeta(category, subcategoryId) ? subcategoryId : ''
}

function normalizeSticker(raw: LegacySticker, categories: TasteCategory[]): TasteSticker {
  let categoryId = raw.categoryId || raw.kind || 'other'
  if (categoryId === 'song') categoryId = 'music'
  if (!categories.some((c) => c.id === categoryId)) {
    categoryId = categories[categories.length - 1]?.id ?? 'other'
  }
  const meta = tasteCategoryMeta(categories, categoryId)
  return {
    id: raw.id,
    categoryId,
    subcategoryId: resolveSubcategoryId(meta, raw.subcategoryId),
    title: raw.title ?? '',
    subtitle: raw.subtitle ?? '',
    note: raw.note ?? '',
    link: raw.link ?? '',
    imageDataUrl: raw.imageDataUrl ?? '',
    dateKey: typeof raw.dateKey === 'string' ? raw.dateKey : '',
    createdAt: raw.createdAt,
    tilt: raw.tilt ?? randomTilt(),
    stripColor: raw.stripColor || stripColorFromId(raw.id),
    accent: meta.accent,
  }
}

function normalizeStore(loaded: TasteStore): TasteStore {
  const categories = normalizeCategories(loaded.categories)
  const stickers = (loaded.stickers as LegacySticker[])
    .map((s) => normalizeSticker(s, categories))
    .filter((s) => s.imageDataUrl || Boolean(parseYouTubeId(s.link)))
  const monthBackgrounds =
    loaded.monthBackgrounds && typeof loaded.monthBackgrounds === 'object'
      ? { ...loaded.monthBackgrounds }
      : {}
  return { categories, stickers, monthBackgrounds }
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
  const [kindFilter, setKindFilterState] = useState<string | 'all'>('all')
  const [subFilter, setSubFilter] = useState<string | 'all'>('all')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setKindFilter = useCallback((kind: string | 'all') => {
    setKindFilterState(kind)
    setSubFilter('all')
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const loaded = await loadTasteStore(userId)
        if (cancelled) return
        const next = normalizeStore(loaded)
        setStore(next)
        const needsSave =
          !loaded.categories?.length ||
          next.stickers.length !== loaded.stickers.length ||
          (loaded.stickers as LegacySticker[]).some(
            (s) => !s.stripColor || !s.categoryId || s.subcategoryId === undefined,
          ) ||
          (loaded.categories as LegacyCategory[] | undefined)?.some(
            (c) => !Array.isArray(c.subcategories),
          ) ||
          loaded.stickers.some((s, i) => {
            const n = next.stickers[i]
            const legacy = s as LegacySticker
            return !n || n.categoryId !== (legacy.categoryId || legacy.kind)
          })
        if (needsSave) void saveTasteStore(userId, next)
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

  const monthKey = monthKeyFromParts(viewMonth.year, viewMonth.month)
  const monthPrefix = monthKey
  const customBackground = store.monthBackgrounds[monthKey] ?? ''
  const backgroundUrl = customBackground || DEFAULT_TASTE_BACKGROUND
  const hasCustomBackground = Boolean(customBackground)

  const visibleStickers = useMemo(() => {
    let list = store.stickers
    if (browseMode === 'month') {
      // Undated stickers only live in View all.
      list = list.filter((s) => hasTasteDate(s.dateKey) && s.dateKey.startsWith(monthPrefix))
    }
    if (kindFilter !== 'all') {
      list = list.filter((s) => s.categoryId === kindFilter)
      if (subFilter !== 'all') {
        list = list.filter((s) => s.subcategoryId === subFilter)
      }
    }
    return [...list].sort((a, b) => {
      const aDated = hasTasteDate(a.dateKey)
      const bDated = hasTasteDate(b.dateKey)
      if (aDated && bDated) {
        return b.dateKey.localeCompare(a.dateKey) || b.createdAt.localeCompare(a.createdAt)
      }
      if (!aDated && !bDated) return b.createdAt.localeCompare(a.createdAt)
      // Undated “liked” items float above dated ones in View all.
      return aDated ? 1 : -1
    })
  }, [store.stickers, browseMode, monthPrefix, kindFilter, subFilter])

  const monthCount = useMemo(
    () =>
      store.stickers.filter(
        (s) => hasTasteDate(s.dateKey) && s.dateKey.startsWith(monthPrefix),
      ).length,
    [store.stickers, monthPrefix],
  )

  const addSticker: TasteActions['addSticker'] = useCallback(
    ({ categoryId, subcategoryId, title, subtitle, note, link, dateKey, imageDataUrl }) => {
      const trimmed = title.trim()
      if (!trimmed) return null
      const meta = tasteCategoryMeta(store.categories, categoryId)
      const sticker: TasteSticker = {
        id: generateId(),
        categoryId: meta.id,
        subcategoryId: resolveSubcategoryId(meta, subcategoryId),
        title: trimmed,
        subtitle: subtitle?.trim() ?? '',
        note: note?.trim() ?? '',
        link: link?.trim() ?? '',
        imageDataUrl: imageDataUrl ?? '',
        dateKey:
          dateKey === undefined
            ? getTodayKey()
            : hasTasteDate(dateKey.trim())
              ? dateKey.trim()
              : '',
        createdAt: new Date().toISOString(),
        tilt: randomTilt(),
        stripColor: randomPolaroidStripColor(),
        accent: meta.accent,
      }
      persist({ ...store, stickers: [sticker, ...store.stickers] })
      return sticker
    },
    [persist, store],
  )

  const updateSticker: TasteActions['updateSticker'] = useCallback(
    (id, patch) => {
      persist({
        ...store,
        stickers: store.stickers.map((s) => {
          if (s.id !== id) return s
          const next = { ...s, ...patch }
          const categoryId = patch.categoryId ?? s.categoryId
          const meta = tasteCategoryMeta(store.categories, categoryId)
          next.categoryId = meta.id
          next.accent = meta.accent
          if (patch.categoryId != null || patch.subcategoryId != null) {
            next.subcategoryId = resolveSubcategoryId(
              meta,
              patch.subcategoryId !== undefined ? patch.subcategoryId : s.subcategoryId,
            )
          }
          if (patch.title != null) next.title = patch.title.trim()
          if (patch.subtitle != null) next.subtitle = patch.subtitle.trim()
          if (patch.note != null) next.note = patch.note.trim()
          if (patch.link != null) next.link = patch.link.trim()
          if (patch.dateKey != null) {
            const trimmed = patch.dateKey.trim()
            next.dateKey = hasTasteDate(trimmed) ? trimmed : ''
          }
          return next
        }),
      })
    },
    [persist, store],
  )

  const deleteSticker = useCallback(
    (id: string) => {
      persist({ ...store, stickers: store.stickers.filter((s) => s.id !== id) })
    },
    [persist, store],
  )

  const addCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      if (store.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
        return null
      }
      const category: TasteCategory = {
        id: generateId(),
        name: trimmed,
        accent: nextCategoryAccent(store.categories),
        youtube: trimmed.toLowerCase() === 'music',
        subcategories: [],
      }
      persist({ ...store, categories: [...store.categories, category] })
      return category
    },
    [persist, store],
  )

  const renameCategory = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      if (
        store.categories.some(
          (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        return
      }
      persist({
        ...store,
        categories: store.categories.map((c) =>
          c.id === id
            ? {
                ...c,
                name: trimmed,
                youtube: c.youtube || trimmed.toLowerCase() === 'music',
              }
            : c,
        ),
      })
    },
    [persist, store],
  )

  const deleteCategory = useCallback(
    (id: string) => {
      if (store.categories.length <= 1) return
      const fallback =
        store.categories.find((c) => c.id !== id)?.id ?? store.categories[0]!.id
      const nextCategories = store.categories.filter((c) => c.id !== id)
      const fallbackMeta = tasteCategoryMeta(nextCategories, fallback)
      persist({
        ...store,
        categories: nextCategories,
        stickers: store.stickers.map((s) =>
          s.categoryId === id
            ? {
                ...s,
                categoryId: fallbackMeta.id,
                subcategoryId: '',
                accent: fallbackMeta.accent,
              }
            : s,
        ),
      })
      if (kindFilter === id) setKindFilter('all')
    },
    [persist, store, kindFilter, setKindFilter],
  )

  const addSubcategory = useCallback(
    (categoryId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const category = store.categories.find((c) => c.id === categoryId)
      if (!category) return null
      if (category.subcategories.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
        return null
      }
      const sub: TasteSubcategory = { id: generateId(), name: trimmed }
      persist({
        ...store,
        categories: store.categories.map((c) =>
          c.id === categoryId ? { ...c, subcategories: [...c.subcategories, sub] } : c,
        ),
      })
      return sub
    },
    [persist, store],
  )

  const renameSubcategory = useCallback(
    (categoryId: string, subcategoryId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const category = store.categories.find((c) => c.id === categoryId)
      if (!category) return
      if (
        category.subcategories.some(
          (s) => s.id !== subcategoryId && s.name.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        return
      }
      persist({
        ...store,
        categories: store.categories.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                subcategories: c.subcategories.map((s) =>
                  s.id === subcategoryId ? { ...s, name: trimmed } : s,
                ),
              }
            : c,
        ),
      })
    },
    [persist, store],
  )

  const deleteSubcategory = useCallback(
    (categoryId: string, subcategoryId: string) => {
      persist({
        ...store,
        categories: store.categories.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                subcategories: c.subcategories.filter((s) => s.id !== subcategoryId),
              }
            : c,
        ),
        stickers: store.stickers.map((s) =>
          s.categoryId === categoryId && s.subcategoryId === subcategoryId
            ? { ...s, subcategoryId: '' }
            : s,
        ),
      })
      if (subFilter === subcategoryId) setSubFilter('all')
    },
    [persist, store, subFilter],
  )

  const setMonthBackground = useCallback(
    (key: string, dataUrl: string) => {
      if (!key || !dataUrl) return
      persist({
        ...store,
        monthBackgrounds: { ...store.monthBackgrounds, [key]: dataUrl },
      })
    },
    [persist, store],
  )

  const clearMonthBackground = useCallback(
    (key: string) => {
      if (!key || !store.monthBackgrounds[key]) return
      const next = { ...store.monthBackgrounds }
      delete next[key]
      persist({ ...store, monthBackgrounds: next })
    },
    [persist, store],
  )

  const setViewMonth = useCallback((year: number, month: number) => {
    setViewMonthState({ year, month })
  }, [])

  return {
    loading,
    stickers: store.stickers,
    categories: store.categories,
    year: viewMonth.year,
    month: viewMonth.month,
    monthKey,
    backgroundUrl,
    hasCustomBackground,
    setViewMonth,
    browseMode,
    setBrowseMode,
    kindFilter,
    setKindFilter,
    subFilter,
    setSubFilter,
    visibleStickers,
    monthCount,
    addSticker,
    updateSticker,
    deleteSticker,
    addCategory,
    renameCategory,
    deleteCategory,
    addSubcategory,
    renameSubcategory,
    deleteSubcategory,
    setMonthBackground,
    clearMonthBackground,
  }
}
