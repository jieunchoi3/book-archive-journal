import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiaryEntry, DiaryPhotoLayer } from '../types/diary'
import {
  DEFAULT_DIARY_FRAME_COLOR,
  emptyDiaryEntry,
  ensureDiaryEntryId,
  isDiaryEntryEmpty,
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

function entryHasInlineMedia(entry: DiaryEntry): boolean {
  if (entry.coverDataUrl?.startsWith('data:')) return true
  if (entry.thumbDataUrl?.startsWith('data:')) return true
  if (entry.layers.some((l) => l.src.startsWith('data:'))) return true
  if ((entry.bodyImages ?? []).some((i) => i.src.startsWith('data:'))) return true
  return false
}

/** Keep in-flight / richer client edits when a cloud refresh races our save. */
function mergeDiaryEntryPreferClient(local: DiaryEntry, remote: DiaryEntry): DiaryEntry {
  const pending = entryHasInlineMedia(local)
  const localTs = Date.parse(local.updatedAt) || 0
  const remoteTs = Date.parse(remote.updatedAt) || 0
  if (localTs >= remoteTs || pending) {
    return {
      ...remote,
      title: local.title,
      body: local.body,
      tagFolders: local.tagFolders?.length ? local.tagFolders : remote.tagFolders,
      mainTag: local.mainTag ?? remote.mainTag,
      subTag: local.subTag ?? remote.subTag,
      layers: local.layers.some((l) => l.src) ? local.layers : remote.layers,
      bodyImages:
        (local.bodyImages?.length ?? 0) > 0 ? (local.bodyImages ?? []) : remote.bodyImages,
      frameColor: local.frameColor || remote.frameColor,
      canvasStrokes:
        (local.canvasStrokes?.length ?? 0) > 0 ? local.canvasStrokes : remote.canvasStrokes,
      coverDataUrl: local.coverDataUrl || remote.coverDataUrl,
      thumbDataUrl: local.thumbDataUrl || remote.thumbDataUrl,
      updatedAt: localTs >= remoteTs ? local.updatedAt : remote.updatedAt,
    }
  }
  return remote
}

function mergeMonthMaps(
  remote: Record<string, DiaryEntry[]>,
  prev: Record<string, DiaryEntry[]>,
  pending: Record<string, DiaryEntry>,
): Record<string, DiaryEntry[]> {
  const out: Record<string, DiaryEntry[]> = {}
  const dateKeys = new Set([...Object.keys(remote), ...Object.keys(prev)])

  for (const dateKey of dateKeys) {
    const byId = new Map<string, DiaryEntry>()
    for (const entry of remote[dateKey] ?? []) {
      byId.set(entry.id, entry)
    }
    for (const entry of prev[dateKey] ?? []) {
      const local = pending[entry.id] ?? entry
      const fromRemote = byId.get(entry.id)
      if (fromRemote) {
        byId.set(entry.id, mergeDiaryEntryPreferClient(local, fromRemote))
      } else if (pending[entry.id] || !isDiaryEntryEmpty(local)) {
        byId.set(entry.id, local)
      }
    }
    for (const entry of Object.values(pending)) {
      if (entry.dateKey !== dateKey) continue
      const existing = byId.get(entry.id)
      byId.set(
        entry.id,
        existing ? mergeDiaryEntryPreferClient(entry, existing) : entry,
      )
    }
    const list = [...byId.values()].sort(
      (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
    )
    if (list.length) out[dateKey] = list
  }
  return out
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
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingEntries = useRef<Set<string>>(new Set())

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
      pendingEntries.current[key] = entry
      savingEntries.current.add(key)
      setCloudSaveStatus('pending')
      try {
        await upsertDiaryV2Entry(userId, entry)
        delete pendingEntries.current[key]
        setSyncError(null)
        markCloudSaved()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Diary sync failed'
        console.error('[diary-v2] save failed', e)
        setSyncError(message)
        setCloudSaveStatus('error')
        throw e
      } finally {
        savingEntries.current.delete(key)
      }
    },
    [markCloudSaved, userId],
  )

  const refreshMonth = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background ?? false
    const gen = ++refreshGen.current
    if (!background) setLoading(true)
    const year = viewMonth.year
    const month = viewMonth.month
    try {
      const map = await fetchDiaryV2EntriesForMonth(userId, year, month)
      if (gen !== refreshGen.current) return
      const normalized: Record<string, DiaryEntry[]> = {}
      for (const [key, list] of Object.entries(map)) {
        normalized[key] = list.map(normalizeEntry)
      }
      setEntriesByDate((prev) =>
        mergeMonthMaps(normalized, prev, pendingEntries.current),
      )
      setSyncError(null)
    } catch (e) {
      console.error('[diary-v2] month refresh failed', e)
      setSyncError(e instanceof Error ? e.message : 'Could not load diary')
    } finally {
      if (gen === refreshGen.current && !background) setLoading(false)
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
          if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current)
          realtimeRefreshTimer.current = setTimeout(() => {
            void refreshMonth({ background: true })
          }, 500)
        },
      )
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshMonth({ background: true })
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
      const pending = pendingEntries.current[entryId]
      if (pending) return pending

      const fromState = findEntryInState(entryId)
      const layersNeedSrc =
        fromState?.layers.some((l) => !l.src && (l.strokes?.length ?? 0) === 0) ?? false
      const bodyImagesNeedSrc =
        fromState?.bodyImages?.some((i) => !i.src) ?? false
      if (
        fromState &&
        !layersNeedSrc &&
        !bodyImagesNeedSrc &&
        !savingEntries.current.has(entryId)
      ) {
        return fromState
      }

      const reloaded = await fetchDiaryV2Entry(userId, entryId)
      if (!fromState && !reloaded) {
        throw new Error(`Unknown diary entry ${entryId}`)
      }
      const base = normalizeEntry(reloaded ?? fromState!)
      const current =
        fromState && reloaded
          ? mergeDiaryEntryPreferClient(fromState, base)
          : base
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
      const existing = normalizeEntry(fromState ?? loaded!)

      const nextLayers: DiaryPhotoLayer[] = patch.layers ?? existing.layers
      const nextBodyImages = patch.bodyImages ?? existing.bodyImages ?? []
      const nextFrameColor = patch.frameColor ?? existing.frameColor
      const nextCanvasStrokes = patch.canvasStrokes ?? existing.canvasStrokes

      const instant: DiaryEntry = {
        ...existing,
        ...patch,
        layers: nextLayers,
        bodyImages: nextBodyImages,
        frameColor: nextFrameColor,
        canvasStrokes: nextCanvasStrokes,
        coverDataUrl: existing.coverDataUrl,
        thumbDataUrl: existing.thumbDataUrl ?? null,
        id: entryId,
        updatedAt: new Date().toISOString(),
      }

      pendingEntries.current[entryId] = instant
      setEntriesByDate((prev) => {
        const list = prev[instant.dateKey] ?? []
        return {
          ...prev,
          [instant.dateKey]: upsertInDayList(list, instant),
        }
      })

      const touchesMedia =
        patch.layers !== undefined ||
        patch.bodyImages !== undefined ||
        patch.frameColor !== undefined ||
        patch.canvasStrokes !== undefined

      const runCloudSave = async (entry: DiaryEntry) => {
        try {
          await flushSave(entry)
        } catch {
          // flushSave already surfaced syncError
        }
      }

      if (touchesMedia) {
        void (async () => {
          let coverDataUrl = instant.coverDataUrl
          let thumbDataUrl = instant.thumbDataUrl ?? null
          try {
            coverDataUrl = await renderDiaryComposite(
              nextLayers,
              1600,
              nextFrameColor,
              nextCanvasStrokes,
            )
            thumbDataUrl = coverDataUrl ? await downscaleToThumb(coverDataUrl) : null
          } catch (e) {
            console.warn('[diary-v2] cover render failed', e)
          }
          const withCover: DiaryEntry = {
            ...instant,
            coverDataUrl,
            thumbDataUrl,
          }
          pendingEntries.current[entryId] = withCover
          setEntriesByDate((prev) => {
            const list = prev[withCover.dateKey] ?? []
            return {
              ...prev,
              [withCover.dateKey]: upsertInDayList(list, withCover),
            }
          })
          await runCloudSave(withCover)
        })()
      } else {
        persistDebounced(instant)
      }

      return instant
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
