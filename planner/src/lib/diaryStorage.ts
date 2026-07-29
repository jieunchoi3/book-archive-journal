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

  if (isDiaryEntryEmpty(entry)) {
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

function needsLayerHydration(entry: DiaryEntry): boolean {
  return entry.layers.some((l) => !l.src)
}

function pickNewer(a: DiaryEntry | null, b: DiaryEntry | null): DiaryEntry | null {
  if (!a) return b
  if (!b) return a
  return (a.updatedAt || '') >= (b.updatedAt || '') ? a : b
}

/** One-time push of local-only diary days up to Supabase. */
async function migrateLocalMonthToCloud(
  userId: string,
  local: Record<string, DiaryEntry>,
  cloud: Record<string, DiaryEntry>,
): Promise<void> {
  for (const [dateKey, entry] of Object.entries(local)) {
    if (isDiaryEntryEmpty(entry)) continue
    if (cloud[dateKey]) continue
    if (needsLayerHydration(entry)) continue
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
    const best = pickNewer(local, cloud)
    if (best && best !== local) {
      await saveDiaryEntryLocal(userId, best)
    } else if (local && !cloud && !needsLayerHydration(local) && !isDiaryEntryEmpty(local)) {
      await upsertDiaryEntryCloud(userId, local)
    }
    return best
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
    await migrateLocalMonthToCloud(userId, local, cloud)

    const merged: Record<string, DiaryEntry> = { ...cloud }
    for (const [dateKey, entry] of Object.entries(local)) {
      const remote = merged[dateKey]
      if (!remote) {
        merged[dateKey] = entry
        continue
      }
      // Prefer local when it has hydrated layer bytes and is newer or equal.
      const localHydrated = !needsLayerHydration(entry)
      const remoteHydrated = !needsLayerHydration(remote)
      if (localHydrated && (!remoteHydrated || (entry.updatedAt || '') >= (remote.updatedAt || ''))) {
        merged[dateKey] = entry
      } else if (!remote.coverDataUrl && entry.coverDataUrl) {
        merged[dateKey] = { ...remote, coverDataUrl: entry.coverDataUrl }
      }
    }

    // Cache covers / metadata locally for offline month browsing.
    for (const entry of Object.values(merged)) {
      if (!isDiaryEntryEmpty(entry) || entry.coverDataUrl) {
        await saveDiaryEntryLocal(userId, entry)
      }
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
    if (existing && !needsLayerHydration(existing)) {
      entry = {
        ...entry,
        layers: existing.layers,
        coverDataUrl: entry.coverDataUrl ?? existing.coverDataUrl,
      }
    }
  }

  await saveDiaryEntryLocal(userId, entry)

  if (!isSupabaseConfigured) return

  try {
    if (isDiaryEntryEmpty(entry)) {
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
  if (!needsLayerHydration(entry)) return entry
  if (!isSupabaseConfigured) return entry
  const cloud = await fetchDiaryEntryCloud(userId, entry.dateKey)
  if (!cloud) return entry
  await saveDiaryEntryLocal(userId, cloud)
  return cloud
}
