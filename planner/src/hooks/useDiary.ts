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
  backfillDiaryThumbs,
  deleteDiaryEntry,
  hydrateDiaryEntry,
  loadDiaryEntriesForMonth,
  loadDiaryEntriesForMonthLocal,
  loadDiaryEntryById,
  saveDiaryEntry,
} from '../lib/diaryStorage'
import { useAuth } from './useAuth'

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

export interface DiaryActions {
  year: number
  month: number
  setViewMonth: (year: number, month: number) => void
  entriesByDate: Record<string, DiaryEntry[]>
  loading: boolean
  syncError: string | null
  getEntriesForDay: (dateKey: string) => DiaryEntry[]
  getEntry: (dateKey: string) => DiaryEntry
  getEntryById: (entryId: string) => DiaryEntry | null
  ensureHydrated: (entryId: string) => Promise<DiaryEntry>
  upsertEntry: (entryId: string, patch: DiaryEntryPatch) => Promise<DiaryEntry>
  createEntry: (dateKey: string) => Promise<DiaryEntry>
  deleteEntry: (entryId: string) => Promise<void>
  refreshMonth: () => Promise<void>
}

export function useDiary(initialYear?: number, initialMonth?: number): DiaryActions {
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
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingEntries = useRef<Record<string, DiaryEntry>>({})

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

  const flushSave = useCallback(
    async (entry: DiaryEntry) => {
      const key = entry.id
      if (saveTimers.current[key]) {
        clearTimeout(saveTimers.current[key])
        delete saveTimers.current[key]
      }
      delete pendingEntries.current[key]
      try {
        await saveDiaryEntry(userId, entry)
        setSyncError(null)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Diary sync failed'
        console.error('[diary] save failed', e)
        setSyncError(message)
        throw e
      }
    },
    [userId],
  )

  const refreshMonth = useCallback(async () => {
    setLoading(true)
    const year = viewMonth.year
    const month = viewMonth.month
    try {
      const local = await loadDiaryEntriesForMonthLocal(userId, year, month)
      const localNormalized: Record<string, DiaryEntry[]> = {}
      for (const [key, list] of Object.entries(local)) {
        localNormalized[key] = list.map(normalizeEntry)
      }
      if (Object.keys(localNormalized).length > 0) {
        setEntriesByDate(localNormalized)
        setLoading(false)
      }

      const map = await loadDiaryEntriesForMonth(userId, year, month)
      const normalized: Record<string, DiaryEntry[]> = {}
      for (const [key, list] of Object.entries(map)) {
        normalized[key] = list.map(normalizeEntry)
      }
      setEntriesByDate(normalized)
      setSyncError(null)
      setLoading(false)

      void backfillDiaryThumbs(userId, normalized, (entry) => {
        setEntriesByDate((prev) => {
          const list = prev[entry.dateKey] ?? []
          return {
            ...prev,
            [entry.dateKey]: upsertInDayList(list, normalizeEntry(entry)),
          }
        })
      })
    } catch (e) {
      console.error('[diary] month refresh failed', e)
      setSyncError(e instanceof Error ? e.message : 'Could not load diary')
      setLoading(false)
    }
  }, [userId, viewMonth.year, viewMonth.month])

  useEffect(() => {
    void refreshMonth()
  }, [refreshMonth])

  useEffect(() => {
    const flushAll = () => {
      const pending = Object.values(pendingEntries.current)
      for (const entry of pending) {
        void saveDiaryEntry(userId, entry).catch((e) =>
          console.error('[diary] flush save failed', e),
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

  const ensureHydrated = useCallback(
    async (entryId: string) => {
      const fromState = findEntryInState(entryId)
      const loaded = fromState ? null : await loadDiaryEntryById(userId, entryId)
      if (!fromState && !loaded) {
        throw new Error(`Unknown diary entry ${entryId}`)
      }
      const current = normalizeEntry(fromState ?? loaded!)
      if (
        !current.layers.some((l) => !l.src) &&
        !(current.bodyImages ?? []).some((i) => !i.src)
      ) {
        return current
      }
      try {
        const hydrated = normalizeEntry(await hydrateDiaryEntry(userId, current))
        setEntriesByDate((prev) => {
          const list = prev[hydrated.dateKey] ?? []
          return {
            ...prev,
            [hydrated.dateKey]: upsertInDayList(list, hydrated),
          }
        })
        return hydrated
      } catch (e) {
        console.warn('[diary] hydrate failed', e)
        return current
      }
    },
    [findEntryInState, userId],
  )

  const persistDebounced = useCallback(
    (entry: DiaryEntry) => {
      const key = entry.id
      pendingEntries.current[key] = entry
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
      const loaded = fromState ? null : await loadDiaryEntryById(userId, entryId)
      if (!fromState && !loaded) {
        throw new Error(`Unknown diary entry ${entryId}`)
      }
      let existing = normalizeEntry(fromState ?? loaded!)
      if (
        existing.layers.some((l) => !l.src) ||
        (existing.bodyImages ?? []).some((i) => !i.src)
      ) {
        existing = normalizeEntry(await hydrateDiaryEntry(userId, existing))
      }

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
      return entry
    },
    [],
  )

  const deleteEntry = useCallback(
    async (entryId: string) => {
      const existing = findEntryInState(entryId)
      if (!existing) return
      await deleteDiaryEntry(userId, existing)
      setEntriesByDate((prev) => {
        const list = prev[existing.dateKey] ?? []
        const nextList = list.filter((e) => e.id !== entryId)
        const copy = { ...prev }
        if (nextList.length) copy[existing.dateKey] = nextList
        else delete copy[existing.dateKey]
        return copy
      })
    },
    [findEntryInState, userId],
  )

  return {
    year: viewMonth.year,
    month: viewMonth.month,
    setViewMonth,
    entriesByDate,
    loading,
    syncError,
    getEntriesForDay,
    getEntry,
    getEntryById,
    ensureHydrated,
    upsertEntry,
    createEntry,
    deleteEntry,
    refreshMonth,
  }
}
