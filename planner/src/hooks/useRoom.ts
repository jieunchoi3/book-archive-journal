import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomEvent, RoomPerson, RoomPlacementPayload, RoomStore, RoomZone } from '../types/room'
import { doorPlacement, toEventPayload } from '../types/room'
import { daysBetween, todayKey } from '../types/compass'
import {
  deleteRoomPerson,
  loadRoom,
  loadRoomLocal,
  markRoomPending,
  persistRoom,
  saveRoomLocal,
} from '../lib/roomStorage'
import {
  buildStoreFromNotionCsv,
  mergeNotionImport,
} from '../lib/roomNotionImport'
import { placementsForAll } from '../lib/roomReconstruct'
import { generateId } from '../lib/weekUtils'
import { useAuth } from './useAuth'
import { normalizeTeamData } from '../types/compass'
import { loadCompassLocal } from '../lib/compassStorage'

const RECONNECT_DAYS = 90

export interface RoomActions {
  loading: boolean
  syncError: string | null
  store: RoomStore
  asOf: string
  setAsOf: (date: string) => void
  placements: Map<string, RoomPlacementPayload>
  gentleNudges: RoomPerson[]
  refresh: () => Promise<void>
  importNotion: () => Promise<void>
  importFromCompassTeam: () => Promise<void>
  invitePerson: (input: {
    name: string
    howWeMet: string
    note: string
  }) => Promise<void>
  movePerson: (personId: string, placement: RoomPlacementPayload) => Promise<void>
  logContact: (personId: string, on?: string) => Promise<void>
  updatePerson: (personId: string, patch: Partial<RoomPerson>) => Promise<void>
  deletePerson: (personId: string) => Promise<void>
  markHistorical: (personId: string) => Promise<void>
  snoozeNudge: (personId: string, days: number) => Promise<void>
  dismissNudge: (personId: string) => Promise<void>
}

