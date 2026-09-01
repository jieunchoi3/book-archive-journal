import type { TasteStore } from '../types/taste'
import { supabase } from './supabase'

export const TASTE_MEDIA_BUCKET = 'taste-media'
export const TASTE_STORAGE_PREFIX = 'taste-storage:'
const SIGNED_URL_TTL_SEC = 60 * 60 * 6

export function isTasteDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

export function isTasteStorageRef(value: string): boolean {
  return value.startsWith(TASTE_STORAGE_PREFIX)
}

export function toTasteStorageRef(path: string): string {
  return `${TASTE_STORAGE_PREFIX}${path}`
}

export function tasteStoragePathFromRef(ref: string): string | null {
  if (!isTasteStorageRef(ref)) return null
  return ref.slice(TASTE_STORAGE_PREFIX.length)
}

function stickerImagePath(userId: string, stickerId: string) {
  return `${userId}/stickers/${stickerId}.jpg`
}

function monthBackgroundPath(userId: string, monthKey: string) {
  return `${userId}/backgrounds/${monthKey}.jpg`
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

async function uploadDataUrl(path: string, dataUrl: string): Promise<void> {
  const blob = await dataUrlToBlob(dataUrl)
  const { error } = await supabase.storage.from(TASTE_MEDIA_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'image/jpeg',
    cacheControl: '86400',
  })
  if (error) throw error
}

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  const out = new Map<string, string>()
  if (!unique.length) return out

  const { data, error } = await supabase.storage
    .from(TASTE_MEDIA_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC)

  if (error) {
    console.warn('[taste] batch signed URLs failed', error.message)
    return out
  }

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out.set(item.path, item.signedUrl)
  }
  return out
}

/** Upload inline images and return a lean store safe for jsonb sync. */
export async function prepareTasteStoreForCloud(
  userId: string,
  store: TasteStore,
): Promise<TasteStore> {
  const stickers = await Promise.all(
    store.stickers.map(async (sticker) => {
      if (!isTasteDataUrl(sticker.imageDataUrl)) return sticker
      const path = stickerImagePath(userId, sticker.id)
      await uploadDataUrl(path, sticker.imageDataUrl)
      return { ...sticker, imageDataUrl: toTasteStorageRef(path) }
    }),
  )

  const monthBackgrounds: Record<string, string> = {}
  for (const [monthKey, bg] of Object.entries(store.monthBackgrounds)) {
    if (!isTasteDataUrl(bg)) {
      monthBackgrounds[monthKey] = bg
      continue
    }
    const path = monthBackgroundPath(userId, monthKey)
    await uploadDataUrl(path, bg)
    monthBackgrounds[monthKey] = toTasteStorageRef(path)
  }

  return { ...store, stickers, monthBackgrounds }
}

/** Resolve storage refs to signed URLs for rendering. */
export async function hydrateTasteStoreFromCloud(store: TasteStore): Promise<TasteStore> {
  const paths: string[] = []
  for (const sticker of store.stickers) {
    const path = tasteStoragePathFromRef(sticker.imageDataUrl)
    if (path) paths.push(path)
  }
  for (const bg of Object.values(store.monthBackgrounds)) {
    const path = tasteStoragePathFromRef(bg)
    if (path) paths.push(path)
  }

  const urls = await signedUrls(paths)

  const stickers = store.stickers.map((sticker) => {
    const path = tasteStoragePathFromRef(sticker.imageDataUrl)
    if (!path) return sticker
    const signed = urls.get(path)
    return signed ? { ...sticker, imageDataUrl: signed } : { ...sticker, imageDataUrl: '' }
  })

  const monthBackgrounds: Record<string, string> = {}
  for (const [monthKey, bg] of Object.entries(store.monthBackgrounds)) {
    const path = tasteStoragePathFromRef(bg)
    if (!path) {
      monthBackgrounds[monthKey] = bg
      continue
    }
    monthBackgrounds[monthKey] = urls.get(path) ?? ''
  }

  return { ...store, stickers, monthBackgrounds }
}
