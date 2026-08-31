import type { TasteCategory, TasteStore } from '../types/taste'
import { supabase } from './supabase'

type TasteStoreRow = {
  user_id: string
  store: TasteStore
  updated_at: string
}

export interface TasteStoreCloudRow {
  store: TasteStore
  updatedAt: string
}

export function mergeTasteStores(local: TasteStore, cloud: TasteStore): TasteStore {
  const categories = mergeCategories(local.categories, cloud.categories)
  const stickerMap = new Map<string, TasteStore['stickers'][number]>()
  for (const sticker of local.stickers) stickerMap.set(sticker.id, sticker)
  for (const sticker of cloud.stickers) {
    const prev = stickerMap.get(sticker.id)
    if (!prev || sticker.createdAt >= prev.createdAt) {
      stickerMap.set(sticker.id, sticker)
    }
  }
  return {
    categories,
    stickers: [...stickerMap.values()],
    monthBackgrounds: { ...local.monthBackgrounds, ...cloud.monthBackgrounds },
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

export async function fetchTasteStoreCloud(
  userId: string,
): Promise<TasteStoreCloudRow | null> {
  const { data, error } = await supabase
    .from('taste_stores')
    .select('store, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as Pick<TasteStoreRow, 'store' | 'updated_at'>
  return {
    store: row.store ?? { categories: [], stickers: [], monthBackgrounds: {} },
    updatedAt: row.updated_at,
  }
}

export async function upsertTasteStoreCloud(
  userId: string,
  store: TasteStore,
  updatedAt: string,
): Promise<void> {
  const row: TasteStoreRow = {
    user_id: userId,
    store,
    updated_at: updatedAt,
  }
  const { error } = await supabase.from('taste_stores').upsert(row, {
    onConflict: 'user_id',
  })
  if (error) throw error
}
