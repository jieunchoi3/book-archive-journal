import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiaryEntry, DiaryPhotoLayer } from '../types/diary'
import { DEFAULT_DIARY_FRAME_COLOR, emptyDiaryEntry } from '../types/diary'
import { renderDiaryComposite } from '../lib/diaryImage'
import {
  hydrateDiaryEntry,
  loadDiaryEntriesForMonth,
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
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const refreshMonth = useCallback(async () => {
    setLoading(true)
    try {
      const map = await loadDiaryEntriesForMonth(userId, viewMonth.year, viewMonth.month)
      const normalized: Record<string, DiaryEntry> = {}
      for (const [key, entry] of Object.entries(map)) {
        normalized[key] = normalizeEntry(entry)
      }
      setEntriesByDate(normalized)
    } finally {
      setLoading(false)
    }
  }, [userId, viewMonth.year, viewMonth.month])

  useEffect(() => {
    void refreshMonth()
  }, [refreshMonth])

  useEffect(() => {
    return () => {
      for (const t of Object.values(saveTimers.current)) clearTimeout(t)
    }
  }, [])

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

  const persist = useCallback(
    (entry: DiaryEntry) => {
      const key = entry.dateKey
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(() => {
        void saveDiaryEntry(userId, entry).catch((e) =>
          console.error('[diary] save failed', e),
        )
      }, 400)
    },
    [userId],
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
      }

      const next: DiaryEntry = {
        ...existing,
        ...patch,
        layers: nextLayers,
        frameColor: nextFrameColor,
        canvasStrokes: nextCanvasStrokes,
        coverDataUrl,
        dateKey,
        updatedAt: new Date().toISOString(),
      }

      setEntriesByDate((prev) => ({ ...prev, [dateKey]: next }))
      persist(next)
      return next
    },
    [entriesByDate, persist, userId],
  )

  return {
    year: viewMonth.year,
    month: viewMonth.month,
    setViewMonth,
    entriesByDate,
    loading,
    getEntry,
    ensureHydrated,
    upsertEntry,
    refreshMonth,
  }
}
