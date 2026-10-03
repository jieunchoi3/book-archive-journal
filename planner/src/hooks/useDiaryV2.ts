import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiaryEntry, DiaryPhotoLayer } from '../types/diary'
import {
  DEFAULT_DIARY_FRAME_COLOR,
  emptyDiaryEntry,
  ensureDiaryEntryId,
  pickPrimaryDiaryEntry,
} from '../types/diary'
import { applyTagFoldersToEntry, getEntryTagFolders } from '../lib/diaryTags'
import { downscaleToThumb, renderDiaryComposite } from '../lib/diaryImage'
import {
  deleteDiaryV2Entry,
  fetchDiaryV2EntriesForMonth,
  fetchDiaryV2Entry,
  upsertDiaryV2Entry,
} from '../lib/diaryV2Cloud'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { DiaryActions } from './useDiary'

type DiaryEntryPatch = Partial<
  Pick<
    DiaryEntry,
    | 'title'
    | 'body'
    | 'tagFolders'
    | 'mainTag'
    | 'subTag'
    | 'bodyImages'
    | 'layers'
    | 'frameColor'
    | 'canvasStrokes'
  >
>

function normalizeEntry(entry: DiaryEntry): DiaryEntry {
  const base = ensureDiaryEntryId(entry)
  const tagPatch = applyTagFoldersToEntry(getEntryTagFolders(base))
  return {
    ...base,
    ...tagPatch,
    bodyImages: base.bodyImages ?? [],
    frameColor: base.frameColor || DEFAULT_DIARY_FRAME_COLOR,
    canvasStrokes: base.canvasStrokes ?? [],
  }
}

function upsertInDayList(list: DiaryEntry[], next: DiaryEntry): DiaryEntry[] {
  const idx = list.findIndex((e) => e.id === next.id)
  if (idx === -1) return [next, ...list]
  const copy = list.slice()
  copy[idx] = next
  return copy
}

function removeFromDayList(
  map: Record<string, DiaryEntry[]>,
  dateKey: string,
  entryId: string,
): Record<string, DiaryEntry[]> {
  const list = map[dateKey] ?? []
  const nextList = list.filter((e) => e.id !== entryId)
  const copy = { ...map }
  if (nextList.length) copy[dateKey] = nextList
  else delete copy[dateKey]
  return copy
}

