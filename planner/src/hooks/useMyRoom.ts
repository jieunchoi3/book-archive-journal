import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CharacterAppearance,
  MyRoomPerson,
  MyRoomStore,
  PersonMemory,
  RoomSnapshot,
} from '../types/myRoom'
import { loadMyRoomStore, saveMyRoomStore } from '../lib/myRoomStorage'
import { inRoomAt, peopleInRoom, positionsAt } from '../lib/myRoomTimeline'
import { generateId } from '../lib/weekUtils'
import { todayKey } from '../types/compass'
import { addDays } from '../types/compass'
import { DOOR_X, DOOR_Y, ROOM_H, ROOM_W } from '../components/myRoom/roomConstants'

function todayIso(): string {
  return todayKey()
}

export interface CreatePersonInput {
  name: string
  relationship: string
  dateMet: string | null
  lastMet: string | null
  valueNote: string
  character: CharacterAppearance
  inviteToRoom: boolean
  initialX?: number
  initialY?: number
}

export interface MyRoomActions {
  store: MyRoomStore
  loading: boolean
  peopleInRoomNow: MyRoomPerson[]
  positionsNow: Map<string, { x: number; y: number }>
  gentleReminders: Array<{ person: MyRoomPerson; daysSince: number }>
  createPerson: (input: CreatePersonInput) => string
  updatePerson: (id: string, patch: Partial<Omit<MyRoomPerson, 'id' | 'createdAt'>>) => void
  updateCharacter: (id: string, character: CharacterAppearance) => void
  movePerson: (personId: string, x: number, y: number, effectiveOn?: string) => void
  inviteToRoom: (personId: string, x?: number, y?: number) => void
  archiveFromRoom: (personId: string) => void
  addMemory: (personId: string, date: string, text: string) => void
  saveSnapshot: (label: string, note?: string) => void
  snoozeReminder: (personId: string, days: number) => void
  dismissReminder: (personId: string) => void
  completeOnboarding: () => void
  positionsAtDate: (asOf: string) => Map<string, { x: number; y: number }>
  peopleInRoomAt: (asOf: string) => MyRoomPerson[]
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function useMyRoom(): MyRoomActions {
  const [store, setStore] = useState<MyRoomStore>(() => loadMyRoomStore())
  const [loading, setLoading] = useState(true)
  const storeRef = useRef(store)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const apply = useCallback((next: MyRoomStore) => {
    storeRef.current = next
    setStore(next)
    saveMyRoomStore(next)
  }, [])

  useEffect(() => {
    setLoading(false)
  }, [])

  const appendPosition = useCallback(
    (
      personId: string,
      x: number,
      y: number,
      inRoom: boolean,
      effectiveOn: string,
    ) => {
      const s = storeRef.current
      apply({
        ...s,
        positionHistory: [
          ...s.positionHistory,
          {
            id: generateId(),
            personId,
            effectiveOn,
            x,
            y,
            inRoom,
            createdAt: new Date().toISOString(),
          },
        ],
      })
    },
    [apply],
  )

  const createPerson = useCallback(
    (input: CreatePersonInput): string => {
      const id = generateId()
      const person: MyRoomPerson = {
        id,
        name: input.name.trim(),
        relationship: input.relationship,
        dateMet: input.dateMet,
        lastMet: input.lastMet,
        valueNote: input.valueNote.trim(),
        character: input.character,
        createdAt: new Date().toISOString(),
      }
      const s = storeRef.current
      let next: MyRoomStore = { ...s, people: [...s.people, person] }
      if (input.inviteToRoom) {
        const x = input.initialX ?? DOOR_X - 80
        const y = input.initialY ?? DOOR_Y
        next = {
          ...next,
          positionHistory: [
            ...next.positionHistory,
            {
              id: generateId(),
              personId: id,
              effectiveOn: todayIso(),
              x,
              y,
              inRoom: true,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      }
      apply(next)
      return id
    },
    [apply],
  )

  const updatePerson = useCallback(
    (id: string, patch: Partial<Omit<MyRoomPerson, 'id' | 'createdAt'>>) => {
      const s = storeRef.current
      apply({
        ...s,
        people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })
    },
    [apply],
  )

  const updateCharacter = useCallback(
    (id: string, character: CharacterAppearance) => {
      updatePerson(id, { character })
    },
    [updatePerson],
  )

  const movePerson = useCallback(
    (personId: string, x: number, y: number, effectiveOn?: string) => {
      const s = storeRef.current
      if (!inRoomAt(personId, s.positionHistory, effectiveOn ?? todayIso())) return
      appendPosition(personId, x, y, true, effectiveOn ?? todayIso())
    },
    [appendPosition],
  )

  const inviteToRoom = useCallback(
    (personId: string, x = DOOR_X - 120, y = DOOR_Y) => {
      appendPosition(personId, x, y, true, todayIso())
    },
    [appendPosition],
  )

  const archiveFromRoom = useCallback(
    (personId: string) => {
      const s = storeRef.current
      const rec = s.positionHistory
        .filter((r) => r.personId === personId)
        .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn))[0]
      const x = rec?.x ?? ROOM_W / 2
      const y = rec?.y ?? ROOM_H / 2
      appendPosition(personId, x, y, false, todayIso())
    },
    [appendPosition],
  )

  const addMemory = useCallback(
    (personId: string, date: string, text: string) => {
      const mem: PersonMemory = {
        id: generateId(),
        personId,
        date,
        text: text.trim(),
      }
      const s = storeRef.current
      apply({ ...s, memories: [...s.memories, mem] })
    },
    [apply],
  )

  const saveSnapshot = useCallback(
    (label: string, note = '') => {
      const asOf = todayIso()
      const pos = positionsAt(storeRef.current, asOf)
      const snap: RoomSnapshot = {
        id: generateId(),
        label: label.trim() || `Room · ${asOf}`,
        savedOn: asOf,
        note: note.trim(),
        positions: [...pos.entries()].map(([personId, { x, y }]) => ({
          personId,
          x,
          y,
        })),
        createdAt: new Date().toISOString(),
      }
      const s = storeRef.current
      apply({ ...s, snapshots: [snap, ...s.snapshots] })
    },
    [apply],
  )

  const snoozeReminder = useCallback(
    (personId: string, days: number) => {
      const s = storeRef.current
      const snoozeUntil = addDays(todayIso(), days)
      const rest = s.dismissals.filter((d) => d.personId !== personId)
      apply({
        ...s,
        dismissals: [
          ...rest,
          { personId, snoozeUntil, dismissedAt: null },
        ],
      })
    },
    [apply],
  )

  const dismissReminder = useCallback(
    (personId: string) => {
      const s = storeRef.current
      const rest = s.dismissals.filter((d) => d.personId !== personId)
      apply({
        ...s,
        dismissals: [
          ...rest,
          {
            personId,
            snoozeUntil: null,
            dismissedAt: new Date().toISOString(),
          },
        ],
      })
    },
    [apply],
  )

  const completeOnboarding = useCallback(() => {
    apply({ ...storeRef.current, onboardingDone: true })
  }, [apply])

  const positionsAtDate = useCallback(
    (asOf: string) => positionsAt(storeRef.current, asOf),
    [],
  )

  const peopleInRoomAt = useCallback(
    (asOf: string) =>
      peopleInRoom(storeRef.current.people, storeRef.current.positionHistory, asOf),
    [],
  )

  const asOf = todayIso()
  const peopleInRoomNow = useMemo(
    () => peopleInRoom(store.people, store.positionHistory, asOf),
    [store.people, store.positionHistory, asOf],
  )
  const positionsNow = useMemo(
    () => positionsAt(store, asOf),
    [store, asOf],
  )

  const gentleReminders = useMemo(() => {
    const today = todayIso()
    const out: Array<{ person: MyRoomPerson; daysSince: number }> = []
    for (const p of store.people) {
      if (!p.lastMet) continue
      const days = daysBetween(p.lastMet, today)
      if (days < 60) continue
      const d = store.dismissals.find((x) => x.personId === p.id)
      if (d?.snoozeUntil && d.snoozeUntil > today) continue
      if (d?.dismissedAt) continue
      out.push({ person: p, daysSince: days })
    }
    out.sort((a, b) => b.daysSince - a.daysSince)
    return out.slice(0, 3)
  }, [store.people, store.dismissals])

  return {
    store,
    loading,
    peopleInRoomNow,
    positionsNow,
    gentleReminders,
    createPerson,
    updatePerson,
    updateCharacter,
    movePerson,
    inviteToRoom,
    archiveFromRoom,
    addMemory,
    saveSnapshot,
    snoozeReminder,
    dismissReminder,
    completeOnboarding,
    positionsAtDate,
    peopleInRoomAt,
  }
}
