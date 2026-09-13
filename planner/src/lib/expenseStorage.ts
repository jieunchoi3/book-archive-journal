import type { ExpenseStore, MoneyTransaction, WishlistItem } from '../types/expense'
import {
  emptyExpenseStore,
  ensureDualAxisCatalogs,
  normalizeExpenseTransactions,
} from '../types/expense'
import { ensureWishlistSeed } from './wishlistCategories'
import { fetchExpenseStoreCloud, upsertExpenseStoreCloud } from './expenseCloud'
import { isSupabaseConfigured } from './supabase'

const DB_NAME = 'planner-expenses'
const DB_VERSION = 2
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
  store: ExpenseStore
  updatedAt: string
}

async function loadExpenseStoreLocal(
  userId: string,
): Promise<{ store: ExpenseStore; updatedAt: string } | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(rowId(userId))
    req.onsuccess = () => {
      const row = req.result as StoredRow | undefined
      if (!row) {
        resolve(null)
        return
      }
      resolve({ store: row.store, updatedAt: row.updatedAt })
    }
    req.onerror = () => reject(req.error)
  })
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of secondary) map.set(item.id, item)
  for (const item of primary) map.set(item.id, item)
  return [...map.values()]
}

function wishlistItemRichness(item: WishlistItem): number {
  let score = 0
  if (item.name?.trim()) score += 2
  if (item.imageDataUrl?.trim()) score += 3
  const extraPhotos = (item as WishlistItem & { imageDataUrls?: string[] }).imageDataUrls
  if (extraPhotos?.length) score += 3
  if (item.brand?.trim()) score += 1
  if (item.store?.trim()) score += 1
  if (item.link?.trim()) score += 1
  if (item.note?.trim()) score += 1
  return score
}

function mergeWishlistItems(primary: WishlistItem[], secondary: WishlistItem[]): WishlistItem[] {
  const map = new Map<string, WishlistItem>()
  for (const item of secondary) map.set(item.id, item)
  for (const item of primary) {
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
      continue
    }
    map.set(
      item.id,
      wishlistItemRichness(item) >= wishlistItemRichness(existing) ? item : existing,
    )
  }
  return [...map.values()]
}

function mergeExpenseSnapshots(
  a: { store: ExpenseStore; updatedAt: string },
  b: { store: ExpenseStore; updatedAt: string },
): { store: ExpenseStore; updatedAt: string } {
  const newer = (a.updatedAt || '') >= (b.updatedAt || '') ? a : b
  const older = newer === a ? b : a

  const merged: ExpenseStore = {
    ...newer.store,
    transactions: mergeById<MoneyTransaction>(
      newer.store.transactions ?? [],
      older.store.transactions ?? [],
    ),
    wishlistItems: mergeWishlistItems(
      newer.store.wishlistItems ?? [],
      older.store.wishlistItems ?? [],
    ),
    wishlistCategories: mergeById(
      newer.store.wishlistCategories ?? [],
      older.store.wishlistCategories ?? [],
    ),
    categories: mergeById(newer.store.categories ?? [], older.store.categories ?? []),
    dayMarks: { ...(older.store.dayMarks ?? {}), ...(newer.store.dayMarks ?? {}) },
  }

  return {
    store: merged,
    updatedAt: (a.updatedAt || '') >= (b.updatedAt || '') ? a.updatedAt : b.updatedAt,
  }
}

async function saveExpenseStoreLocal(
  userId: string,
  store: ExpenseStore,
  updatedAt = new Date().toISOString(),
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

export async function loadExpenseStore(userId: string): Promise<ExpenseStore | null> {
  const local = await loadExpenseStoreLocal(userId)

  if (!isSupabaseConfigured) return local?.store ?? null

  try {
    const cloud = await fetchExpenseStoreCloud(userId)

    if (!cloud && local) {
      await upsertExpenseStoreCloud(userId, local.store)
      return local.store
    }

    if (cloud && !local) {
      await saveExpenseStoreLocal(userId, cloud.store, cloud.updatedAt)
      return cloud.store
    }

    if (cloud && local) {
      const merged = mergeExpenseSnapshots(cloud, local)
      const mergedAt = new Date().toISOString()
      await saveExpenseStoreLocal(userId, merged.store, mergedAt)
      await upsertExpenseStoreCloud(userId, merged.store)
      const cloudCount = cloud.store.wishlistItems?.length ?? 0
      const localCount = local.store.wishlistItems?.length ?? 0
      const mergedCount = merged.store.wishlistItems?.length ?? 0
      if (mergedCount > Math.max(cloudCount, localCount)) {
        console.info(
          `[expenses] recovered ${mergedCount - Math.max(cloudCount, localCount)} wishlist item(s) from sync merge`,
        )
      }
      return merged.store
    }

    return null
  } catch (e) {
    console.warn('[expenses] cloud load failed, using local', e)
    return local?.store ?? null
  }
}

export async function saveExpenseStore(userId: string, store: ExpenseStore): Promise<void> {
  const updatedAt = new Date().toISOString()
  await saveExpenseStoreLocal(userId, store, updatedAt)

  if (!isSupabaseConfigured) return

  try {
    await upsertExpenseStoreCloud(userId, store)
  } catch (e) {
    console.error('[expenses] cloud save failed', e)
    throw e
  }
}

function ensureWishlistInStore(store: ExpenseStore): ExpenseStore {
  return {
    ...store,
    wishlistCategories: ensureWishlistSeed(store.wishlistCategories),
    wishlistItems: store.wishlistItems ?? [],
  }
}

export function ensureExpenseStore(store: ExpenseStore | null): ExpenseStore {
  if (!store) return ensureWishlistInStore(emptyExpenseStore())
  const withMarks = {
    ...store,
    dayMarks: store.dayMarks ?? {},
    transactions: normalizeExpenseTransactions(store.transactions ?? []),
  }
  return ensureDualAxisCatalogs(ensureWishlistInStore(withMarks))
}
