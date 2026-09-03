import type { TasteStore } from '../types/taste'
import {
  emptyTasteStore,
  hasCustomTasteCategories,
  isDefaultTasteStore,
} from '../types/taste'
import {
  backfillTasteImagesToCloud,
  fetchTasteStoreCloud,
  fetchTasteStoreCloudRaw,
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

async function mergeLocalAndCloud(userId: string, local: StoredRow | null): Promise<TasteStore> {
  if (!isSupabaseConfigured) {
    return local?.store ?? emptyTasteStore()
  }

  try {
    const cloud = await fetchTasteStoreCloud(userId)
    const cloudStore = cloud?.store ?? null
    const localStore = local?.store ?? null
    const localCount = stickerCount(localStore)
    const cloudCount = stickerCount(cloudStore)

    if (!cloudStore || cloudCount === 0) {
      return localStore ?? emptyTasteStore()
    }

    if (localCount === 0) {
      await saveTasteStoreLocal(userId, cloudStore, cloud!.updatedAt)
      return cloudStore
    }

    const merged = mergeTasteStores(localStore!, cloudStore)
    await saveTasteStoreLocal(userId, merged, cloud!.updatedAt)

    // Cloud has more metadata — treat Supabase as source of truth; only push local photos up.
    if (cloudCount > localCount) {
      if (localHasUnsyncedTasteImages(merged, cloudStore)) {
        await backfillTasteImagesToCloud(userId, merged)
      }
      return merged
    }

    const updatedAt = new Date().toISOString()
    if (localHasUnsyncedTasteImages(merged, cloudStore)) {
      await backfillTasteImagesToCloud(userId, merged)
    } else if (merged.stickers.length >= localCount) {
      void upsertTasteStoreCloud(userId, merged, updatedAt).catch((e) =>
        console.warn('[taste] cloud merge upsert failed', e),
      )
    }

    return merged
  } catch (e) {
    console.warn('[taste] cloud load failed, using local', e)
    return local?.store ?? emptyTasteStore()
  }
}

/** Fast path: IndexedDB only (for instant UI). */
export async function loadTasteStoreLocalOnly(userId: string): Promise<TasteStore> {
  const local = await loadTasteStoreLocal(userId)
  return local?.store ?? emptyTasteStore()
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
      const cloudStore = await fetchTasteStoreCloudRaw(userId)
      const cloudCount = stickerCount(cloudStore)
      if (cloudCount > store.stickers.length + 2) {
        nextStore = mergeTasteStores(store, cloudStore!)
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

  const merged = mergeTasteStores(localStore, cloud.store)
  await saveTasteStoreLocal(userId, merged, cloud.updatedAt)

  if (localHasUnsyncedTasteImages(merged, cloud.store)) {
    await backfillTasteImagesToCloud(userId, merged)
  }

  return merged
}

/** Upload local taste data to cloud, then merge both sides (safe manual sync). */
export async function syncTasteManual(userId: string): Promise<TasteStore> {
  const local = await loadTasteStoreLocalOnly(userId)
  if (!isDefaultTasteStore(local)) {
    await publishLocalTasteIfCloudEmpty(userId, local)
  }
  const merged = await syncTasteStoreWithCloud(userId)
  if (!isDefaultTasteStore(merged)) return merged
  if (!isDefaultTasteStore(local)) return local
  return merged
}

/** Push Safari/local data up when Supabase row is missing or still default-only. */
export async function publishLocalTasteIfCloudEmpty(
  userId: string,
  localStore: TasteStore,
): Promise<boolean> {
  if (!isSupabaseConfigured || isDefaultTasteStore(localStore)) return false

  try {
    const cloudRaw = await fetchTasteStoreCloudRaw(userId)
    if (cloudRaw && !isDefaultTasteStore(cloudRaw)) return false

    const updatedAt = new Date().toISOString()
    await saveTasteStoreLocal(userId, localStore, updatedAt)
    await upsertTasteStoreCloud(userId, localStore, updatedAt)
    console.info('[taste] published local store to cloud (cloud was empty/default)')
    return true
  } catch (e) {
    console.warn('[taste] publish local to cloud failed', e)
    return false
  }
}

/** Pick cloud reload when Supabase has more data than this device (e.g. Dock PWA). */
export async function shouldReloadTasteFromCloud(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  try {
    const [local, cloudRaw] = await Promise.all([
      loadTasteStoreLocal(userId),
      fetchTasteStoreCloudRaw(userId),
    ])
    if (!cloudRaw) return false

    const localStore = local?.store ?? emptyTasteStore()
    const cloudCount = cloudRaw.stickers?.length ?? 0
    const localCount = stickerCount(localStore)

    if (cloudCount > localCount) return true
    if (isDefaultTasteStore(localStore) && hasCustomTasteCategories(cloudRaw)) return true
    if (isDefaultTasteStore(localStore) && cloudCount > 0) return true
    if (
      !hasCustomTasteCategories(localStore) &&
      hasCustomTasteCategories(cloudRaw) &&
      localCount === 0
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}
