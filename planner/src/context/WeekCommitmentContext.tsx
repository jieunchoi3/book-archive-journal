import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DayKey } from '../types/planner'
import type {
  CommitmentDefaultTask,
  CommitmentPlacementTask,
  WeekCommitment,
  WeekCommitmentPlacement,
  WeekCommitmentStore,
} from '../types/weekCommitment'
import {
  COMMITMENT_COLORS,
  remainingSlotsForCommitment,
} from '../types/weekCommitment'
import { generateId } from '../lib/weekUtils'
import {
  loadWeekCommitmentStoreLocal,
  saveWeekCommitmentStoreLocal,
} from '../lib/weekCommitmentCache'
import {
  loadWeekCommitmentStoreMerged,
  syncWeekCommitmentStore,
} from '../lib/weekCommitmentCloud'
import { registerWeekCommitmentFlusher } from '../lib/weekCommitmentFlush'

export interface WeekCommitmentActions {
  loading: boolean
  commitments: WeekCommitment[]
  placements: WeekCommitmentPlacement[]
  getPlacementsForDay: (dayKey: DayKey) => WeekCommitmentPlacement[]
  getCommitment: (id: string) => WeekCommitment | null
  remainingSlots: (commitmentId: string) => number
  poolSlots: { commitmentId: string; slotIndex: number }[]
  addCommitment: (input?: {
    title?: string
    color?: string
    targetPerWeek?: number
  }) => string
  updateCommitment: (
    id: string,
    updates: Partial<
      Pick<WeekCommitment, 'title' | 'color' | 'targetPerWeek' | 'defaultTasks' | 'sortOrder'>
    >,
  ) => void
  deleteCommitment: (id: string) => void
  placeCommitment: (commitmentId: string, dayKey: DayKey) => string | null
  movePlacement: (placementId: string, dayKey: DayKey) => void
  removePlacement: (placementId: string) => void
  addPlacementTask: (placementId: string, label: string) => void
  togglePlacementTask: (placementId: string, taskId: string) => void
  deletePlacementTask: (placementId: string, taskId: string) => void
  renamePlacementTask: (placementId: string, taskId: string, label: string) => void
  flushSync: () => Promise<void>
}

const WeekCommitmentContext = createContext<WeekCommitmentActions | null>(null)

function buildTasksFromDefaults(
  defaults: CommitmentDefaultTask[],
): CommitmentPlacementTask[] {
  return defaults.map((d, i) => ({
    id: generateId(),
    label: d.label,
    done: false,
    repeatWeekly: d.repeatWeekly,
    sourceDefaultId: d.id,
    sortOrder: i,
  }))
}