export function useRoom(): RoomActions {
  const { user } = useAuth()
  const userId = user.id
  const [store, setStore] = useState<RoomStore>(() => loadRoomLocal(userId))
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [asOf, setAsOf] = useState(() => todayKey())
  const storeRef = useRef(store)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const applyStore = useCallback(
    (next: RoomStore, pushCloud = true) => {
      storeRef.current = next
      setStore(next)
      saveRoomLocal(userId, next)
      if (pushCloud) {
        void persistRoom(userId, next).catch((e) => {
          setSyncError(e instanceof Error ? e.message : 'Room sync failed')
        })
      }
    },
    [userId],
  )

  const runInitialNotionImport = useCallback(
    (base: RoomStore) => {
      if (base.people.length > 0 || base.notionImportedAt) return base
      const imported = buildStoreFromNotionCsv(userId)
      markRoomPending(
        userId,
        imported.people.map((p) => p.id).concat(imported.events.map((e) => e.id)),
      )
      return imported
    },
    [userId],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      let merged = await loadRoom(userId)
      if (!merged.people.length && !merged.notionImportedAt) {
        merged = runInitialNotionImport(merged)
        saveRoomLocal(userId, merged)
        await persistRoom(userId, merged)
      }
      applyStore(merged, false)
      setSyncError(null)
    } catch (e) {
      const local = loadRoomLocal(userId)
      const withImport = runInitialNotionImport(local)
      applyStore(withImport, true)
      setSyncError(e instanceof Error ? e.message : 'Could not sync room')
    } finally {
      setLoading(false)
    }
  }, [applyStore, runInitialNotionImport, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
      else void persistRoom(userId, storeRef.current).catch(() => {})
    }
    window.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', () => void refresh())
    return () => window.removeEventListener('visibilitychange', onVis)
  }, [refresh, userId])

  const placements = useMemo(
    () => placementsForAll(store.people, store.events, asOf),
    [store.people, store.events, asOf],
  )

  const gentleNudges = useMemo(() => {
    const today = todayKey()
    return store.people.filter((p) => {
      const placement = placements.get(p.id)
      if (!placement?.isActiveInRoom || placement.zone === 'archive') return false
      const dismiss = store.dismissals.find((d) => d.personId === p.id)
      if (dismiss?.dismissedAt) return false
      if (dismiss?.snoozeUntil && dismiss.snoozeUntil > today) return false
      const last = p.lastContactOn ?? p.metOn
      if (!last) return false
      return daysBetween(last, today) >= RECONNECT_DAYS
    })
  }, [store.people, store.dismissals, placements])

  const appendEvent = useCallback(
    (personId: string, kind: RoomEvent['kind'], payload: RoomPlacementPayload) => {
      const ev: RoomEvent = {
        id: generateId(),
        userId,
        personId,
        effectiveOn: todayKey(),
        kind,
        payload: toEventPayload(payload),
        createdAt: new Date().toISOString(),
      }
      markRoomPending(userId, [ev.id])
      applyStore({ ...storeRef.current, events: [...storeRef.current.events, ev] })
    },
    [applyStore, userId],
  )

  const importNotion = useCallback(async () => {
    const imported = buildStoreFromNotionCsv(userId)
    const merged = mergeNotionImport(storeRef.current, imported)
    markRoomPending(
      userId,
      merged.people.map((p) => p.id).concat(merged.events.map((e) => e.id)),
    )
    applyStore(merged)
  }, [applyStore, userId])

  const importFromCompassTeam = useCallback(async () => {
    const compass = await loadCompassLocal(userId)
    const teamSnap = [...compass.snapshots]
      .filter((s) => s.exerciseKey === 'team' && s.status === 'complete')
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]
    if (!teamSnap) return
    const team = normalizeTeamData(teamSnap.data)
    const now = new Date().toISOString()
    const today = todayKey()
    let next = { ...storeRef.current }
    const names = new Set(next.people.map((p) => p.name.trim().toLowerCase()))

    for (const [i, tp] of team.people.entries()) {
      if (names.has(tp.name.trim().toLowerCase())) continue
      const personId = generateId()
      const person: RoomPerson = {
        id: personId,
        userId,
        importKey: `compass:${tp.id}`,
        name: tp.name,
        fieldIndustry: tp.relation,
        howWeMet: 'Compass team',
        mbti: '',
        location: '',
        note: tp.note,
        metOn: tp.lastContact ?? today,
        lastContactOn: tp.lastContact,
        notionCompatibility: null,
        createdAt: now,
      }
      const placement = doorPlacement()
      placement.x = 0.35 + (i % 6) * 0.05
      next = {
        ...next,
        people: [...next.people, person],
        events: [
          ...next.events,
          {
            id: generateId(),
            userId,
            personId,
            effectiveOn: today,
            kind: 'entered_room',
            payload: toEventPayload(placement),
            createdAt: now,
          },
        ],
      }
      names.add(tp.name.trim().toLowerCase())
    }
    markRoomPending(userId, next.people.map((p) => p.id))
    applyStore(next)
  }, [applyStore, userId])

  const invitePerson = useCallback(
    async (input: { name: string; howWeMet: string; note: string }) => {
      const name = input.name.trim()
      if (!name) return
      const now = new Date().toISOString()
      const today = todayKey()
      const personId = generateId()
      const person: RoomPerson = {
        id: personId,
        userId,
        importKey: null,
        name,
        fieldIndustry: '',
        howWeMet: input.howWeMet.trim(),
        mbti: '',
        location: '',
        note: input.note.trim(),
        metOn: today,
        lastContactOn: today,
        notionCompatibility: null,
        createdAt: now,
      }
      const placement = doorPlacement()
      markRoomPending(userId, [personId])
      applyStore({
        ...storeRef.current,
        people: [...storeRef.current.people, person],
        events: [
          ...storeRef.current.events,
          {
            id: generateId(),
            userId,
            personId,
            effectiveOn: today,
            kind: 'invited_at_door',
            payload: toEventPayload(placement),
            createdAt: now,
          },
        ],
      })
    },
    [applyStore, userId],
  )

  const movePerson = useCallback(
    async (personId: string, placement: RoomPlacementPayload) => {
      appendEvent(personId, 'moved', placement)
    },
    [appendEvent],
  )

  const logContact = useCallback(
    async (personId: string, on?: string) => {
      const day = on ?? todayKey()
      const people = storeRef.current.people.map((p) =>
        p.id === personId ? { ...p, lastContactOn: day } : p,
      )
      applyStore({ ...storeRef.current, people })
      const placement = placements.get(personId) ?? doorPlacement()
      appendEvent(personId, 'contact_logged', placement)
    },
    [applyStore, appendEvent, placements],
  )

  const updatePerson = useCallback(
    async (personId: string, patch: Partial<RoomPerson>) => {
      applyStore({
        ...storeRef.current,
        people: storeRef.current.people.map((p) =>
          p.id === personId ? { ...p, ...patch } : p,
        ),
      })
    },
    [applyStore],
  )

  const deletePerson = useCallback(
    async (personId: string) => {
      const next = await deleteRoomPerson(userId, personId, storeRef.current)
      storeRef.current = next
      setStore(next)
    },
    [userId],
  )

  const markHistorical = useCallback(
    async (personId: string) => {
      const cur = placements.get(personId) ?? doorPlacement()
      appendEvent(personId, 'marked_historical', {
        ...cur,
        zone: 'archive' as RoomZone,
        isActiveInRoom: false,
        emotionalPresence: cur.emotionalPresence,
      })
    },
    [appendEvent, placements],
  )

  const snoozeNudge = useCallback(
    async (personId: string, days: number) => {
      const until = new Date()
      until.setDate(until.getDate() + days)
      const snoozeUntil = until.toISOString().slice(0, 10)
      const rest = storeRef.current.dismissals.filter((d) => d.personId !== personId)
      applyStore({
        ...storeRef.current,
        dismissals: [...rest, { personId, snoozeUntil, dismissedAt: null }],
      })
    },
    [applyStore],
  )

  const dismissNudge = useCallback(
    async (personId: string) => {
      const rest = storeRef.current.dismissals.filter((d) => d.personId !== personId)
      applyStore({
        ...storeRef.current,
        dismissals: [
          ...rest,
          { personId, snoozeUntil: null, dismissedAt: new Date().toISOString() },
        ],
      })
    },
    [applyStore],
  )

  return {
    loading,
    syncError,
    store,
    asOf,
    setAsOf,
    placements,
    gentleNudges,
    refresh,
    importNotion,
    importFromCompassTeam,
    invitePerson,
    movePerson,
    logContact,
    updatePerson,
    deletePerson,
    markHistorical,
    snoozeNudge,
    dismissNudge,
  }
}
