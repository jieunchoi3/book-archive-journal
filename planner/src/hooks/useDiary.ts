import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiaryEntry, DiaryPhotoLayer } from '../types/diary'
import { DEFAULT_DIARY_FRAME_COLOR, emptyDiaryEntry } from '../types/diary'
import { downscaleToThumb, renderDiaryComposite } from '../lib/diaryImage'
import {
  backfillDiaryThumbs,
  hydrateDiaryEntry,
  loadDiaryEntriesForMonth,
  loadDiaryEntriesForMonthLocal,
  loadDiaryEntry,
  saveDiaryEntry,
} from '../lib/diaryStorage'
import { useAuth } from './useAuth'

type DiaryEntryPatch = Partial<
  Pick<DiaryEntry, 'title' | 'body' | 'layers' | 'frameColor' | 'canvasStrokes'>
>

function normalizeEntry(entry: DiaryEntry): DiaryEntry {
  return {
    ...entry,
    frameColor: entry.frameColor || DEFAULT_DIARY_FRAME_COLOR,
    canvasStrokes: entry.canvasStrokes ?? [],
  }
}

export interface DiaryActions {
  year: number
  month: number
  setViewMonth: (year: number, month: number) => void
  entriesByDate: Record<string, DiaryEntry>
  loading: boolean
  syncError: string | null
  getEntry: (dateKey: string) => DiaryEntry
  ensureHydrated: (dateKey: string) => Promise<DiaryEntry>
  upsertEntry: (dateKey: string, patch: DiaryEntryPatch) => Promise<DiaryEntry>
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
  const [entriesByDate, setEntriesByDate] = useState<Record<string, DiaryEntry>>({})
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingEntries = useRef<Record<string, DiaryEntry>>({})

  const flushSave = useCallback(
    async (entry: DiaryEntry) => {
      const key = entry.dateKey
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
      // Paint IndexedDB immediately so revisits aren't blank while cloud syncs.
      const local = await loadDiaryEntriesForMonthLocal(userId, year, month)
      const localNormalized: Record<string, DiaryEntry> = {}
      for (const [key, entry] of Object.entries(local)) {
        localNormalized[key] = normalizeEntry(entry)
      }
      if (Object.keys(localNormalized).length > 0) {
        setEntriesByDate(localNormalized)
        setLoading(false)
      }

      const map = await loadDiaryEntriesForMonth(userId, year, month)
      const normalized: Record<string, DiaryEntry> = {}
      for (const [key, entry] of Object.entries(map)) {
        normalized[key] = normalizeEntry(entry)
      }
      setEntriesByDate(normalized)
      setSyncError(null)
      setLoading(false)

      // Build/upload missing thumbs in the background (existing full covers).
      void backfillDiaryThumbs(userId, normalized, (dateKey, entry) => {
        setEntriesByDate((prev) => ({
          ...prev,
          [dateKey]: normalizeEntry(entry),
        }))
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

  // Flush pending cloud saves when leaving the diary tab / unmounting.
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

  const getEntry = useCallback(
    (dateKey: string) => entriesByDate[dateKey] ?? emptyDiaryEntry(dateKey),
    [entriesByDate],
  )

  const ensureHydrated = useCallback(
    async (dateKey: string) => {
      const current = normalizeEntry(
        entriesByDate[dateKey] ?? emptyDiaryEntry(dateKey),
      )
      if (!current.layers.some((l) => !l.src)) return current
      try {
        const hydrated = normalizeEntry(await hydrateDiaryEntry(userId, current))
        setEntriesByDate((prev) => ({ ...prev, [dateKey]: hydrated }))
        return hydrated
      } catch (e) {
        console.warn('[diary] hydrate failed', e)
        return current
      }
    },
    [entriesByDate, userId],
  )

  const persistDebounced = useCallback(
    (entry: DiaryEntry) => {
      const key = entry.dateKey
      pendingEntries.current[key] = entry
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(() => {
        void flushSave(entry)
      }, 400)
    },
    [flushSave],
  )

  const upsertEntry = useCallback(
    async (dateKey: string, patch: DiaryEntryPatch) => {
      let existing = normalizeEntry(
        entriesByDate[dateKey] ??
          (await loadDiaryEntry(userId, dateKey)) ??
          emptyDiaryEntry(dateKey),
      )
      if (existing.layers.some((l) => !l.src)) {
        existing = normalizeEntry(await hydrateDiaryEntry(userId, existing))
      }

      const nextLayers: DiaryPhotoLayer[] = patch.layers ?? existing.layers
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
        thumbDataUrl = coverDataUrl
          ? await downscaleToThumb(coverDataUrl)
          : null
      }

      const next: DiaryEntry = {
        ...existing,
        ...patch,
        layers: nextLayers,
        frameColor: nextFrameColor,
        canvasStrokes: nextCanvasStrokes,
        coverDataUrl,
        thumbDataUrl,
        dateKey,
        updatedAt: new Date().toISOString(),
      }

      setEntriesByDate((prev) => ({ ...prev, [dateKey]: next }))

      const touchesMedia =
        patch.layers !== undefined ||
        patch.frameColor !== undefined ||
        patch.canvasStrokes !== undefined
      if (touchesMedia) {
        // Photos must hit Supabase before the user can leave the tab.
        await flushSave(next)
      } else {
        persistDebounced(next)
      }
      return next
    },
    [entriesByDate, flushSave, persistDebounced, userId],
  )

  return {
    year: viewMonth.year,
    month: viewMonth.month,
    setViewMonth,
    entriesByDate,
    loading,
    syncError,
    getEntry,
    ensureHydrated,
    upsertEntry,
    refreshMonth,
  }
}