export function WeekCommitmentProvider({
  userId,
  weekStart,
  children,
}: {
  userId: string
  weekStart: string
  children: ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<WeekCommitmentStore>(() =>
    loadWeekCommitmentStoreLocal(userId),
  )
  const storeRef = useRef(store)
  const weekStartRef = useRef(weekStart)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncQueue = useRef(Promise.resolve())

  useEffect(() => {
    storeRef.current = store
  }, [store])

  useEffect(() => {
    weekStartRef.current = weekStart
  }, [weekStart])

  const persistLocal = useCallback(
    (next: WeekCommitmentStore) => {
      saveWeekCommitmentStoreLocal(userId, next)
    },
    [userId],
  )

  const enqueueSync = useCallback(
    (next: WeekCommitmentStore): Promise<void> => {
      const job = syncQueue.current.then(() => syncWeekCommitmentStore(userId, next))
      syncQueue.current = job.catch((e) =>
        console.warn('[weekCommitments] sync failed', e),
      )
      return syncQueue.current
    },
    [userId],
  )

  const scheduleSync = useCallback(
    (next: WeekCommitmentStore) => {
      persistLocal(next)
      if (syncTimer.current) clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(() => {
        syncTimer.current = null
        void enqueueSync(storeRef.current)
      }, 400)
    },
    [enqueueSync, persistLocal],
  )

  const flushSync = useCallback(async () => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current)
      syncTimer.current = null
    }
    persistLocal(storeRef.current)
    await enqueueSync(storeRef.current)
  }, [enqueueSync, persistLocal])

  useEffect(() => {
    registerWeekCommitmentFlusher(flushSync)
    return () => registerWeekCommitmentFlusher(null)
  }, [flushSync])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const merged = await loadWeekCommitmentStoreMerged(userId)
        if (cancelled) return
        storeRef.current = merged
        setStore(merged)
      } catch (e) {
        console.warn('[weekCommitments] load failed', e)
        if (!cancelled) {
          const local = loadWeekCommitmentStoreLocal(userId)
          storeRef.current = local
          setStore(local)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    const onPageHide = () => {
      void flushSync()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flushSync()
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      void flushSync()
    }
  }, [flushSync])

  const updateStore = useCallback(
    (updater: (prev: WeekCommitmentStore) => WeekCommitmentStore) => {
      setStore((prev) => {
        const next = updater(prev)
        storeRef.current = next
        scheduleSync(next)
        return next
      })
    },
    [scheduleSync],
  )

  const getCommitment = useCallback(
    (id: string) => store.commitments.find((c) => c.id === id) ?? null,
    [store.commitments],
  )

  const getPlacementsForDay = useCallback(
    (dayKey: DayKey) =>
      store.placements
        .filter((p) => p.weekStart === weekStart && p.dayKey === dayKey)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [store.placements, weekStart],
  )

  const remainingSlots = useCallback(
    (commitmentId: string) => {
      const c = store.commitments.find((x) => x.id === commitmentId)
      if (!c) return 0
      return remainingSlotsForCommitment(c, store.placements, weekStart)
    },
    [store.commitments, store.placements, weekStart],
  )

  const poolSlots = useMemo(() => {
    const slots: { commitmentId: string; slotIndex: number }[] = []
    for (const c of store.commitments) {
      const rem = remainingSlotsForCommitment(c, store.placements, weekStart)
      for (let i = 0; i < rem; i++) {
        slots.push({ commitmentId: c.id, slotIndex: i })
      }
    }
    return slots
  }, [store.commitments, store.placements, weekStart])

  const value = useMemo<WeekCommitmentActions>(
    () => ({
      loading,
      commitments: store.commitments,
      placements: store.placements,
      getPlacementsForDay,
      getCommitment,
      remainingSlots,
      poolSlots,
      addCommitment: (input) => {
        const id = generateId()
        const color =
          input?.color ??
          COMMITMENT_COLORS[store.commitments.length % COMMITMENT_COLORS.length]
        const entry: WeekCommitment = {
          id,
          title: (input?.title ?? '새 커밋먼트').trim() || '새 커밋먼트',
          color,
          targetPerWeek: Math.max(0, Math.min(21, input?.targetPerWeek ?? 1)),
          defaultTasks: [],
          sortOrder: store.commitments.length,
        }
        updateStore((prev) => ({
          ...prev,
          commitments: [...prev.commitments, entry],
        }))
        return id
      },
      updateCommitment: (id, updates) => {
        updateStore((prev) => ({
          ...prev,
          commitments: prev.commitments.map((c) => {
            if (c.id !== id) return c
            return {
              ...c,
              ...updates,
              id: c.id,
              title: updates.title !== undefined ? updates.title.trim() || c.title : c.title,
              targetPerWeek:
                updates.targetPerWeek !== undefined
                  ? Math.max(0, Math.min(21, updates.targetPerWeek))
                  : c.targetPerWeek,
            }
          }),
        }))
      },
      deleteCommitment: (id) => {
        updateStore((prev) => ({
          commitments: prev.commitments.filter((c) => c.id !== id),
          placements: prev.placements.filter((p) => p.commitmentId !== id),
        }))
      },
      placeCommitment: (commitmentId, dayKey) => {
        const commitment = storeRef.current.commitments.find((c) => c.id === commitmentId)
        if (!commitment) return null
        const rem = remainingSlotsForCommitment(
          commitment,
          storeRef.current.placements,
          weekStartRef.current,
        )
        if (rem <= 0) return null

        const id = generateId()
        const sameDay = storeRef.current.placements.filter(
          (p) => p.weekStart === weekStartRef.current && p.dayKey === dayKey,
        )
        const placement: WeekCommitmentPlacement = {
          id,
          weekStart: weekStartRef.current,
          commitmentId,
          dayKey,
          sortOrder: sameDay.length,
          tasks: buildTasksFromDefaults(commitment.defaultTasks),
        }
        updateStore((prev) => ({
          ...prev,
          placements: [...prev.placements, placement],
        }))
        return id
      },
      movePlacement: (placementId, dayKey) => {
        updateStore((prev) => {
          const target = prev.placements.find((p) => p.id === placementId)
          if (!target || target.dayKey === dayKey) return prev
          const maxOrder = prev.placements
            .filter(
              (p) =>
                p.weekStart === target.weekStart &&
                p.dayKey === dayKey &&
                p.id !== placementId,
            )
            .reduce((m, p) => Math.max(m, p.sortOrder), -1)
          return {
            ...prev,
            placements: prev.placements.map((p) =>
              p.id === placementId
                ? { ...p, dayKey, sortOrder: maxOrder + 1 }
                : p,
            ),
          }
        })
      },
      removePlacement: (placementId) => {
        updateStore((prev) => ({
          ...prev,
          placements: prev.placements.filter((p) => p.id !== placementId),
        }))
      },
      addPlacementTask: (placementId, label) => {
        const trimmed = label.trim()
        if (!trimmed) return
        updateStore((prev) => ({
          ...prev,
          placements: prev.placements.map((p) => {
            if (p.id !== placementId) return p
            const task: CommitmentPlacementTask = {
              id: generateId(),
              label: trimmed,
              done: false,
              repeatWeekly: false,
              sortOrder: p.tasks.length,
            }
            return { ...p, tasks: [...p.tasks, task] }
          }),
        }))
      },
      togglePlacementTask: (placementId, taskId) => {
        updateStore((prev) => ({
          ...prev,
          placements: prev.placements.map((p) => {
            if (p.id !== placementId) return p
            return {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId ? { ...t, done: !t.done } : t,
              ),
            }
          }),
        }))
      },
      deletePlacementTask: (placementId, taskId) => {
        updateStore((prev) => ({
          ...prev,
          placements: prev.placements.map((p) => {
            if (p.id !== placementId) return p
            return { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }
          }),
        }))
      },
      renamePlacementTask: (placementId, taskId, label) => {
        const trimmed = label.trim()
        if (!trimmed) return
        updateStore((prev) => ({
          ...prev,
          placements: prev.placements.map((p) => {
            if (p.id !== placementId) return p
            return {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId ? { ...t, label: trimmed } : t,
              ),
            }
          }),
        }))
      },
      flushSync,
    }),
    [
      loading,
      store.commitments,
      store.placements,
      getPlacementsForDay,
      getCommitment,
      remainingSlots,
      poolSlots,
      updateStore,
      flushSync,
    ],
  )

  return (
    <WeekCommitmentContext.Provider value={value}>
      {children}
    </WeekCommitmentContext.Provider>
  )
}

export function useWeekCommitments(): WeekCommitmentActions {
  const ctx = useContext(WeekCommitmentContext)
  if (!ctx) {
    throw new Error('useWeekCommitments must be used within WeekCommitmentProvider')
  }
  return ctx
}

/** Safe optional access when provider may be absent (tests). */
export function useWeekCommitmentsOptional(): WeekCommitmentActions | null {
  return useContext(WeekCommitmentContext)
}
