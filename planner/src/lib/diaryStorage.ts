import type { DiaryEntry } from '../types/diary'
import { isDiaryEntryEmpty } from '../types/diary'
import { downscaleToThumb } from './diaryImage'
import {
  deleteDiaryEntryCloud,
  fetchDiaryEntriesForMonthCloud,
  fetchDiaryEntryCloud,
  upsertDiaryEntryCloud,
} from './diaryCloud'
import { isSupabaseConfigured, supabase } from './supabase'

const DB_NAME = 'planner-diary'
const DB_VERSION = 1
const STORE = 'entries'
const THUMB_BUCKET = 'diary-media'

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

export async function loadDiaryEntriesForMonthLocal(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, DiaryEntry>> {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const all = await loadAllDiaryEntriesLocal(userId)
  const out: Record<string, DiaryEntry> = {}
  for (const [dateKey, entry] of Object.entries(all)) {
    if (dateKey.startsWith(prefix)) out[dateKey] = entry
  }
  return out
}

/** All locally cached diary entries for a user (for cross-month search). */
export async function loadAllDiaryEntriesLocal(
  userId: string,
): Promise<Record<string, DiaryEntry>> {
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
      if (row.userId === userId) {
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
    Boolean(entry.thumbDataUrl?.startsWith('data:')) ||
    Boolean(entry.coverDataUrl?.startsWith('data:')) ||
    entry.layers.some((l) => l.src.startsWith('data:'))
  )
}

function needsLayerHydration(entry: DiaryEntry): boolean {
  return entry.layers.some((l) => !l.src)
}

function preferLocalImages(cloud: DiaryEntry, local?: DiaryEntry): DiaryEntry {
  if (!local) return cloud
  const keepLocalCover = Boolean(local.coverDataUrl?.startsWith('data:'))
  const keepLocalThumb = Boolean(local.thumbDataUrl?.startsWith('data:'))
  const keepLocalLayers = hasRealImageBytes(local) && needsLayerHydration(cloud)

  return {
    ...cloud,
    layers: keepLocalLayers ? local.layers : cloud.layers,
    coverDataUrl: keepLocalCover
      ? local.coverDataUrl
      : (cloud.coverDataUrl ?? local.coverDataUrl ?? null),
    thumbDataUrl: keepLocalThumb
      ? local.thumbDataUrl
      : (cloud.thumbDataUrl ?? local.thumbDataUrl ?? null),
  }
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
      const merged = preferLocalImages(cloud, local ?? undefined)
      await saveDiaryEntryLocal(userId, merged)
      return merged
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

    // Cache metadata locally; keep prior local image bytes when cloud only has signed URLs.
    for (const [dateKey, entry] of Object.entries(merged)) {
      const toStore = preferLocalImages(entry, local[dateKey])
      await saveDiaryEntryLocal(userId, toStore)
      merged[dateKey] = toStore
    }

    return merged
  } catch (e) {
    console.warn('[diary] cloud month load failed, using local', e)
    return local
  }
}

async function uploadThumbOnly(userId: string, dateKey: string, thumbDataUrl: string) {
  const path = `${userId}/${dateKey}/thumb.jpg`
  const res = await fetch(thumbDataUrl)
  const blob = await res.blob()
  const { error } = await supabase.storage.from(THUMB_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '86400',
  })
  if (error) console.warn('[diary] thumb upload failed', dateKey, error.message)
}

/**
 * For days that only have a remote/full cover, build a small local thumb
 * (and upload thumb.jpg) so the next visit paints instantly.
 */
export async function backfillDiaryThumbs(
  userId: string,
  entries: Record<string, DiaryEntry>,
  onEntry?: (dateKey: string, entry: DiaryEntry) => void,
): Promise<void> {
  const jobs = Object.values(entries).filter((entry) => {
    if (entry.thumbDataUrl?.startsWith('data:')) return false
    return Boolean(entry.thumbDataUrl || entry.coverDataUrl)
  })

  const concurrency = 3
  let i = 0
  async function worker() {
    while (i < jobs.length) {
      const entry = jobs[i++]
      const src = entry.thumbDataUrl || entry.coverDataUrl
      if (!src) continue
      try {
        const thumb = await downscaleToThumb(src)
        if (!thumb) continue
        const next: DiaryEntry = { ...entry, thumbDataUrl: thumb }
        await saveDiaryEntryLocal(userId, next)
        if (isSupabaseConfigured) {
          void uploadThumbOnly(userId, entry.dateKey, thumb)
        }
        onEntry?.(entry.dateKey, next)
      } catch (e) {
        console.warn('[diary] thumb backfill failed', entry.dateKey, e)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()))
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
        thumbDataUrl: entry.thumbDataUrl?.startsWith('data:')
          ? entry.thumbDataUrl
          : (existing.thumbDataUrl ?? entry.thumbDataUrl),
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
  if (
    !needsLayerHydration(entry) &&
    entry.coverDataUrl?.startsWith('data:')
  ) {
    return entry
  }
  if (!isSupabaseConfigured) return entry
  const cloud = await fetchDiaryEntryCloud(userId, entry.dateKey)
  if (!cloud) return entry
  const merged = preferLocalImages(cloud, entry)
  await saveDiaryEntryLocal(userId, merged)
  return merged
}
