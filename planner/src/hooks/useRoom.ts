import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  RoomEvent,
  RoomPerson,
  RoomPlacementPayload,
  RoomSnapshot,
  RoomStore,
} from '../types/room'
import { doorPlacement, toEventPayload } from '../types/room'
import { daysBetween, todayKey } from '../types/compass'
import {
  deleteRoomPerson,
  loadRoom,
  loadRoomLocal,
  markRoomPending,
  migrateRoomStoreV2,
  persistRoom,
  saveRoomLocal,
} from '../lib/roomStorage'
import { buildStoreFromNotionCsv, mergeNotionImport } from '../lib/roomNotionImport'
import {
  peopleInRoomAtDate,
  peopleMetNotInRoom,
  placementsInRoom,
} from '../lib/roomMembership'
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
  inRoomPeople: RoomPerson[]
  metNotInRoom: RoomPerson[]
  placements: Map<string, RoomPlacementPayload>
  gentleNudges: RoomPerson[]
  showOnboarding: boolean
  dismissOnboarding: () => void
  refresh: () => Promise<void>
  importNotion: () => Promise<void>
  importFromCompassTeam: () => Promise<void>
  inviteIntoRoom: (personId: string) => Promise<void>
  inviteNewPerson: (input: { name: string; howWeMet: string; note: string }) => Promise<void>
  movePerson: (personId: string, placement: RoomPlacementPayload) => Promise<void>
  logContact: (personId: string, on?: string) => Promise<void>
  updatePerson: (personId: string, patch: Partial<RoomPerson>) => Promise<void>
  removeFromRoom: (personId: string) => Promise<void>
  archivePerson: (personId: string) => Promise<void>
  deletePerson: (personId: string) => Promise<void>
  saveSnapshot: (label: string, note?: string) => Promise<void>
  snoozeNudge: (personId: string, days: number) => Promise<void>
  dismissNudge: (personId: string) => Promise<void>
}

export function useRoom(): RoomActions {
  const { user } = useAuth()
  const userId = user.id
  const [store, setStore] = useState<RoomStore>(() => migrateRoomStoreV2(loadRoomLocal(userId)))
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [asOf, setAsOf] = useState(() => todayKey())
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const storeRef = useRef(store)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const applyStore = useCallback(
    (next: RoomStore, pushCloud = true) => {
      const migrated = migrateRoomStoreV2(next)
      storeRef.current = migrated
      setStore(migrated)
      saveRoomLocal(userId, migrated)
      if (pushCloud) {
        void persistRoom(userId, migrated).catch((e) => {
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
      markRoomPending(userId, imported.people.map((p) => p.id))
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
      const local = migrateRoomStoreV2(runInitialNotionImport(loadRoomLocal(userId)))
      applyStore(local, true)
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

  const inRoomPeople = useMemo(
    () => peopleInRoomAtDate(store.people, store.events, asOf),
    [store.people, store.events, asOf],
  )

  const metNotInRoom = useMemo(
    () => peopleMetNotInRoom(store.people, store.events, asOf),
    [store.people, store.events, asOf],
  )

  const placements = useMemo(
    () => placementsInRoom(store.people, store.events, asOf),
    [store.people, store.events, asOf],
  )

  const gentleNudges = useMemo(() => {
    const today = todayKey()
    return inRoomPeople.filter((p) => {
      const dismiss = store.dismissals.find((d) => d.personId === p.id)
      if (dismiss?.dismissedAt) return false
      if (dismiss?.snoozeUntil && dismiss.snoozeUntil > today) return false
      const last = p.lastContactOn ?? p.metOn
      if (!last) return false
      return daysBetween(last, today) >= RECONNECT_DAYS
    })
  }, [inRoomPeople, store.dismissals])

  const showOnboarding =
    !onboardingDismissed &&
    store.people.length > 0 &&
    inRoomPeople.length === 0 &&
    asOf === todayKey()

  const appendEvent = useCallback(
    (personId: string, kind: RoomEvent['kind'], payload: Record<string, unknown>, on?: string) => {
      const ev: RoomEvent = {
        id: generateId(),
        userId,
        personId,
        effectiveOn: on ?? todayKey(),
        kind,
        payload,
        createdAt: new Date().toISOString(),
      }
      markRoomPending(userId, [ev.id])
      applyStore({ ...storeRef.current, events: [...storeRef.current.events, ev] })
    },
    [applyStore, userId],
  )

  const inviteIntoRoom = useCallback(
    async (personId: string) => {
      appendEvent(personId, 'invited_to_room', toEventPayload(doorPlacement()))
    },
    [appendEvent],
  )

  const inviteNewPerson = useCallback(
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
      markRoomPending(userId, [personId])
      applyStore({
        ...storeRef.current,
        people: [...storeRef.current.people, person],
      })
      await inviteIntoRoom(personId)
    },
    [applyStore, inviteIntoRoom, userId],
  )

  const movePerson = useCallback(
    async (personId: string, placement: RoomPlacementPayload) => {
      appendEvent(personId, 'moved', toEventPayload(placement))
    },
    [appendEvent],
  )

  const logContact = useCallback(
    async (personId: string, on?: string) => {
      const day = on ?? todayKey()
      applyStore({
        ...storeRef.current,
        people: storeRef.current.people.map((p) =>
          p.id === personId ? { ...p, lastContactOn: day } : p,
        ),
      })
      appendEvent(personId, 'contact_logged', {}, day)
    },
    [appendEvent, applyStore],
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

  const removeFromRoom = useCallback(
    async (personId: string) => {
      appendEvent(personId, 'archived', {})
    },
    [appendEvent],
  )

  const archivePerson = removeFromRoom

  const deletePerson = useCallback(
    async (personId: string) => {
      const next = await deleteRoomPerson(userId, personId, storeRef.current)
      storeRef.current = next
      setStore(next)
    },
    [userId],
  )

  const saveSnapshot = useCallback(
    async (label: string, note = '') => {
      const today = todayKey()
      const pl: Record<string, RoomPlacementPayload> = {}
      for (const [id, placement] of placementsInRoom(storeRef.current.people, storeRef.current.events, today)) {
        pl[id] = placement
      }
      const snap: RoomSnapshot = {
        id: generateId(),
        userId,
        label: label.trim() || today,
        savedOn: today,
        note,
        placements: pl,
        createdAt: new Date().toISOString(),
      }
      applyStore({ ...storeRef.current, snapshots: [...storeRef.current.snapshots, snap] })
    },
    [applyStore, userId],
  )

  const importNotion = useCallback(async () => {
    const imported = buildStoreFromNotionCsv(userId)
    const merged = mergeNotionImport(storeRef.current, imported)
    markRoomPending(userId, merged.people.map((p) => p.id))
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

    for (const tp of team.people) {
      if (names.has(tp.name.trim().toLowerCase())) continue
      const personId = generateId()
      next = {
        ...next,
        people: [
          ...next.people,
          {
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
          },
        ],
      }
      names.add(tp.name.trim().toLowerCase())
    }
    markRoomPending(userId, next.people.map((p) => p.id))
    applyStore(next)
  }, [applyStore, userId])

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
    inRoomPeople,
    metNotInRoom,
    placements,
    gentleNudges,
    showOnboarding,
    dismissOnboarding: () => setOnboardingDismissed(true),
    refresh,
    importNotion,
    importFromCompassTeam,
    inviteIntoRoom,
    inviteNewPerson,
    movePerson,
    logContact,
    updatePerson,
    removeFromRoom,
    archivePerson,
    deletePerson,
    saveSnapshot,
    snoozeNudge,
    dismissNudge,
  }
}
