import type { TasteStore } from '../types/taste'
import { emptyTasteStore } from '../types/taste'
import {
  backfillTasteImagesToCloud,
  fetchTasteStoreCloud,
  fetchTasteStoreCloudMeta,
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

function isEmptyStore(store: TasteStore): boolean {
  return (
    store.stickers.length === 0 &&
    store.categories.length === 0 &&
    Object.keys(store.monthBackgrounds).length === 0
  )
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
    const localStore = local?.store
    const localEmpty = !localStore || isEmptyStore(localStore)
    const cloudMeta = await fetchTasteStoreCloudMeta(userId)

    if (!cloudMeta && local && !localEmpty) {
      await backfillTasteImagesToCloud(userId, local.store)
      return local.store
    }

    if (!cloudMeta) {
      return local?.store ?? emptyTasteStore()
    }

    const cloud = await fetchTasteStoreCloud(userId)
    const cloudStore = cloud?.store ?? null
    const cloudEmpty = !cloudStore || isEmptyStore(cloudStore)

    if (localEmpty && cloudStore && !cloudEmpty) {
      await saveTasteStoreLocal(userId, cloudStore, cloudMeta.updatedAt)
      return cloudStore
    }

    if (local && !localEmpty && cloudStore && !cloudEmpty) {
      const merged = mergeTasteStores(local.store, cloudStore)
      const updatedAt = new Date().toISOString()
      await saveTasteStoreLocal(userId, merged, updatedAt)
      if (localHasUnsyncedTasteImages(merged, cloudStore)) {
        await backfillTasteImagesToCloud(userId, merged)
      } else if (merged.stickers.length >= local.store.stickers.length) {
        void upsertTasteStoreCloud(userId, merged, updatedAt).catch((e) =>
          console.warn('[taste] cloud merge upsert failed', e),
        )
      }
      return merged
    }

    if (local && !localEmpty) {
      if (localHasUnsyncedTasteImages(local.store, cloudStore)) {
        await backfillTasteImagesToCloud(userId, local.store)
      } else if (!cloudStore || local.store.stickers.length >= cloudStore.stickers.length) {
        void upsertTasteStoreCloud(userId, local.store, local.updatedAt).catch((e) =>
          console.warn('[taste] cloud refresh failed', e),
        )
      }
      return local.store
    }

    return cloudStore ?? local?.store ?? emptyTasteStore()
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
      const cloudCount = cloudStore?.stickers.length ?? 0
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
