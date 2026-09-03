import type { TasteStore } from '../types/taste'
import {
  emptyTasteStore,
  hasCustomTasteCategories,
  isDefaultTasteStore,
} from '../types/taste'
import {
  backfillTasteImagesToCloud,
  fetchTasteStoreCloud,
  fetchTasteStoreCloudRawWithMeta,
  localHasUnsyncedTasteImages,
  mergeTasteStores,
  upsertTasteStoreCloud,
} from './tasteCloud'
import { isSupabaseConfigured } from './supabase'

const DB_NAME = 'planner-taste'
const DB_VERSION = 1
const STORE = 'store'
const BACKUP_KEY = (userId: string) => `planner-taste-backup:v1:${userId}`

function leanStoreForBackup(store: TasteStore): TasteStore {
  return {
    ...store,
    stickers: store.stickers.map((s) => ({
      ...s,
      imageDataUrl: s.imageDataUrl?.startsWith('data:') ? '' : (s.imageDataUrl ?? ''),
    })),
    monthBackgrounds: Object.fromEntries(
      Object.entries(store.monthBackgrounds).map(([key, bg]) => [
        key,
        bg?.startsWith('data:') ? '' : bg,
      ]),
    ),
  }
}

function saveTasteBackup(userId: string, store: TasteStore, updatedAt: string): void {
  try {
    localStorage.setItem(
      BACKUP_KEY(userId),
      JSON.stringify({ store: leanStoreForBackup(store), updatedAt }),
    )
  } catch (e) {
    console.warn('[taste] localStorage backup failed', e)
  }
}

function loadTasteBackup(userId: string): StoredRow | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { store?: TasteStore; updatedAt?: string }
    if (!parsed.store?.categories?.length) return null
    return {
      id: rowId(userId),
      userId,
      store: parsed.store,
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

/** Downloadable JSON backup (metadata; strips inline photos). */
export function exportTasteBackupJson(userId: string, store: TasteStore): string {
  return JSON.stringify(
    { version: 1, userId, exportedAt: new Date().toISOString(), store: leanStoreForBackup(store) },
    null,
    2,
  )
}

export function importTasteBackupJson(raw: string): TasteStore | null {
  try {
    const parsed = JSON.parse(raw) as { store?: TasteStore }
    if (!parsed.store?.categories?.length) return null
    return parsed.store
  } catch {
    return null
  }
}

function rowId(userId: string) {
  return userId
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

interface StoredRow {
  id: string
  userId: string
  store: TasteStore
  updatedAt: string
}

function stickerCount(store: TasteStore | null | undefined): number {
  return store?.stickers.length ?? 0
}

async function loadTasteStoreLocal(userId: string): Promise<StoredRow | null> {
  const db = await openDb()
  const fromIdb = await new Promise<StoredRow | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(rowId(userId))
    req.onsuccess = () => {
      const row = req.result as StoredRow | undefined
      resolve(row ?? null)
    }
    req.onerror = () => reject(req.error)
  })

  if (fromIdb?.store?.categories?.length) return fromIdb

  const backup = loadTasteBackup(userId)
  if (!backup) return fromIdb

  console.info('[taste] restored store from localStorage backup')
  await saveTasteStoreLocal(userId, backup.store, backup.updatedAt)
  return backup
}

