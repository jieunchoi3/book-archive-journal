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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(rowId(userId))
    req.onsuccess = () => {
      const row = req.result as StoredRow | undefined
      resolve(row ?? null)
    }
    req.onerror = () => reject(req.error)
  })
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
    tx.oncomplete = () => resolve()
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
      if (!isDefaultTasteStore(localStore)) {
        const updatedAt = new Date().toISOString()
        await saveTasteStoreLocal(userId, localStore, updatedAt)
        await upsertTasteStoreCloud(userId, localStore, updatedAt)
      }
      return localStore
    }

    const { store: cloudRaw, updatedAt: cloudUpdatedAt } = cloudRow
    const cloudTs = parseTs(cloudUpdatedAt)
    const localNewer = localTs > cloudTs
    const cloudNewer = cloudTs > localTs
    const localRicher =
      categoryCount(localStore) > categoryCount(cloudRaw) ||
      stickerCount(localStore) > stickerCount(cloudRaw)
    const cloudRicher =
      categoryCount(cloudRaw) > categoryCount(localStore) ||
      stickerCount(cloudRaw) > stickerCount(localStore)

    // Hydrate cloud images only when we will use cloud data on this device.
    const cloudStore =
      cloudRicher || (cloudNewer && !localNewer)
        ? (await fetchTasteStoreCloud(userId))?.store ?? cloudRaw
        : cloudRaw

    const preferLocalCategories = localNewer || localRicher
    const merged = mergeTasteStores(localStore, cloudStore, preferLocalCategories)

    if (isDefaultTasteStore(localStore) && !isDefaultTasteStore(cloudStore)) {
      await saveTasteStoreLocal(userId, merged, cloudUpdatedAt)
      return merged
    }

    if (localNewer || (localRicher && !cloudRicher)) {
      const updatedAt = new Date().toISOString()
      await saveTasteStoreLocal(userId, merged, updatedAt)
      await upsertTasteStoreCloud(userId, merged, updatedAt)
      if (localHasUnsyncedTasteImages(merged, cloudStore)) {
        await backfillTasteImagesToCloud(userId, merged)
      }
      return merged
    }

    if (cloudNewer || cloudRicher) {
      await saveTasteStoreLocal(userId, merged, cloudUpdatedAt)
      if (localHasUnsyncedTasteImages(merged, cloudStore)) {
        await backfillTasteImagesToCloud(userId, merged)
      }
      return merged
    }

    const updatedAt = new Date().toISOString()
    await saveTasteStoreLocal(userId, merged, updatedAt)
    if (!isDefaultTasteStore(merged)) {
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
      const cloudStore = cloudMeta?.store ?? null
      const cloudCount = stickerCount(cloudStore)
      if (cloudCount > store.stickers.length + 2) {
        nextStore = mergeTasteStores(store, cloudStore!, true)
        console.warn(
          `[taste] merged cloud stickers before save (${store.stickers.length} -> ${nextStore.stickers.length})`,
        )
      }
    } catch (e) {
      console.warn('[taste] pre-save cloud merge check failed', e)
    }
  }

  const updatedAt = new Date().toISOString()
  await saveTasteStoreLocal(userId, nextStore, updatedAt)

  if (!isSupabaseConfigured) return

  try {
    await upsertTasteStoreCloud(userId, nextStore, updatedAt)
  } catch (e) {
    console.warn('[taste] cloud save failed', e)
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
