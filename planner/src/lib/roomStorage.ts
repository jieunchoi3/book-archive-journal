import type { RoomStore } from '../types/room'
import { emptyRoomStore } from '../types/room'
import { deleteRoomPersonCloud, fetchRoomCloud, syncRoomToCloud } from './roomCloud'
import { isSupabaseConfigured } from './supabase'

const KEY_PREFIX = 'planner:room:'
const PENDING_SUFFIX = ':pending'

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

function pendingKey(userId: string) {
  return `${KEY_PREFIX}${userId}${PENDING_SUFFIX}`
}

function loadPending(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(pendingKey(userId))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function savePending(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(pendingKey(userId), JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

export function markRoomPending(userId: string, ids: string[]) {
  const p = loadPending(userId)
  ids.forEach((id) => p.add(id))
  savePending(userId, p)
}

function markSynced(userId: string, store: RoomStore) {
  const p = loadPending(userId)
  for (const person of store.people) p.delete(person.id)
  for (const ev of store.events) p.delete(ev.id)
  savePending(userId, p)
}

export function loadRoomLocal(userId: string): RoomStore {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return emptyRoomStore()
    return { ...emptyRoomStore(), ...(JSON.parse(raw) as RoomStore) }
  } catch {
    return emptyRoomStore()
  }
}

export function saveRoomLocal(userId: string, store: RoomStore): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(store))
  } catch {
    // ignore
  }
}

function mergeStores(cloud: RoomStore, local: RoomStore, pending: Set<string>): RoomStore {
  const peopleMap = new Map(cloud.people.map((p) => [p.id, p]))
  for (const p of local.people) {
    if (!peopleMap.has(p.id) && pending.has(p.id)) peopleMap.set(p.id, p)
    else if (peopleMap.has(p.id)) {
      const c = peopleMap.get(p.id)!
      peopleMap.set(p.id, {
        ...c,
        note: p.note.length > c.note.length ? p.note : c.note,
        lastContactOn: p.lastContactOn ?? c.lastContactOn,
      })
    }
  }

  const eventMap = new Map(cloud.events.map((e) => [e.id, e]))
  for (const e of local.events) {
    if (!eventMap.has(e.id) && pending.has(e.id)) eventMap.set(e.id, e)
  }

  return {
    people: [...peopleMap.values()],
    events: [...eventMap.values()].sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn)),
    reflections: cloud.reflections.length ? cloud.reflections : local.reflections,
    dismissals: cloud.dismissals.length ? cloud.dismissals : local.dismissals,
    notionImportedAt: local.notionImportedAt ?? cloud.notionImportedAt,
  }
}

export async function loadRoom(userId: string): Promise<RoomStore> {
  const local = loadRoomLocal(userId)
  if (!isSupabaseConfigured) return local

  try {
    const cloud = await fetchRoomCloud(userId)
    const pending = loadPending(userId)
    for (const p of local.people) {
      if (!cloud.people.some((c) => c.id === p.id)) pending.add(p.id)
    }
    for (const e of local.events) {
      if (!cloud.events.some((c) => c.id === e.id)) pending.add(e.id)
    }
    savePending(userId, pending)

    const merged = mergeStores(cloud, local, pending)
    merged.notionImportedAt = local.notionImportedAt ?? merged.notionImportedAt
    saveRoomLocal(userId, merged)
    await syncRoomToCloud(merged)
    markSynced(userId, merged)
    return merged
  } catch (e) {
    console.warn('[room] cloud load failed', e)
    if (local.people.length) return local
    throw e
  }
}

export async function persistRoom(userId: string, store: RoomStore): Promise<void> {
  saveRoomLocal(userId, store)
  if (!isSupabaseConfigured) return
  await syncRoomToCloud(store)
  markSynced(userId, store)
}

export async function deleteRoomPerson(userId: string, personId: string, store: RoomStore): Promise<RoomStore> {
  const next: RoomStore = {
    ...store,
    people: store.people.filter((p) => p.id !== personId),
    events: store.events.filter((e) => e.personId !== personId),
    dismissals: store.dismissals.filter((d) => d.personId !== personId),
  }
  saveRoomLocal(userId, next)
  if (isSupabaseConfigured) await deleteRoomPersonCloud(personId)
  return next
}