/** Supabase-first diary — no IndexedDB merge; realtime refresh across devices. */
export function useDiaryV2(initialYear?: number, initialMonth?: number): DiaryActions {
  const { user } = useAuth()
  const userId = user.id
  const today = new Date()
  const [viewMonth, setViewMonthState] = useState(() => ({
    year: initialYear ?? today.getFullYear(),
    month: initialMonth ?? today.getMonth(),
  }))
  const [entriesByDate, setEntriesByDate] = useState<Record<string, DiaryEntry[]>>({})
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [cloudSaveStatus, setCloudSaveStatus] = useState<
    'idle' | 'pending' | 'saved' | 'error'
  >('idle')
  const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingEntries = useRef<Record<string, DiaryEntry>>({})
  const refreshGen = useRef(0)

  const findEntryInState = useCallback(
    (entryId: string): DiaryEntry | null => {
      for (const list of Object.values(entriesByDate)) {
        const hit = list.find((e) => e.id === entryId)
        if (hit) return hit
      }
      return null
    },
    [entriesByDate],
  )

  const markCloudSaved = useCallback(() => {
    setCloudSaveStatus('saved')
    if (savedClearTimer.current) clearTimeout(savedClearTimer.current)
    savedClearTimer.current = setTimeout(() => setCloudSaveStatus('idle'), 4000)
  }, [])

  const flushSave = useCallback(
    async (entry: DiaryEntry) => {
      const key = entry.id
      if (saveTimers.current[key]) {
        clearTimeout(saveTimers.current[key])
        delete saveTimers.current[key]
      }
      delete pendingEntries.current[key]
      setCloudSaveStatus('pending')
      try {
        await upsertDiaryV2Entry(userId, entry)
        setSyncError(null)
        markCloudSaved()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Diary sync failed'
        console.error('[diary-v2] save failed', e)
        setSyncError(message)
        setCloudSaveStatus('error')
        throw e
      }
    },
    [markCloudSaved, userId],
  )

  const refreshMonth = useCallback(async () => {
    const gen = ++refreshGen.current
    setLoading(true)
    const year = viewMonth.year
    const month = viewMonth.month
    try {
      const map = await fetchDiaryV2EntriesForMonth(userId, year, month)
      if (gen !== refreshGen.current) return
      const normalized: Record<string, DiaryEntry[]> = {}
      for (const [key, list] of Object.entries(map)) {
        normalized[key] = list.map(normalizeEntry)
      }
      setEntriesByDate(normalized)
      setSyncError(null)
    } catch (e) {
      console.error('[diary-v2] month refresh failed', e)
      setSyncError(e instanceof Error ? e.message : 'Could not load diary')
    } finally {
      if (gen === refreshGen.current) setLoading(false)
    }
  }, [userId, viewMonth.year, viewMonth.month])

  useEffect(() => {
    void refreshMonth()
  }, [refreshMonth])

  useEffect(() => {
    const channel = supabase
      .channel(`diary-v2-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'planner',
          table: 'diary_v2_entries',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshMonth()
        },
      )
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshMonth()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshMonth, userId])

  useEffect(() => {
    const flushAll = () => {
      for (const entry of Object.values(pendingEntries.current)) {
        void upsertDiaryV2Entry(userId, entry).catch((e) =>
          console.error('[diary-v2] flush save failed', e),
        )
      }
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushAll()
    }
    window.addEventListener('pagehide', flushAll)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flushAll)
      document.removeEventListener('visibilitychange', onHide)
      for (const t of Object.values(saveTimers.current)) clearTimeout(t)
      flushAll()
    }
  }, [userId])

  const setViewMonth = useCallback((year: number, month: number) => {
    setViewMonthState({ year, month })
  }, [])

  const getEntriesForDay = useCallback(
    (dateKey: string) => entriesByDate[dateKey] ?? [],
    [entriesByDate],
  )

  const getEntry = useCallback(
    (dateKey: string) =>
      pickPrimaryDiaryEntry(entriesByDate[dateKey]) ?? emptyDiaryEntry(dateKey),
    [entriesByDate],
  )

  const getEntryById = useCallback(
    (entryId: string) => findEntryInState(entryId),
    [findEntryInState],
  )

  const repairGridImage = useCallback(
    async (entryId: string) => {
      try {
        const loaded = await fetchDiaryV2Entry(userId, entryId)
        if (!loaded) return
        const normalized = normalizeEntry(loaded)
        setEntriesByDate((prev) => {
          const list = prev[normalized.dateKey] ?? []
          return {
            ...prev,
            [normalized.dateKey]: upsertInDayList(list, normalized),
          }
        })
      } catch (e) {
        console.warn('[diary-v2] grid image repair failed', e)
      }
    },
    [userId],
  )

  const ensureHydrated = useCallback(
    async (entryId: string) => {
      const fromState = findEntryInState(entryId)
      const reloaded = await fetchDiaryV2Entry(userId, entryId)
      if (!fromState && !reloaded) {
        throw new Error(`Unknown diary entry ${entryId}`)
      }
      const current = normalizeEntry(reloaded ?? fromState!)
      setEntriesByDate((prev) => {
        const list = prev[current.dateKey] ?? []
        return {
          ...prev,
          [current.dateKey]: upsertInDayList(list, current),
        }
      })
      return current
    },
    [findEntryInState, userId],
  )

  const persistDebounced = useCallback(
    (entry: DiaryEntry) => {
      const key = entry.id
      pendingEntries.current[key] = entry
      setCloudSaveStatus('pending')
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(() => {
        void flushSave(entry)
      }, 400)
    },
    [flushSave],
  )

  const upsertEntry = useCallback(
    async (entryId: string, patch: DiaryEntryPatch) => {
      const fromState = findEntryInState(entryId)
      const loaded = fromState ? null : await fetchDiaryV2Entry(userId, entryId)
      if (!fromState && !loaded) {
        throw new Error(`Unknown diary entry ${entryId}`)
      }
      let existing = normalizeEntry(fromState ?? loaded!)

      const nextLayers: DiaryPhotoLayer[] = patch.layers ?? existing.layers
      const nextBodyImages = patch.bodyImages ?? existing.bodyImages ?? []
      const nextFrameColor = patch.frameColor ?? existing.frameColor
      const nextCanvasStrokes = patch.canvasStrokes ?? existing.canvasStrokes
      let coverDataUrl = existing.coverDataUrl
      let thumbDataUrl = existing.thumbDataUrl ?? null
      if (
        patch.layers !== undefined ||
        patch.frameColor !== undefined ||
        patch.canvasStrokes !== undefined
      ) {
        coverDataUrl = await renderDiaryComposite(
          nextLayers,
          1600,
          nextFrameColor,
          nextCanvasStrokes,
        )
        thumbDataUrl = coverDataUrl ? await downscaleToThumb(coverDataUrl) : null
      }

      const next: DiaryEntry = {
        ...existing,
        ...patch,
        layers: nextLayers,
        bodyImages: nextBodyImages,
        frameColor: nextFrameColor,
        canvasStrokes: nextCanvasStrokes,
        coverDataUrl,
        thumbDataUrl,
        id: entryId,
        updatedAt: new Date().toISOString(),
      }

      setEntriesByDate((prev) => {
        const list = prev[next.dateKey] ?? []
        return {
          ...prev,
          [next.dateKey]: upsertInDayList(list, next),
        }
      })

      const touchesMedia =
        patch.layers !== undefined ||
        patch.bodyImages !== undefined ||
        patch.frameColor !== undefined ||
        patch.canvasStrokes !== undefined
      if (touchesMedia) {
        await flushSave(next)
      } else {
        persistDebounced(next)
      }
      return next
    },
    [findEntryInState, flushSave, persistDebounced, userId],
  )

  const createEntry = useCallback(
    async (dateKey: string) => {
      const entry = normalizeEntry(emptyDiaryEntry(dateKey))
      setEntriesByDate((prev) => {
        const list = prev[dateKey] ?? []
        return { ...prev, [dateKey]: [entry, ...list] }
      })
      await upsertDiaryV2Entry(userId, entry)
      return entry
    },
    [userId],
  )

  const deleteEntry = useCallback(
    async (entryId: string) => {
      const existing = findEntryInState(entryId)
      if (!existing) return
      await deleteDiaryV2Entry(userId, entryId)
      setEntriesByDate((prev) => removeFromDayList(prev, existing.dateKey, entryId))
    },
    [findEntryInState, userId],
  )

  const uploadLocalDiaryToCloud = useCallback(async () => {
    await refreshMonth()
    return { pushed: 0 }
  }, [refreshMonth])

  return {
    year: viewMonth.year,
    month: viewMonth.month,
    setViewMonth,
    entriesByDate,
    loading,
    syncError,
    cloudSaveStatus,
    getEntriesForDay,
    getEntry,
    getEntryById,
    ensureHydrated,
    upsertEntry,
    createEntry,
    deleteEntry,
    refreshMonth,
    uploadLocalDiaryToCloud,
    repairGridImage,
  }
}
