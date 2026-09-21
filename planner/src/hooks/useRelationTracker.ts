import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadRelationTracker,
  saveRelationTracker,
} from '../lib/relationTrackerStorage'
import type {
  ConnectFrequency,
  RelationPerson,
  RelationTrackerState,
} from '../types/relationTracker'
import { DEFAULT_AVATAR } from '../types/relationTracker'

function daysSince(iso: string): number {
  const then = new Date(iso)
  const now = new Date()
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
}

export function useRelationTracker() {
  const [state, setState] = useState<RelationTrackerState>(() =>
    loadRelationTracker(),
  )

  useEffect(() => {
    saveRelationTracker(state)
  }, [state])

  const addPerson = useCallback((person: Omit<RelationPerson, 'id'>) => {
    const id = crypto.randomUUID()
    setState((s) => ({
      ...s,
      people: [
        ...s.people,
        {
          ...person,
          id,
          roomX: 0.3 + Math.random() * 0.4,
          roomY: 0.25 + Math.random() * 0.35,
        },
      ],
    }))
    return id
  }, [])

  const updatePerson = useCallback(
    (id: string, patch: Partial<RelationPerson>) => {
      setState((s) => ({
        ...s,
        people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))
    },
    [],
  )

  const removePerson = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      people: s.people.filter((p) => p.id !== id),
    }))
  }, [])

  const setZoom = useCallback((zoom: number) => {
    setState((s) => ({ ...s, zoom: Math.min(1.5, Math.max(0.6, zoom)) }))
  }, [])

  const dismissCheckIn = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      dismissedCheckIns: [...new Set([...s.dismissedCheckIns, id])],
    }))
  }, [])

  const markReachedOut = useCallback((id: string) => {
    const today = new Date().toISOString().slice(0, 10)
    setState((s) => ({
      ...s,
      people: s.people.map((p) =>
        p.id === id ? { ...p, lastInteraction: today } : p,
      ),
      dismissedCheckIns: [...new Set([...s.dismissedCheckIns, id])],
    }))
  }, [])

  const checkIns = useMemo(() => {
    return state.people
      .filter((p) => !state.dismissedCheckIns.includes(p.id))
      .map((p) => {
        const last = p.lastInteraction ?? p.metDate
        const days = daysSince(last)
        const freq = p.connectFrequency ?? 'few_months'
        const threshold =
          freq === 'weekly' ? 14 : freq === 'monthly' ? 45 : 75
        if (days < threshold) return null
        return { person: p, days, freq }
      })
      .filter(Boolean) as {
      person: RelationPerson
      days: number
      freq: ConnectFrequency
    }[]
  }, [state.people, state.dismissedCheckIns])

  return {
    people: state.people,
    zoom: state.zoom,
    checkIns,
    addPerson,
    updatePerson,
    removePerson,
    setZoom,
    dismissCheckIn,
    markReachedOut,
  }
}

export function emptyPersonDraft(): Omit<RelationPerson, 'id'> {
  return {
    name: '',
    relationshipType: '',
    occupation: '',
    location: '',
    metContext: '',
    metDate: new Date().toISOString().slice(0, 10),
    avatar: { ...DEFAULT_AVATAR },
    connectFrequency: 'monthly',
  }
}
