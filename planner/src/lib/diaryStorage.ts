import type { DiaryEntry } from '../types/diary'
import { ensureDiaryEntryId, isDiaryEntryEmpty } from '../types/diary'
import { downscaleToThumb } from './diaryImage'
import {
  applyTagFoldersToEntry,
  getEntryTagFolders,
  removeTagFolderFromEntry,
} from './diaryTags'
import {
  deleteDiaryEntryCloud,
  fetchDiaryEntriesForMonthCloud,
  fetchDiaryEntryCloud,
  upsertDiaryEntryCloud,
} from './diaryCloud'
import { isSupabaseConfigured, supabase } from './supabase'

const DB_NAME = 'planner-diary'
const DB_VERSION = 2
const STORE = 'entries'
const THUMB_BUCKET = 'diary-media'

function dbKey(userId: string, entryId: string) {
  return `${userId}:${entryId}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      const oldVersion = event.oldVersion
      if (oldVersion > 0 && oldVersion < 2) {
        const tx = req.transaction!
        const store = tx.objectStore(STORE)
        const getAll = store.getAll()
        getAll.onsuccess = () => {
          const rows = (getAll.result ?? []) as StoredRow[]
          for (const row of rows) {
            const entry = ensureDiaryEntryId(row.entry)
            const newId = dbKey(row.userId, entry.id)
            if (row.id !== newId) {
              store.delete(row.id)
            }
            store.put({
              id: newId,
              userId: row.userId,
              dateKey: row.dateKey,
              entry,
            })
          }
        }
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

function isDataImageUrl(url: string | null | undefined): url is string {
  return Boolean(url?.startsWith('data:'))
}

/** Signed HTTP URLs expire — only persist stable data URLs in IndexedDB. */
function entryForLocalCache(entry: DiaryEntry): DiaryEntry {
  const normalized = ensureDiaryEntryId(entry)
  return {
    ...normalized,
    coverDataUrl: isDataImageUrl(normalized.coverDataUrl) ? normalized.coverDataUrl : null,
    thumbDataUrl: isDataImageUrl(normalized.thumbDataUrl) ? normalized.thumbDataUrl : null,
    layers: normalized.layers.map((layer) => ({
      ...layer,
      src: isDataImageUrl(layer.src) ? layer.src : layer.src ? '' : layer.src,
    })),
    bodyImages: (normalized.bodyImages ?? []).map((image) => ({
      ...image,
      src: isDataImageUrl(image.src) ? image.src : image.src ? '' : image.src,
    })),
  }
}

export function groupDiaryEntriesByDate(
  entries: DiaryEntry[],
): Record<string, DiaryEntry[]> {
  const out: Record<string, DiaryEntry[]> = {}
  for (const raw of entries) {
    const entry = ensureDiaryEntryId(raw)
    const list = out[entry.dateKey] ?? []
    if (!list.some((e) => e.id === entry.id)) list.push(entry)
    out[entry.dateKey] = list
  }
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
  }
  return out
}

function mergeEntryLists(
  cloud: Record<string, DiaryEntry[]>,
  local: Record<string, DiaryEntry[]>,
): Record<string, DiaryEntry[]> {
  const out: Record<string, DiaryEntry[]> = {}
  const allDates = new Set([...Object.keys(cloud), ...Object.keys(local)])
  for (const dateKey of allDates) {
    const byId = new Map<string, DiaryEntry>()
    for (const entry of cloud[dateKey] ?? []) {
      byId.set(entry.id, ensureDiaryEntryId(entry))
    }
    for (const entry of local[dateKey] ?? []) {
      const normalized = ensureDiaryEntryId(entry)
      if (!byId.has(normalized.id)) byId.set(normalized.id, normalized)
    }
    const list = [...byId.values()].sort(
      (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
    )
    if (list.length) out[dateKey] = list
  }
  return out
}

async function loadDiaryEntryLocalById(
  userId: string,
  entryId: string,
): Promise<DiaryEntry | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(dbKey(userId, entryId))
    req.onsuccess = () => {
      const row = req.result as StoredRow | undefined
      resolve(row?.entry ? entryForLocalCache(row.entry) : null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function loadDiaryEntriesForMonthLocal(
  userId: string,
  year: number,
  month: number,
): Promise<Record<string, DiaryEntry[]>> {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const all = await loadAllDiaryEntriesLocal(userId)
  const out: Record<string, DiaryEntry[]> = {}
  for (const entry of all) {
    if (!entry.dateKey.startsWith(prefix)) continue
    const list = out[entry.dateKey] ?? []
    list.push(entry)
    out[entry.dateKey] = list
  }
  return out
}

/** All locally cached diary entries for a user (for cross-month search). */
export async function loadAllDiaryEntriesLocal(userId: string): Promise<DiaryEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor()
    const out: DiaryEntry[] = []
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve(out)
        return
      }
      const row = cursor.value as StoredRow
      if (row.userId === userId) {
        out.push(entryForLocalCache(row.entry))
      }
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

async function deleteDiaryEntryLocal(userId: string, entryId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(dbKey(userId, entryId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function saveDiaryEntryLocal(userId: string, entry: DiaryEntry): Promise<void> {
  const normalized = ensureDiaryEntryId(entry)
  const db = await openDb()
  const id = dbKey(userId, normalized.id)

  if (isDiaryEntryEmpty(normalized) && !(normalized.layers?.length > 0)) {
    return deleteDiaryEntryLocal(userId, normalized.id)
  }

  const row: StoredRow = {
    id,
    userId,
    dateKey: normalized.dateKey,
    entry: entryForLocalCache({
      ...normalized,
      updatedAt: normalized.updatedAt || new Date().toISOString(),
    }),
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
    entry.layers.some((l) => l.src.startsWith('data:')) ||
    (entry.bodyImages ?? []).some((i) => i.src.startsWith('data:'))
  )
}

function needsLayerHydration(entry: DiaryEntry): boolean {
  return entry.layers.some((l) => !l.src)
}

function needsBodyImageHydration(entry: DiaryEntry): boolean {
  return (entry.bodyImages ?? []).some((i) => !i.src)
}

function needsDiaryHydration(entry: DiaryEntry): boolean {
  return needsLayerHydration(entry) || needsBodyImageHydration(entry)
}

function preferLocalImages(cloud: DiaryEntry, local?: DiaryEntry): DiaryEntry {
  if (!local) return cloud
  const keepLocalCover = Boolean(local.coverDataUrl?.startsWith('data:'))
  const keepLocalThumb = Boolean(local.thumbDataUrl?.startsWith('data:'))
  const keepLocalLayers = hasRealImageBytes(local) && needsLayerHydration(cloud)
  const keepLocalBodyImages =
    (local.bodyImages ?? []).some((i) => i.src.startsWith('data:')) &&
    needsBodyImageHydration(cloud)

  return {
    ...cloud,
    layers: keepLocalLayers ? local.layers : cloud.layers,
    bodyImages: keepLocalBodyImages ? (local.bodyImages ?? []) : (cloud.bodyImages ?? []),
    coverDataUrl: keepLocalCover ? local.coverDataUrl : cloud.coverDataUrl ?? null,
    thumbDataUrl: keepLocalThumb
      ? local.thumbDataUrl
      : cloud.thumbDataUrl ?? cloud.coverDataUrl ?? null,
  }
}

function cloudEntryIds(cloud: Record<string, DiaryEntry[]>): Set<string> {
  const ids = new Set<string>()
  for (const list of Object.values(cloud)) {
    for (const entry of list) ids.add(entry.id)
  }
  return ids
}

/** One-time push of local-only diary notes up to Supabase. */
async function migrateLocalMonthToCloud(
  userId: string,
  local: Record<string, DiaryEntry[]>,
  cloud: Record<string, DiaryEntry[]>,
): Promise<void> {
  const cloudIds = cloudEntryIds(cloud)
  for (const list of Object.values(local)) {
    for (const entry of list) {
      if (cloudIds.has(entry.id)) continue
      if (!hasRealImageBytes(entry) && isDiaryEntryEmpty(entry)) continue
      if (needsLayerHydration(entry) && entry.layers.length > 0) continue
      if (
        (entry.bodyImages ?? []).some((i) => i.src.startsWith('data:')) &&
        needsBodyImageHydration(entry)
      ) {
        continue
      }
      if (!hasRealImageBytes(entry) && !entry.title && !entry.body) continue
      try {
        await upsertDiaryEntryCloud(userId, ensureDiaryEntryId(entry))
      } catch (e) {
        console.warn('[diary] migrate local→cloud failed', entry.dateKey, e)
      }
    }
  }
}

export async function loadDiaryEntryById(
  userId: string,
  entryId: string,
): Promise<DiaryEntry | null> {
  const local = await loadDiaryEntryLocalById(userId, entryId)

  if (!isSupabaseConfigured) return local

  try {
    const cloud = await fetchDiaryEntryCloud(userId, entryId)
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
): Promise<Record<string, DiaryEntry[]>> {
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

    const merged = mergeEntryLists(cloud, local)

    for (const [dateKey, list] of Object.entries(merged)) {
      const localList = local[dateKey] ?? []
      const localById = new Map(localList.map((e) => [e.id, e]))
      const nextList = list.map((entry) =>
        preferLocalImages(entry, localById.get(entry.id)),
      )
      merged[dateKey] = nextList
      for (const entry of nextList) {
        await saveDiaryEntryLocal(userId, entry)
      }
    }

    return merged
  } catch (e) {
    console.warn('[diary] cloud month load failed, using local', e)
    return local
  }
}

async function uploadThumbOnly(userId: string, entryId: string, thumbDataUrl: string) {
  const path = `${userId}/${entryId}/thumb.jpg`
  const res = await fetch(thumbDataUrl)
  const blob = await res.blob()
  const { error } = await supabase.storage.from(THUMB_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '86400',
  })
  if (error) console.warn('[diary] thumb upload failed', entryId, error.message)
}

/**
 * For days that only have a remote/full cover, build a small local thumb
 * (and upload thumb.jpg) so the next visit paints instantly.
 */
export async function backfillDiaryThumbs(
  userId: string,
  entriesByDate: Record<string, DiaryEntry[]>,
  onEntry?: (entry: DiaryEntry) => void,
): Promise<void> {
  const jobs = Object.values(entriesByDate)
    .flat()
    .filter((entry) => {
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
          void uploadThumbOnly(userId, entry.id, thumb)
        }
        onEntry?.(next)
      } catch (e) {
        console.warn('[diary] thumb backfill failed', entry.dateKey, e)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()))
}

export async function saveDiaryEntry(userId: string, entry: DiaryEntry): Promise<void> {
  const normalized = ensureDiaryEntryId(entry)
  let toSave = normalized

  if (
    needsDiaryHydration(normalized) &&
    (normalized.layers.length > 0 || (normalized.bodyImages?.length ?? 0) > 0)
  ) {
    const existing = await loadDiaryEntryLocalById(userId, normalized.id)
    if (existing && hasRealImageBytes(existing)) {
      toSave = {
        ...normalized,
        layers: needsLayerHydration(normalized) ? existing.layers : normalized.layers,
        bodyImages: needsBodyImageHydration(normalized)
          ? (existing.bodyImages ?? [])
          : (normalized.bodyImages ?? []),
        coverDataUrl: isDataImageUrl(normalized.coverDataUrl)
          ? normalized.coverDataUrl
          : isDataImageUrl(existing.coverDataUrl)
            ? existing.coverDataUrl
            : null,
        thumbDataUrl: isDataImageUrl(normalized.thumbDataUrl)
          ? normalized.thumbDataUrl
          : isDataImageUrl(existing.thumbDataUrl)
            ? existing.thumbDataUrl
            : null,
      }
    }
  }

  await saveDiaryEntryLocal(userId, toSave)

  if (!isSupabaseConfigured) return

  try {
    if (isDiaryEntryEmpty(toSave) && toSave.layers.length === 0) {
      await deleteDiaryEntryCloud(userId, toSave.id)
    } else {
      await upsertDiaryEntryCloud(userId, toSave)
    }
  } catch (e) {
    console.error('[diary] cloud save failed', e)
    throw e
  }
}

export async function deleteDiaryEntry(userId: string, entry: DiaryEntry): Promise<void> {
  await deleteDiaryEntryLocal(userId, entry.id)
  if (isSupabaseConfigured) {
    await deleteDiaryEntryCloud(userId, entry.id)
  }
}

/** Remove hashtag tags from folder entries in cloud + local cache. */
export async function clearDiaryTagsForFolder(
  userId: string,
  mainTag: string,
  subTag?: string,
): Promise<number> {
  let updated = 0

  const all = await loadAllDiaryEntriesLocal(userId)
  for (const entry of all) {
    const remaining = removeTagFolderFromEntry(entry, mainTag, subTag)
    if (remaining.length === getEntryTagFolders(entry).length) continue
    const tagPatch = applyTagFoldersToEntry(remaining)
    const next: DiaryEntry = {
      ...entry,
      ...tagPatch,
      updatedAt: new Date().toISOString(),
    }
    await saveDiaryEntryLocal(userId, next)
    if (isSupabaseConfigured) {
      try {
        await upsertDiaryEntryCloud(userId, next)
      } catch (e) {
        console.error('[diary] clear tags cloud failed', e)
        throw e
      }
    }
    updated += 1
  }

  return updated
}

/** Ensure layer image bytes are present (downloads from Storage when needed). */
export async function hydrateDiaryEntry(
  userId: string,
  entry: DiaryEntry,
): Promise<DiaryEntry> {
  const normalized = ensureDiaryEntryId(entry)
  if (!needsDiaryHydration(normalized) && normalized.coverDataUrl?.startsWith('data:')) {
    return normalized
  }
  if (!isSupabaseConfigured) return normalized
  const cloud = await fetchDiaryEntryCloud(userId, normalized.id)
  if (!cloud) return normalized
  const merged = preferLocalImages(cloud, normalized)
  await saveDiaryEntryLocal(userId, merged)
  return merged
}
