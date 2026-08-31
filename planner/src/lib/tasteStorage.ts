import type { TasteStore } from '../types/taste'
import { emptyTasteStore } from '../types/taste'
import {
  fetchTasteStoreCloud,
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
    const cloud = await fetchTasteStoreCloud(userId)
    const localStore = local?.store
    const localEmpty = !localStore || isEmptyStore(localStore)
    const cloudEmpty = !cloud || isEmptyStore(cloud.store)

    if (cloudEmpty && local && !localEmpty) {
      await upsertTasteStoreCloud(userId, local.store, local.updatedAt)
      return local.store
    }

    if (!cloudEmpty && localEmpty) {
      await saveTasteStoreLocal(userId, cloud!.store, cloud!.updatedAt)
      return cloud!.store
    }

    if (!cloudEmpty && local && !localEmpty) {
      const merged = mergeTasteStores(local.store, cloud!.store)
      const updatedAt = new Date().toISOString()
      await saveTasteStoreLocal(userId, merged, updatedAt)
      await upsertTasteStoreCloud(userId, merged, updatedAt)
      return merged
    }

    return cloud?.store ?? local?.store ?? emptyTasteStore()
  } catch (e) {
    console.warn('[taste] cloud load failed, using local', e)
    return local?.store ?? emptyTasteStore()
  }
}

export async function loadTasteStore(userId: string): Promise<TasteStore> {
  const local = await loadTasteStoreLocal(userId)
  return mergeLocalAndCloud(userId, local)
}

export async function saveTasteStore(userId: string, store: TasteStore): Promise<void> {
  const updatedAt = new Date().toISOString()
  await saveTasteStoreLocal(userId, store, updatedAt)

  if (!isSupabaseConfigured) return

  try {
    await upsertTasteStoreCloud(userId, store, updatedAt)
  } catch (e) {
    console.error('[taste] cloud save failed', e)
    throw e
  }
}
