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

function isSupabaseSignedUrl(value: string): boolean {
  return (
    value.includes('/storage/v1/object/sign/') ||
    value.includes('/storage/v1/object/authenticated/')
  )
}

/** True when polaroid images need fresh signed URLs before rendering. */
export function tasteStoreNeedsHydration(store: TasteStore): boolean {
  for (const sticker of store.stickers) {
    const url = sticker.imageDataUrl
    if (isTasteStorageRef(url) || isSupabaseSignedUrl(url)) return true
  }
  for (const bg of Object.values(store.monthBackgrounds)) {
    if (isTasteStorageRef(bg) || isSupabaseSignedUrl(bg)) return true
  }
  return false
}

/** Persist storage refs in IndexedDB — not short-lived signed URLs. */
export function dehydrateTasteStoreForPersistence(
  userId: string,
  store: TasteStore,
): TasteStore {
  return {
    ...store,
    stickers: store.stickers.map((sticker) => ({
      ...sticker,
      imageDataUrl: persistableTasteImageRef(
        userId,
        sticker.id,
        sticker.imageDataUrl,
        stickerImagePath(userId, sticker.id),
      ),
    })),
    monthBackgrounds: Object.fromEntries(
      Object.entries(store.monthBackgrounds).map(([monthKey, bg]) => [
        monthKey,
        persistableTasteImageRef(
          userId,
          monthKey,
          bg,
          monthBackgroundPath(userId, monthKey),
        ),
      ]),
    ),
  }
}

function persistableTasteImageRef(
  userId: string,
  _id: string,
  url: string,
  defaultPath: string,
): string {
  if (!url) return ''
  if (isTasteDataUrl(url)) return ''
  if (isTasteStorageRef(url)) return url
  if (isSupabaseSignedUrl(url)) return toTasteStorageRef(defaultPath)
  // Non-storage URLs (e.g. remote thumbnails) can stay as-is.
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith(`${userId}/`)) return toTasteStorageRef(url)
  return url
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

async function tryUploadDataUrl(path: string, dataUrl: string): Promise<string | null> {
  try {
    await uploadDataUrl(path, dataUrl)
    return toTasteStorageRef(path)
  } catch (e) {
    console.warn('[taste] image upload failed, saving metadata only', path, e)
    return null
  }
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

/** Upload inline images and return a lean store safe for jsonb sync. */
export async function prepareTasteStoreForCloud(
  userId: string,
  store: TasteStore,
): Promise<TasteStore> {
  const stickers = await mapWithConcurrency(store.stickers, 4, async (sticker) => {
    if (isTasteStorageRef(sticker.imageDataUrl)) return sticker
    if (!isTasteDataUrl(sticker.imageDataUrl)) return sticker
    const path = stickerImagePath(userId, sticker.id)
    const ref = await tryUploadDataUrl(path, sticker.imageDataUrl)
    return ref ? { ...sticker, imageDataUrl: ref } : { ...sticker, imageDataUrl: '' }
  })

  const monthBackgrounds: Record<string, string> = {}
  for (const [monthKey, bg] of Object.entries(store.monthBackgrounds)) {
    if (!isTasteDataUrl(bg)) {
      monthBackgrounds[monthKey] = bg
      continue
    }
    const path = monthBackgroundPath(userId, monthKey)
    const ref = await tryUploadDataUrl(path, bg)
    monthBackgrounds[monthKey] = ref ?? ''
  }

  return { ...store, stickers, monthBackgrounds }
}

/** Resolve storage refs (and refresh signed URLs) for rendering. */
export async function hydrateTasteStoreFromCloud(
  store: TasteStore,
  userId?: string,
): Promise<TasteStore> {
  const paths: string[] = []
  const stickerPathById = new Map<string, string>()
  const bgPathByMonth = new Map<string, string>()

  for (const sticker of store.stickers) {
    let path = tasteStoragePathFromRef(sticker.imageDataUrl)
    if (!path && userId && isSupabaseSignedUrl(sticker.imageDataUrl)) {
      path = stickerImagePath(userId, sticker.id)
    }
    if (path) {
      paths.push(path)
      stickerPathById.set(sticker.id, path)
    }
  }

  for (const [monthKey, bg] of Object.entries(store.monthBackgrounds)) {
    let path = tasteStoragePathFromRef(bg)
    if (!path && userId && isSupabaseSignedUrl(bg)) {
      path = monthBackgroundPath(userId, monthKey)
    }
    if (path) {
      paths.push(path)
      bgPathByMonth.set(monthKey, path)
    }
  }

  const urls = await signedUrls(paths)

  const stickers = store.stickers.map((sticker) => {
    const path = stickerPathById.get(sticker.id)
    if (!path) return sticker
    const signed = urls.get(path)
    return signed ? { ...sticker, imageDataUrl: signed } : { ...sticker, imageDataUrl: '' }
  })

  const monthBackgrounds: Record<string, string> = {}
  for (const [monthKey, bg] of Object.entries(store.monthBackgrounds)) {
    const path = bgPathByMonth.get(monthKey)
    if (!path) {
      monthBackgrounds[monthKey] = bg
      continue
    }
    monthBackgrounds[monthKey] = urls.get(path) ?? ''
  }

  return { ...store, stickers, monthBackgrounds }
}

export async function ensureTasteStoreHydrated(
  userId: string,
  store: TasteStore,
): Promise<TasteStore> {
  if (!tasteStoreNeedsHydration(store)) return store
  return hydrateTasteStoreFromCloud(store, userId)
}
