import type { SnapBooking } from '../types/snap'
import { buildSnapSeedBookings, seedContentKey } from '../data/snapSeed'
import {
  deleteSnapBookingCloud,
  fetchSnapBookingsCloud,
  replaceAllSnapBookingsCloud,
  upsertSnapBookingsCloud,
} from './snapCloud'
import { isSupabaseConfigured } from './supabase'

const DB_NAME = 'planner-snap'
const DB_VERSION = 1
const STORE = 'bookings'
const META_STORE = 'meta'

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
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

interface StoredMeta {
  id: string
  userId: string
  seeded: boolean
  updatedAt: string
}

async function saveMeta(meta: StoredMeta): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite')
    tx.objectStore(META_STORE).put(meta)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadBookingsLocal(userId: string): Promise<{
  bookings: SnapBooking[]
  updatedAt: string
} | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const allReq = tx.objectStore(STORE).getAll()
    allReq.onsuccess = () => {
      const rows = (allReq.result as Array<{ userId: string; booking: SnapBooking }>) ?? []
      const bookings = rows
        .filter((r) => r.userId === userId)
        .map((r) => ({
          ...r.booking,
          source: r.booking.source ?? 'manual',
        }))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      if (!bookings.length) {
        resolve(null)
        return
      }
      const updatedAt = bookings.reduce(
        (max, b) => (b.createdAt > max ? b.createdAt : max),
        bookings[0]?.createdAt ?? '',
      )
      resolve({ bookings, updatedAt })
    }
    allReq.onerror = () => reject(allReq.error)
  })
}

async function saveBookingsLocal(
  userId: string,
  bookings: SnapBooking[],
  updatedAt = new Date().toISOString(),
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const clearReq = store.getAll()
    clearReq.onsuccess = () => {
      const existing = (clearReq.result as Array<{ id: string; userId: string }>) ?? []
      for (const row of existing) {
        if (row.userId === userId) store.delete(row.id)
      }
      for (const booking of bookings) {
        store.put({ id: booking.id, userId, booking })
      }
    }
    tx.oncomplete = () => {
      void saveMeta({ id: rowId(userId), userId, seeded: true, updatedAt })
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

function sortBookings(bookings: SnapBooking[]): SnapBooking[] {
  return [...bookings].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}

/** Upsert Notion import rows by deterministic id; never wipe user-created rows. */
async function ensureNotionImportSeed(
  userId: string,
  existing: SnapBooking[],
): Promise<SnapBooking[]> {
  const seed = await buildSnapSeedBookings(userId)
  const byId = new Set(existing.map((b) => b.id))
  const byContent = new Set(
    existing.map((b) => seedContentKey(b.date, b.customerName, b.amountGbp)),
  )

  const missing = seed.filter((row) => {
    if (byId.has(row.id)) return false
    const content = seedContentKey(row.date, row.customerName, row.amountGbp)
    if (byContent.has(content)) return false
    return true
  })

  if (!missing.length) return existing

  const merged = sortBookings([...existing, ...missing])
  await saveBookingsLocal(userId, merged)

  if (isSupabaseConfigured) {
    try {
      await upsertSnapBookingsCloud(userId, missing, { ignoreDuplicates: true })
    } catch (e) {
      console.warn('[snap] cloud seed upsert failed', e)
    }
  }

  return merged
}

async function mergeLocalAndCloud(
  userId: string,
  local: SnapBooking[] | undefined,
): Promise<SnapBooking[]> {
  if (!isSupabaseConfigured) return local ?? []

  try {
    const cloud = await fetchSnapBookingsCloud(userId)

    if (!cloud.length && local?.length) {
      await upsertSnapBookingsCloud(userId, local)
      return local
    }

    if (cloud.length && !local?.length) {
      await saveBookingsLocal(userId, cloud)
      return cloud
    }

    if (cloud.length && local?.length) {
      const byId = new Map<string, SnapBooking>()
      for (const b of local) byId.set(b.id, b)
      for (const b of cloud) {
        const prev = byId.get(b.id)
        if (!prev || b.createdAt >= prev.createdAt) byId.set(b.id, b)
      }
      const merged = sortBookings([...byId.values()])
      await saveBookingsLocal(userId, merged)
      // Push any local-only rows (e.g. offline adds) without wiping cloud.
      const cloudIds = new Set(cloud.map((b) => b.id))
      const localOnly = local.filter((b) => !cloudIds.has(b.id))
      if (localOnly.length) {
        await upsertSnapBookingsCloud(userId, localOnly)
      }
      return merged
    }

    return cloud.length ? cloud : (local ?? [])
  } catch (e) {
    console.warn('[snap] cloud load failed, using local', e)
    return local ?? []
  }
}

export async function loadSnapBookings(userId: string): Promise<SnapBooking[]> {
  const local = await loadBookingsLocal(userId)
  const merged = await mergeLocalAndCloud(userId, local?.bookings)
  return ensureNotionImportSeed(userId, merged)
}

export async function persistSnapBookings(
  userId: string,
  bookings: SnapBooking[],
): Promise<void> {
  await saveBookingsLocal(userId, bookings)

  if (!isSupabaseConfigured) return

  try {
    await replaceAllSnapBookingsCloud(userId, bookings)
  } catch (e) {
    console.error('[snap] cloud save failed', e)
    throw e
  }
}

export async function persistSnapBookingUpsert(
  userId: string,
  booking: SnapBooking,
  allBookings: SnapBooking[],
): Promise<void> {
  await saveBookingsLocal(userId, allBookings)
  if (!isSupabaseConfigured) return
  try {
    await upsertSnapBookingsCloud(userId, [booking])
  } catch (e) {
    console.error('[snap] cloud upsert failed', e)
    throw e
  }
}

export async function persistSnapBookingDelete(
  userId: string,
  id: string,
  allBookings: SnapBooking[],
): Promise<void> {
  await saveBookingsLocal(userId, allBookings)
  if (!isSupabaseConfigured) return
  try {
    await deleteSnapBookingCloud(id)
  } catch (e) {
    console.error('[snap] cloud delete failed', e)
    throw e
  }
}
