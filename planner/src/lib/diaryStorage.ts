import type { DiaryEntry } from '../types/diary'
import { isDiaryEntryEmpty } from '../types/diary'

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

export async function loadDiaryEntry(
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

export async function loadDiaryEntriesForMonth(
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

export async function saveDiaryEntry(userId: string, entry: DiaryEntry): Promise<void> {
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
    entry: { ...entry, updatedAt: new Date().toISOString() },
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
