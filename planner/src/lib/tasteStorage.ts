import type { TasteStore } from '../types/taste'
import { emptyTasteStore } from '../types/taste'
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
    const updatedAt = new Date().toISOString()
    await saveTasteStoreLocal(userId, merged, updatedAt)

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

/** Force reload from Supabase (ignores stale local sticker cache). */
export async function reloadTasteStoreFromCloud(userId: string): Promise<TasteStore> {
  if (!isSupabaseConfigured) return loadTasteStoreLocalOnly(userId)

  const cloud = await fetchTasteStoreCloud(userId)
  if (!cloud?.store) return emptyTasteStore()

  const local = await loadTasteStoreLocal(userId)
  const merged = local?.store
    ? mergeTasteStores(local.store, cloud.store)
    : cloud.store
  const updatedAt = new Date().toISOString()
  await saveTasteStoreLocal(userId, merged, updatedAt)
  return merged
}
