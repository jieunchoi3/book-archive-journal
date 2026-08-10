import type { ExpenseStore } from '../types/expense'
import { emptyExpenseStore } from '../types/expense'
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
      const preferCloud = (cloud.updatedAt || '') >= (local.updatedAt || '')
      const best = preferCloud ? cloud : local
      if (preferCloud) {
        await saveExpenseStoreLocal(userId, cloud.store, cloud.updatedAt)
      } else {
        await upsertExpenseStoreCloud(userId, local.store)
      }
      return best.store
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

export function ensureExpenseStore(store: ExpenseStore | null): ExpenseStore {
  if (!store) return emptyExpenseStore()
  return {
    ...store,
    dayMarks: store.dayMarks ?? {},
  }
}
