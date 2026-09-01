import type { TasteCategory, TasteStore } from '../types/taste'
import { supabase } from './supabase'
import {
  hydrateTasteStoreFromCloud,
  isTasteDataUrl,
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

export function mergeTasteStores(local: TasteStore, cloud: TasteStore): TasteStore {
  const categories = mergeCategories(local.categories, cloud.categories)
  const stickerMap = new Map<string, TasteStore['stickers'][number]>()
  for (const sticker of local.stickers) stickerMap.set(sticker.id, sticker)
  for (const sticker of cloud.stickers) {
    const prev = stickerMap.get(sticker.id)
    if (!prev || sticker.createdAt >= prev.createdAt) {
      const merged = { ...sticker }
      if (prev?.imageDataUrl && isTasteDataUrl(prev.imageDataUrl) && !isTasteDataUrl(merged.imageDataUrl)) {
        merged.imageDataUrl = prev.imageDataUrl
      }
      stickerMap.set(sticker.id, merged)
    }
  }
  const monthBackgrounds = { ...cloud.monthBackgrounds, ...local.monthBackgrounds }
  return {
    categories,
    stickers: [...stickerMap.values()],
    monthBackgrounds,
  }
}

function mergeCategories(local: TasteCategory[], cloud: TasteCategory[]): TasteCategory[] {
  const map = new Map<string, TasteCategory>()
  for (const cat of local) map.set(cat.id, cat)
  for (const cat of cloud) {
    const prev = map.get(cat.id)
    if (!prev) {
      map.set(cat.id, cat)
      continue
    }
    const subMap = new Map(prev.subcategories.map((s) => [s.id, s]))
    for (const sub of cat.subcategories) subMap.set(sub.id, sub)
    map.set(cat.id, { ...cat, subcategories: [...subMap.values()] })
  }
  return [...map.values()]
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
