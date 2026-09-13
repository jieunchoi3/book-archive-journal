import type { ExpenseStore, MoneyTransaction, WishlistItem } from '../types/expense'
import {
  emptyExpenseStore,
  ensureDualAxisCatalogs,
  normalizeExpenseTransactions,
} from '../types/expense'
import { ensureWishlistSeed } from './wishlistCategories'
import {
  loadWishlistMetadataBackup,
  normalizeWishlistItems,
  restoreWishlistFromBackup,
  saveWishlistBackup,
  saveWishlistMetadataBackup,
  stripWishlistPhotos,
} from './wishlistBackup'
import { fetchExpenseStoreCloud, upsertExpenseStoreCloud } from './expenseCloud'
import { isSupabaseConfigured } from './supabase'

const DB_NAME = 'planner-expenses'
const DB_VERSION = 2
const STORE = 'store'

export type SaveExpenseStoreOptions = {
  /** Allow writing fewer wishlist items than cloud/backup (explicit deletes only). */
  allowWishlistShrink?: boolean
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
  if (item.size?.trim()) score += 1
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

function unionWishlistSources(...sources: WishlistItem[][]): WishlistItem[] {
  let merged: WishlistItem[] = []
  for (const source of sources) {
    merged = mergeWishlistItems(merged, normalizeWishlistItems(source))
  }
  return merged
}

function applyWishlistBackupRecovery(store: ExpenseStore, userId: string): ExpenseStore {
  const current = normalizeWishlistItems(store.wishlistItems)
  const backup = restoreWishlistFromBackup(userId)
  const meta = loadWishlistMetadataBackup(userId)
  const merged = unionWishlistSources(current, backup, meta)

  if (merged.length > current.length) {
    console.info(
      `[expenses] restored ${merged.length - current.length} wishlist item(s) from local backup`,
    )
  }

  if (merged.length > 0) {
    saveWishlistBackup(userId, merged)
    saveWishlistMetadataBackup(userId, merged)
  }

  return { ...store, wishlistItems: merged }
}

/** Photos can make the cloud JSON huge — sync metadata to Supabase, keep photos local. */
function storeForCloudSync(store: ExpenseStore): ExpenseStore {
  return {
    ...store,
    wishlistItems: normalizeWishlistItems(store.wishlistItems).map(stripWishlistPhotos),
  }
}

export async function loadExpenseStore(userId: string): Promise<ExpenseStore | null> {
  const local = await loadExpenseStoreLocal(userId)
  let bestStore: ExpenseStore | null = null

  try {
    if (!isSupabaseConfigured) {
      bestStore = local?.store ?? null
    } else {
      const cloud = await fetchExpenseStoreCloud(userId)

      if (!cloud && local) {
        bestStore = local.store
      } else if (cloud && !local) {
        bestStore = cloud.store
      } else if (cloud && local) {
        bestStore = mergeExpenseSnapshots(cloud, local).store
      } else {
        bestStore = null
      }
    }

    if (!bestStore) {
      const backupOnly = restoreWishlistFromBackup(userId)
      if (backupOnly.length > 0) {
        console.info(`[expenses] loaded ${backupOnly.length} wishlist item(s) from backup only`)
        return { ...emptyExpenseStore(), wishlistItems: backupOnly }
      }
      return null
    }

    const recovered = applyWishlistBackupRecovery(bestStore, userId)

    // Persist merged result locally only — never push to cloud during load (avoids wipe races).
    const localCount = local?.store.wishlistItems?.length ?? 0
    const recoveredCount = recovered.wishlistItems?.length ?? 0
    if (recoveredCount > localCount || recoveredCount > (bestStore.wishlistItems?.length ?? 0)) {
      await saveExpenseStoreLocal(userId, recovered, new Date().toISOString())
    }

    return recovered
  } catch (e) {
    console.warn('[expenses] cloud load failed, using local + backup', e)
    if (local?.store) {
      return applyWishlistBackupRecovery(local.store, userId)
    }
    const backupOnly = restoreWishlistFromBackup(userId)
    if (backupOnly.length > 0) {
      return { ...emptyExpenseStore(), wishlistItems: backupOnly }
    }
    return null
  }
}

export async function saveExpenseStore(
  userId: string,
  store: ExpenseStore,
  options: SaveExpenseStoreOptions = {},
): Promise<void> {
  const { allowWishlistShrink = false } = options

  let outgoing = normalizeWishlistItems(store.wishlistItems)
  const backup = restoreWishlistFromBackup(userId)
  const meta = loadWishlistMetadataBackup(userId)

  if (isSupabaseConfigured) {
    try {
      const cloud = await fetchExpenseStoreCloud(userId)
      const cloudItems = normalizeWishlistItems(cloud?.store.wishlistItems)
      outgoing = unionWishlistSources(outgoing, cloudItems, backup, meta)

      if (!allowWishlistShrink) {
        const floor = Math.max(cloudItems.length, backup.length, meta.length)
        if (outgoing.length < floor && floor > 0) {
          console.warn(
            `[expenses] blocked wishlist shrink (${outgoing.length} < ${floor}); merging backups`,
          )
          outgoing = unionWishlistSources(outgoing, cloudItems, backup, meta)
        }
      }
    } catch (e) {
      console.warn('[expenses] cloud pre-save merge failed; merging local backups', e)
      outgoing = unionWishlistSources(outgoing, backup, meta)
    }
  } else {
    outgoing = unionWishlistSources(outgoing, backup, meta)
  }

  const toSave: ExpenseStore = { ...store, wishlistItems: outgoing }

  if (outgoing.length > 0) {
    saveWishlistBackup(userId, toSave.wishlistItems!)
    saveWishlistMetadataBackup(userId, toSave.wishlistItems!)
  }

  const updatedAt = new Date().toISOString()
  await saveExpenseStoreLocal(userId, toSave, updatedAt)

  if (!isSupabaseConfigured) return

  try {
    await upsertExpenseStoreCloud(userId, storeForCloudSync(toSave))
  } catch (e) {
    console.error('[expenses] cloud save failed (local copy preserved)', e)
  }
}

function ensureWishlistInStore(store: ExpenseStore, userId?: string): ExpenseStore {
  let items = normalizeWishlistItems(store.wishlistItems)
  if (items.length === 0 && userId) {
    const backup = unionWishlistSources(
      restoreWishlistFromBackup(userId),
      loadWishlistMetadataBackup(userId),
    )
    if (backup.length > 0) {
      console.info(`[expenses] restored ${backup.length} wishlist item(s) from local backup`)
      items = backup
    }
  }
  return {
    ...store,
    wishlistCategories: ensureWishlistSeed(store.wishlistCategories),
    wishlistItems: items,
  }
}

export function ensureExpenseStore(store: ExpenseStore | null, userId?: string): ExpenseStore {
  if (!store) return ensureWishlistInStore(emptyExpenseStore(), userId)
  const withMarks = {
    ...store,
    dayMarks: store.dayMarks ?? {},
    transactions: normalizeExpenseTransactions(store.transactions ?? []),
  }
  return ensureDualAxisCatalogs(ensureWishlistInStore(withMarks, userId))
}
