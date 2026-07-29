import type { DiaryEntry } from '../types/diary'
import { isDiaryEntryEmpty } from '../types/diary'
import {
  deleteDiaryEntryCloud,
  fetchDiaryEntriesForMonthCloud,
  fetchDiaryEntryCloud,
  upsertDiaryEntryCloud,
} from './diaryCloud'
import { isSupabaseConfigured } from './supabase'

const DB_NAME = 'planner-diary'
const DB_VERSION = 1
const STORE = 'entries'

function dbKey(userId: string, dateKey: string) {
  return `${userId}:${dateKey}`
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
  dateKey: string
  entry: DiaryEntry
}

async function loadDiaryEntryLocal(
  userId: string,
  dateKey: string,
): Promise<DiaryEntry | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(dbKey(userId, dateKey))
    req.onsuccess = () => {
      const row = req.result as StoredRow | undefined
      resolve(row?.entry ?? null)
    }
    req.onerror = () => reject(req.error)
  })
}

async function loadDiaryEntriesForMonthLocal(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, DiaryEntry>> {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor()
    const out: Record<string, DiaryEntry> = {}
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve(out)
        return
      }
      const row = cursor.value as StoredRow
      if (row.userId === userId && row.dateKey.startsWith(prefix)) {
        out[row.dateKey] = row.entry
      }
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

async function saveDiaryEntryLocal(userId: string, entry: DiaryEntry): Promise<void> {
  const db = await openDb()
  const id = dbKey(userId, entry.dateKey)

  if (isDiaryEntryEmpty(entry) && !(entry.layers?.length > 0)) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  const row: StoredRow = {
    id,
    userId,
    dateKey: entry.dateKey,
    entry: { ...entry, updatedAt: entry.updatedAt || new Date().toISOString() },
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function hasRealImageBytes(entry: DiaryEntry): boolean {
  return (
    Boolean(entry.coverDataUrl?.startsWith('data:')) ||
    entry.layers.some((l) => l.src.startsWith('data:'))
  )
}

function needsLayerHydration(entry: DiaryEntry): boolean {
  return entry.layers.some((l) => !l.src)
}

/** One-time push of local-only diary days up to Supabase. */
async function migrateLocalMonthToCloud(
  userId: string,
  local: Record<string, DiaryEntry>,
  cloud: Record<string, DiaryEntry>,
): Promise<void> {
  for (const [dateKey, entry] of Object.entries(local)) {
    if (cloud[dateKey]) continue
    if (!hasRealImageBytes(entry) && isDiaryEntryEmpty(entry)) continue
    if (needsLayerHydration(entry) && entry.layers.length > 0) continue
    if (!hasRealImageBytes(entry) && !entry.title && !entry.body) continue
    try {
      await upsertDiaryEntryCloud(userId, entry)
    } catch (e) {
      console.warn('[diary] migrate local→cloud failed', dateKey, e)
    }
  }
}

export async function loadDiaryEntry(
  userId: string,
  dateKey: string,
): Promise<DiaryEntry | null> {
  const local = await loadDiaryEntryLocal(userId, dateKey)

  if (!isSupabaseConfigured) return local

  try {
    const cloud = await fetchDiaryEntryCloud(userId, dateKey)
    if (cloud) {
      await saveDiaryEntryLocal(userId, cloud)
      return cloud
    }
    if (local && hasRealImageBytes(local) && !isDiaryEntryEmpty(local)) {
      await upsertDiaryEntryCloud(userId, local)
    }
    return local
  } catch (e) {
    console.warn('[diary] cloud load failed, using local', e)
    return local
  }
}

export async function loadDiaryEntriesForMonth(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, DiaryEntry>> {
  const local = await loadDiaryEntriesForMonthLocal(userId, year, month)

  if (!isSupabaseConfigured) return local

  try {
    const cloud = await fetchDiaryEntriesForMonthCloud(userId, year, month)
    console.info('[diary] cloud month loaded', {
      year,
      month: month + 1,
      cloudDays: Object.keys(cloud),
      localDays: Object.keys(local),
    })
    await migrateLocalMonthToCloud(userId, local, cloud)

    // Online: cloud is source of truth. Only keep local-only days not yet uploaded.
    const merged: Record<string, DiaryEntry> = { ...cloud }
    for (const [dateKey, entry] of Object.entries(local)) {
      if (merged[dateKey]) continue
      if (hasRealImageBytes(entry) || entry.title || entry.body) {
        merged[dateKey] = entry
      }
    }

    // Cache metadata locally; keep prior local image bytes when cloud only has signed covers.
    for (const [dateKey, entry] of Object.entries(merged)) {
      const prev = local[dateKey]
      const toStore =
        prev && hasRealImageBytes(prev) && needsLayerHydration(entry)
          ? {
              ...entry,
              layers: prev.layers,
              coverDataUrl: entry.coverDataUrl ?? prev.coverDataUrl,
            }
          : entry
      await saveDiaryEntryLocal(userId, toStore)
      merged[dateKey] = toStore
    }

    return merged
  } catch (e) {
    console.warn('[diary] cloud month load failed, using local', e)
    return local
  }
}

export async function saveDiaryEntry(userId: string, entry: DiaryEntry): Promise<void> {
  // Avoid overwriting good local photos with empty-src placeholders.
  if (needsLayerHydration(entry) && entry.layers.length > 0) {
    const existing = await loadDiaryEntryLocal(userId, entry.dateKey)
    if (existing && hasRealImageBytes(existing)) {
      entry = {
        ...entry,
        layers: existing.layers,
        coverDataUrl: entry.coverDataUrl?.startsWith('data:')
          ? entry.coverDataUrl
          : existing.coverDataUrl,
      }
    }
  }

  await saveDiaryEntryLocal(userId, entry)

  if (!isSupabaseConfigured) return

  try {
    if (isDiaryEntryEmpty(entry) && entry.layers.length === 0) {
      await deleteDiaryEntryCloud(userId, entry.dateKey)
    } else {
      await upsertDiaryEntryCloud(userId, entry)
    }
  } catch (e) {
    console.error('[diary] cloud save failed', e)
    throw e
  }
}

/** Ensure layer image bytes are present (downloads from Storage when needed). */
export async function hydrateDiaryEntry(
  userId: string,
  entry: DiaryEntry,
): Promise<DiaryEntry> {
  if (!needsLayerHydration(entry) && entry.coverDataUrl?.startsWith('data:')) {
    return entry
  }
  if (!isSupabaseConfigured) return entry
  const cloud = await fetchDiaryEntryCloud(userId, entry.dateKey)
  if (!cloud) return entry
  await saveDiaryEntryLocal(userId, cloud)
  return cloud
}
