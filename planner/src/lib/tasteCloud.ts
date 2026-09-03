import type { TasteCategory, TasteStore } from '../types/taste'
import { supabase } from './supabase'
import {
  hydrateTasteStoreFromCloud,
  isTasteDataUrl,
  isTasteStorageRef,
  prepareTasteStoreForCloud,
} from './tasteMedia'

type TasteStoreRow = {
  user_id: string
  store: TasteStore
  updated_at: string
}

export interface TasteStoreCloudRow {
  store: TasteStore
  updatedAt: string
}

const CLOUD_FETCH_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

/** Strip legacy inline base64 from cloud jsonb (keeps metadata + storage refs). */
export function stripInlineTasteImages(store: TasteStore): TasteStore {
  return {
    ...store,
    stickers: store.stickers.map((sticker) =>
      isTasteDataUrl(sticker.imageDataUrl)
        ? { ...sticker, imageDataUrl: '' }
        : sticker,
    ),
    monthBackgrounds: Object.fromEntries(
      Object.entries(store.monthBackgrounds).filter(([, bg]) => !isTasteDataUrl(bg)),
    ),
  }
}

export function mergeTasteStores(
  local: TasteStore,
  cloud: TasteStore,
  preferLocalCategories = false,
): TasteStore {
  const categories = mergeCategories(local.categories, cloud.categories, preferLocalCategories)
  const stickerMap = new Map<string, TasteStore['stickers'][number]>()

  for (const sticker of cloud.stickers) stickerMap.set(sticker.id, sticker)
  for (const sticker of local.stickers) {
    const prev = stickerMap.get(sticker.id)
    if (!prev) {
      stickerMap.set(sticker.id, sticker)
      continue
    }
    stickerMap.set(sticker.id, mergeTasteSticker(prev, sticker))
  }

  const monthBackgrounds = { ...cloud.monthBackgrounds, ...local.monthBackgrounds }
  return {
    categories,
    stickers: [...stickerMap.values()],
    monthBackgrounds,
  }
}

function mergeTasteSticker(
  a: TasteStore['stickers'][number],
  b: TasteStore['stickers'][number],
): TasteStore['stickers'][number] {
  const newer = a.createdAt >= b.createdAt ? a : b
  const older = a.createdAt >= b.createdAt ? b : a
  const merged = { ...newer }
  if (older.imageDataUrl && !merged.imageDataUrl) merged.imageDataUrl = older.imageDataUrl
  if (older.colorHex && !merged.colorHex) merged.colorHex = older.colorHex
  if (older.title && !merged.title.trim()) merged.title = older.title
  if (older.subtitle && !merged.subtitle.trim()) merged.subtitle = older.subtitle
  if (older.note && !merged.note.trim()) merged.note = older.note
  if (older.link && !merged.link.trim()) merged.link = older.link
  return merged
}

function mergeCategories(
  local: TasteCategory[],
  cloud: TasteCategory[],
  preferLocal = false,
): TasteCategory[] {
  const map = new Map<string, TasteCategory>()
  const [primary, secondary] = preferLocal ? [local, cloud] : [cloud, local]

  for (const cat of secondary) map.set(cat.id, cat)
  for (const cat of primary) {
    const prev = map.get(cat.id)
    if (!prev) {
      map.set(cat.id, cat)
      continue
    }
    const subMap = new Map(prev.subcategories.map((s) => [s.id, s]))
    for (const sub of cat.subcategories) subMap.set(sub.id, sub)
    map.set(cat.id, {
      ...prev,
      ...cat,
      name: preferLocal ? cat.name : prev.name || cat.name,
      accent: preferLocal ? cat.accent : prev.accent || cat.accent,
      youtube: preferLocal ? cat.youtube : prev.youtube ?? cat.youtube,
      subcategories: [...subMap.values()],
    })
  }
  return [...map.values()]
}

export async function fetchTasteStoreCloudRawWithMeta(
  userId: string,
): Promise<{ store: TasteStore; updatedAt: string } | null> {
  const { data, error } = await supabase
    .from('taste_stores')
    .select('store, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as { store?: TasteStore; updated_at: string }
  return {
    store: row.store ?? { categories: [], stickers: [], monthBackgrounds: {} },
    updatedAt: row.updated_at,
  }
}

export async function fetchTasteStoreCloudRaw(userId: string): Promise<TasteStore | null> {
  const { data, error } = await supabase
    .from('taste_stores')
    .select('store')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return (data as { store?: TasteStore }).store ?? null
}

export async function fetchTasteStoreCloudStickerCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('taste_stores')
    .select('store')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return 0
  const store = (data as { store?: TasteStore }).store
  return store?.stickers?.length ?? 0
}

export async function fetchTasteStoreCloudMeta(
  userId: string,
): Promise<{ updatedAt: string } | null> {
  const { data, error } = await supabase
    .from('taste_stores')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return { updatedAt: (data as { updated_at: string }).updated_at }
}

export async function fetchTasteStoreCloud(
  userId: string,
): Promise<TasteStoreCloudRow | null> {
  const data = await withTimeout(
    (async () => {
      const { data: row, error } = await supabase
        .from('taste_stores')
        .select('store, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return row
    })(),
    CLOUD_FETCH_TIMEOUT_MS,
    'taste cloud fetch',
  )

  if (!data) return null

  const row = data as Pick<TasteStoreRow, 'store' | 'updated_at'>
  const raw = row.store ?? { categories: [], stickers: [], monthBackgrounds: {} }
  const lean = stripInlineTasteImages(raw)
  const store = await hydrateTasteStoreFromCloud(lean)
  return {
    store,
    updatedAt: row.updated_at,
  }
}

export function localHasUnsyncedTasteImages(
  local: TasteStore,
  cloud?: TasteStore | null,
): boolean {
  const cloudRefIds = new Set(
    (cloud?.stickers ?? [])
      .filter((s) => isTasteStorageRef(s.imageDataUrl))
      .map((s) => s.id),
  )
  const stickerNeedsUpload = local.stickers.some(
    (s) => isTasteDataUrl(s.imageDataUrl) && !cloudRefIds.has(s.id),
  )
  if (stickerNeedsUpload) return true

  const cloudBgRefs = new Set(
    Object.entries(cloud?.monthBackgrounds ?? {})
      .filter(([, bg]) => isTasteStorageRef(bg))
      .map(([key]) => key),
  )
  return Object.entries(local.monthBackgrounds).some(
    ([key, bg]) => isTasteDataUrl(bg) && !cloudBgRefs.has(key),
  )
}

export async function upsertTasteStoreCloud(
  userId: string,
  store: TasteStore,
  updatedAt: string,
): Promise<void> {
  const lean = await prepareTasteStoreForCloud(userId, store)
  const row: TasteStoreRow = {
    user_id: userId,
    store: lean,
    updated_at: updatedAt,
  }
  const { error } = await supabase.from('taste_stores').upsert(row, {
    onConflict: 'user_id',
  })
  if (error) throw error
}

/** Push local polaroid photos to storage when cloud only has metadata. */
export async function backfillTasteImagesToCloud(
  userId: string,
  store: TasteStore,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('taste_stores')
    .select('store')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error

  const cloudStore = (data as { store?: TasteStore } | null)?.store ?? null
  if (!localHasUnsyncedTasteImages(store, cloudStore)) return false

  const updatedAt = new Date().toISOString()
  await upsertTasteStoreCloud(userId, store, updatedAt)
  return true
}