async function saveTasteStoreLocal(
  userId: string,
  store: TasteStore,
  updatedAt: string,
): Promise<void> {
  const db = await openDb()
  const row: StoredRow = {
    id: rowId(userId),
    userId,
    store,
    updatedAt,
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(row)
    tx.oncomplete = () => {
      saveTasteBackup(userId, store, updatedAt)
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

function categoryCount(store: TasteStore | null | undefined): number {
  return store?.categories?.length ?? 0
}

function parseTs(value: string | undefined): number {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

async function mergeLocalAndCloud(userId: string, local: StoredRow | null): Promise<TasteStore> {
  if (!isSupabaseConfigured) {
    return local?.store ?? emptyTasteStore()
  }

  const localStore = local?.store ?? emptyTasteStore()
  const localUpdatedAt = local?.updatedAt ?? ''
  const localTs = parseTs(localUpdatedAt)

  try {
    const cloudRow = await fetchTasteStoreCloudRawWithMeta(userId)

    if (!cloudRow) {
      if (stickerCount(localStore) > 0 || hasCustomTasteCategories(localStore)) {
        const updatedAt = new Date().toISOString()
        await saveTasteStoreLocal(userId, localStore, updatedAt)
        await upsertTasteStoreCloud(userId, localStore, updatedAt)
      }
      return localStore
    }

    const { store: cloudRaw, updatedAt: cloudUpdatedAt } = cloudRow
    const cloudTs = parseTs(cloudUpdatedAt)
    const preferLocalCategories = localTs >= cloudTs

    const cloudStore =
      stickerCount(cloudRaw) > 0
        ? (await fetchTasteStoreCloud(userId))?.store ?? cloudRaw
        : cloudRaw

    const merged = mergeTasteStores(localStore, cloudStore, preferLocalCategories)
    const mergedCount = stickerCount(merged)
    const cloudCount = stickerCount(cloudStore)
    const localCount = stickerCount(localStore)
    const needsCloudPush =
      mergedCount !== cloudCount ||
      mergedCount !== localCount ||
      hasCustomTasteCategories(merged) !== hasCustomTasteCategories(cloudStore)

    const updatedAt = new Date().toISOString()
    await saveTasteStoreLocal(userId, merged, updatedAt)

    if (needsCloudPush || localHasUnsyncedTasteImages(merged, cloudStore)) {
      await upsertTasteStoreCloud(userId, merged, updatedAt)
    }

    return merged
  } catch (e) {
    console.warn('[taste] cloud load failed, using local', e)
    return localStore
  }
}

/** Fast path: IndexedDB only (for instant UI). */
export async function loadTasteStoreLocalOnly(userId: string): Promise<TasteStore> {
  const local = await loadTasteStoreLocal(userId)
  return local?.store ?? emptyTasteStore()
}

/** IndexedDB row with updatedAt (for sync decisions). */
export async function loadTasteStoreLocalRow(userId: string): Promise<StoredRow | null> {
  return loadTasteStoreLocal(userId)
}

/** Background merge with Supabase. */
export async function syncTasteStoreWithCloud(userId: string): Promise<TasteStore> {
  const local = await loadTasteStoreLocal(userId)
  return mergeLocalAndCloud(userId, local)
}

export async function loadTasteStore(userId: string): Promise<TasteStore> {
  const local = await loadTasteStoreLocal(userId)
  return mergeLocalAndCloud(userId, local)
}

export async function saveTasteStore(userId: string, store: TasteStore): Promise<void> {
  let nextStore = store
  if (isSupabaseConfigured) {
    try {
      const cloudMeta = await fetchTasteStoreCloudRawWithMeta(userId)
      if (cloudMeta?.store) {
        nextStore = mergeTasteStores(store, cloudMeta.store, true)
        if (stickerCount(nextStore) !== store.stickers.length) {
          console.info(
            `[taste] merged cloud stickers before save (${store.stickers.length} -> ${nextStore.stickers.length})`,
          )
        }
      }
    } catch (e) {
      console.warn('[taste] pre-save cloud merge check failed', e)
    }
  }

  const updatedAt = new Date().toISOString()
  await saveTasteStoreLocal(userId, nextStore, updatedAt)

  if (!isSupabaseConfigured) return

  await upsertTasteStoreCloud(userId, nextStore, updatedAt)
}

/** True when Supabase has no taste row for this user yet. */
export async function isTasteCloudEmpty(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true
  try {
    const meta = await fetchTasteStoreCloudRawWithMeta(userId)
    return !meta || (stickerCount(meta.store) === 0 && !hasCustomTasteCategories(meta.store))
  } catch {
    return true
  }
}

/** Merge cloud into local; never wipe local when cloud row is missing. */
export async function reloadTasteStoreFromCloud(userId: string): Promise<TasteStore> {
  if (!isSupabaseConfigured) return loadTasteStoreLocalOnly(userId)

  const local = await loadTasteStoreLocal(userId)
  const localStore = local?.store ?? emptyTasteStore()

  const cloud = await fetchTasteStoreCloud(userId)
  if (!cloud?.store) return localStore

  const localTs = parseTs(local?.updatedAt)
  const merged = mergeTasteStores(
    localStore,
    cloud.store,
    localTs >= parseTs(cloud.updatedAt),
  )
  await saveTasteStoreLocal(userId, merged, cloud.updatedAt)

  if (localHasUnsyncedTasteImages(merged, cloud.store)) {
    await backfillTasteImagesToCloud(userId, merged)
  }

  return merged
}

/** Upload local taste data to cloud, then merge both sides (safe manual sync). */
export async function syncTasteManual(userId: string): Promise<TasteStore> {
  const localRow = await loadTasteStoreLocal(userId)
  const local = localRow?.store ?? emptyTasteStore()
  await publishLocalTasteIfNeeded(userId, local, localRow?.updatedAt)
  return syncTasteStoreWithCloud(userId)
}

/** Upload local taste when cloud is missing, default-only, or older. */
export async function publishLocalTasteIfNeeded(
  userId: string,
  localStore: TasteStore,
  localUpdatedAt?: string,
): Promise<boolean> {
  if (!isSupabaseConfigured || isDefaultTasteStore(localStore)) return false

  try {
    const cloudMeta = await fetchTasteStoreCloudRawWithMeta(userId)
    if (!cloudMeta) {
      const updatedAt = new Date().toISOString()
      await saveTasteStoreLocal(userId, localStore, updatedAt)
      await upsertTasteStoreCloud(userId, localStore, updatedAt)
      return true
    }

    const localTs = parseTs(localUpdatedAt)
    const cloudTs = parseTs(cloudMeta.updatedAt)
    const localRicher =
      categoryCount(localStore) > categoryCount(cloudMeta.store) ||
      stickerCount(localStore) > stickerCount(cloudMeta.store)

    if (
      isDefaultTasteStore(cloudMeta.store) ||
      localTs > cloudTs ||
      localRicher
    ) {
      const updatedAt = new Date().toISOString()
      const merged = mergeTasteStores(localStore, cloudMeta.store, true)
      await saveTasteStoreLocal(userId, merged, updatedAt)
      await upsertTasteStoreCloud(userId, merged, updatedAt)
      console.info('[taste] published newer local store to cloud')
      return true
    }

    return false
  } catch (e) {
    console.warn('[taste] publish local to cloud failed', e)
    return false
  }
}

/** @deprecated use publishLocalTasteIfNeeded */
export async function publishLocalTasteIfCloudEmpty(
  userId: string,
  localStore: TasteStore,
): Promise<boolean> {
  const local = await loadTasteStoreLocal(userId)
  return publishLocalTasteIfNeeded(userId, localStore, local?.updatedAt)
}

/** Pick cloud reload when Supabase is newer or richer (Dock / phone). */
export async function shouldReloadTasteFromCloud(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  try {
    const [local, cloudMeta] = await Promise.all([
      loadTasteStoreLocal(userId),
      fetchTasteStoreCloudRawWithMeta(userId),
    ])
    if (!cloudMeta) return false

    const localStore = local?.store ?? emptyTasteStore()
    const localTs = parseTs(local?.updatedAt)
    const cloudTs = parseTs(cloudMeta.updatedAt)

    if (cloudTs > localTs) return true
    if (categoryCount(cloudMeta.store) > categoryCount(localStore)) return true
    if (stickerCount(cloudMeta.store) > stickerCount(localStore)) return true
    if (isDefaultTasteStore(localStore) && hasCustomTasteCategories(cloudMeta.store)) return true
    if (isDefaultTasteStore(localStore) && stickerCount(cloudMeta.store) > 0) return true

    return false
  } catch {
    return false
  }
}
