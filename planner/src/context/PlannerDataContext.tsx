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
import type { User } from '@supabase/supabase-js'
import type {
  Block,
  BlockDayLog,
  DayKey,
  OneOffTask,
  RenderTask,
  TaskTemplate,
  WeekTemplate,
  WeeklyLog,
} from '../types/planner'
import type { Category, Item, ItemDone, ItemOccurrence, Tag } from '../types/item'
import {
  getItemDone,
  isRecurringItem,
  nextCategoryColor,
  NO_CATEGORY_ID,
} from '../types/item'
import type { LinkedApp } from '../types/linkedApp'
import { expandItemsForWeek } from '../lib/itemRecurrence'
import {
  fetchItemsStore,
  fetchLinkedApps,
  fetchTemplate,
  fetchWeeklyLog,
  importAllFromLocal,
  seedDefaultTemplate,
  syncItemsStore,
  syncLinkedApps,
  syncTemplate,
  upsertBlockWeekLog,
  upsertOneOffTask,
  deleteOneOffTaskRow,
  upsertTaskCompletion,
} from '../lib/supabaseRepository'
import {
  clearPlannerLocalData,
  hasLocalPlannerData,
  isLocalImportDone,
  loadAllWeeklyLogsLegacy,
  loadItemsStoreFromLegacy,
  loadLinkedAppsLegacy,
  loadTemplateLegacy,
  markLocalImportDone,
} from '../lib/localStorageLegacy'
import { emptyWeeklyLog } from '../lib/storageUtils'
import { logError } from '../lib/formatError'
import {
  getHiddenBlockTasks,
  getVisibleBlockTasks,
  isBlockCompleteForDay as isBlockComplete,
} from '../lib/blockTasks'
import { generateId, getCurrentWeekStart, getDateKeyForDay } from '../lib/weekUtils'
import { SEED_TEMPLATE } from '../data/seedTemplate'

function normalizeOrders(blocks: Block[]): Block[] {
  return blocks.map((b, i) => ({ ...b, order: i }))
}

function emptyBlockLog(): BlockDayLog {
  return { taskCompletion: {} }
}

interface PlannerDataContextValue {
  user: User
  loading: boolean
  loadingWeek: boolean
  showImportBanner: boolean
  importing: boolean
  importLocalData: () => Promise<void>
  signOut: () => void
  template: WeekTemplate
  weekStart: string
  weeklyLog: WeeklyLog
  getBlockLog: (dayKey: DayKey, blockId: string) => BlockDayLog
  getBlockTasks: (dayKey: DayKey, block: Block) => RenderTask[]
  getOneOffTasks: (dayKey: DayKey, blockId: string) => OneOffTask[]
  toggleTask: (
    dayKey: DayKey,
    blockId: string,
    taskId: string,
    kind: 'recurring' | 'one-off',
  ) => void
  toggleHideTask: (
    dayKey: DayKey,
    blockId: string,
    taskId: string,
    kind: 'recurring' | 'one-off',
  ) => void
  isBlockCompleteForDay: (dayKey: DayKey, block: Block) => boolean
  getHiddenBlockTasks: (dayKey: DayKey, block: Block) => RenderTask[]
  setFlexibleNote: (dayKey: DayKey, blockId: string, note: string) => void
  addTask: (dayKey: DayKey, blockId: string, label: string, recurring: boolean) => void
  deleteRecurringTask: (
    dayKey: DayKey,
    blockId: string,
    taskId: string,
    scope: 'week' | 'template',
  ) => void
  deleteOneOffTask: (dayKey: DayKey, blockId: string, taskId: string) => void
  renameOneOffTask: (
    dayKey: DayKey,
    blockId: string,
    taskId: string,
    label: string,
  ) => void
  renameRecurringTask: (
    dayKey: DayKey,
    blockId: string,
    taskId: string,
    label: string,
  ) => void
  updateBlock: (dayKey: DayKey, updated: Block) => void
  deleteBlock: (dayKey: DayKey, blockId: string) => void
  addBlock: (dayKey: DayKey) => string
  reorderBlocks: (dayKey: DayKey, blockIds: string[]) => void
  goToWeek: (newWeekStart: string) => Promise<void>
  dayCompletion: Record<DayKey, { done: number; total: number }>
  weekCompletionPercent: number
  categories: Category[]
  tags: Tag[]
  items: Item[]
  itemsByDay: Record<DayKey, ItemOccurrence[]>
  getItemsForDay: (dayKey: DayKey) => ItemOccurrence[]
  getCategory: (id: string | null) => Category | null
  getTag: (id: string) => Tag | null
  addCategory: (name: string) => string
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void
  addTag: (name: string, icon?: string) => string
  updateTag: (id: string, updates: Partial<Tag>) => void
  deleteTag: (id: string) => void
  addItem: (item: Omit<Item, 'id' | 'done'>) => string
  updateItem: (id: string, updates: Partial<Item>) => void
  deleteItem: (id: string) => void
  toggleItemDone: (itemId: string, dateKey?: string) => void
  filterItems: (list: Item[], categoryFilter: string | null, tagFilters: string[]) => Item[]
  getColumnItems: (
    categoryId: string | null,
    categoryFilter: string | null,
    tagFilters: string[],
  ) => Item[]
  getColumnStats: (columnItems: Item[]) => { done: number; total: number }
  linkedApps: LinkedApp[]
  addLinkedApp: (app: Omit<LinkedApp, 'id'>) => string
  updateLinkedApp: (id: string, updates: Partial<LinkedApp>) => void
  deleteLinkedApp: (id: string) => void
  openLinkedApp: (app: LinkedApp) => LinkedApp | null
}

const PlannerDataContext = createContext<PlannerDataContextValue | null>(null)

export function PlannerDataProvider({
  user,
  onSignOut,
  children,
}: {
  user: User
  onSignOut: () => void
  children: ReactNode
}) {
  const userId = user.id
  const [loading, setLoading] = useState(true)
  const [loadingWeek, setLoadingWeek] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showImportBanner, setShowImportBanner] = useState(false)

  const [template, setTemplate] = useState<WeekTemplate>(structuredClone(SEED_TEMPLATE))
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart)
  const [weeklyLog, setWeeklyLog] = useState<WeeklyLog>(() => emptyWeeklyLog(getCurrentWeekStart()))
  const [itemsStore, setItemsStore] = useState<{ categories: Category[]; tags: Tag[]; items: Item[] }>({
    categories: [],
    tags: [],
    items: [],
  })
  const [linkedApps, setLinkedApps] = useState<LinkedApp[]>([])

  const templateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockLogTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const templateSyncQueue = useRef<Promise<void>>(Promise.resolve())
  const itemsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const templateRef = useRef(template)
  const weeklyLogRef = useRef(weeklyLog)
  const weekStartRef = useRef(weekStart)
  const weekLoadGeneration = useRef(0)
  const pendingBlockLogWrite = useRef<{
    dayKey: DayKey
    blockId: string
    blockLog: BlockDayLog
  } | null>(null)

  useEffect(() => {
    templateRef.current = template
  }, [template])

  useEffect(() => {
    weeklyLogRef.current = weeklyLog
  }, [weeklyLog])

  useEffect(() => {
    weekStartRef.current = weekStart
  }, [weekStart])

  /** Serialize template writes (recurring task adds, block edits). */
  const enqueueTemplateSync = useCallback(
    (tmpl: WeekTemplate): Promise<void> => {
      if (templateTimer.current) {
        clearTimeout(templateTimer.current)
        templateTimer.current = null
      }
      templateRef.current = tmpl

      const job = templateSyncQueue.current.then(() => syncTemplate(userId, tmpl))
      templateSyncQueue.current = job.catch((e) => logError('syncTemplate', e))
      return templateSyncQueue.current
    },
    [userId],
  )

  const awaitTemplateSync = useCallback(async (): Promise<void> => {
    if (templateTimer.current) {
      clearTimeout(templateTimer.current)
      templateTimer.current = null
      enqueueTemplateSync(templateRef.current)
    }
    await templateSyncQueue.current
  }, [enqueueTemplateSync])

  const flushBlockLogWrite = useCallback((): void => {
    if (blockLogTimer.current) {
      clearTimeout(blockLogTimer.current)
      blockLogTimer.current = null
    }
    const pending = pendingBlockLogWrite.current
    pendingBlockLogWrite.current = null
    if (!pending) return
    void upsertBlockWeekLog(
      userId,
      weekStartRef.current,
      pending.dayKey,
      pending.blockId,
      pending.blockLog,
    ).catch((e) => logError('upsertBlockWeekLog', e))
  }, [userId])

  const persistBlockWeekLogDebounced = useCallback(
    (dayKey: DayKey, blockId: string, blockLog: BlockDayLog) => {
      pendingBlockLogWrite.current = { dayKey, blockId, blockLog }
      if (blockLogTimer.current) clearTimeout(blockLogTimer.current)
      blockLogTimer.current = setTimeout(() => {
        blockLogTimer.current = null
        flushBlockLogWrite()
      }, 300)
    },
    [flushBlockLogWrite],
  )

  const loadWeeklyLog = useCallback(
    async (targetWeekStart: string): Promise<WeeklyLog> => {
      return fetchWeeklyLog(userId, targetWeekStart)
    },
    [userId],
  )

  const persistTemplate = useCallback(
    (t: WeekTemplate) => {
      templateRef.current = t
      if (templateTimer.current) clearTimeout(templateTimer.current)
      templateTimer.current = setTimeout(() => {
        templateTimer.current = null
        void enqueueTemplateSync(templateRef.current)
      }, 400)
    },
    [enqueueTemplateSync],
  )

  const persistItems = useCallback(
    (store: typeof itemsStore) => {
      if (itemsTimer.current) clearTimeout(itemsTimer.current)
      itemsTimer.current = setTimeout(() => {
        syncItemsStore(userId, store).catch((e) => logError('syncItemsStore', e))
      }, 400)
    },
    [userId],
  )

  const persistApps = useCallback(
    (apps: LinkedApp[]) => {
      if (appsTimer.current) clearTimeout(appsTimer.current)
      appsTimer.current = setTimeout(() => {
        syncLinkedApps(userId, apps).catch((e) => logError('syncLinkedApps', e))
      }, 400)
    },
    [userId],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [tmpl, log, store, apps] = await Promise.all([
          fetchTemplate(userId),
          loadWeeklyLog(getCurrentWeekStart()),
          fetchItemsStore(userId),
          fetchLinkedApps(userId),
        ])
        if (cancelled) return
        let finalTemplate = tmpl
        if (!finalTemplate) {
          finalTemplate = await seedDefaultTemplate(userId)
        }
        setTemplate(finalTemplate)
        setWeeklyLog(log)
        setWeekStart(getCurrentWeekStart())
        setItemsStore(store)
        setLinkedApps(apps)
        setShowImportBanner(hasLocalPlannerData() && !isLocalImportDone())
      } catch (e) {
        if (!cancelled) logError('loadPlannerData', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, loadWeeklyLog])

  const importLocalData = useCallback(async () => {
    setImporting(true)
    try {
      await importAllFromLocal(userId, {
        template: loadTemplateLegacy(),
        weeklyLogs: loadAllWeeklyLogsLegacy(),
        itemsStore: loadItemsStoreFromLegacy(),
        linkedApps: loadLinkedAppsLegacy(),
      })
      markLocalImportDone()
      clearPlannerLocalData()
      const [tmpl, store, apps] = await Promise.all([
        fetchTemplate(userId),
        fetchItemsStore(userId),
        fetchLinkedApps(userId),
      ])
      if (tmpl) setTemplate(tmpl)
      setItemsStore(store)
      setLinkedApps(apps)
      setWeeklyLog(await loadWeeklyLog(weekStart))
      setShowImportBanner(false)
    } catch (e) {
      logError('importLocalData', e)
    } finally {
      setImporting(false)
    }
  }, [userId, weekStart, loadWeeklyLog])

  const goToWeek = useCallback(
    async (newWeekStart: string) => {
      if (newWeekStart === weekStartRef.current) return

      const loadId = ++weekLoadGeneration.current
      setLoadingWeek(true)

      flushBlockLogWrite()

      // Optimistic UI — week label updates immediately; per-row upserts need no flush queue.
      weekStartRef.current = newWeekStart
      setWeekStart(newWeekStart)
      const placeholder = emptyWeeklyLog(newWeekStart)
      weeklyLogRef.current = placeholder
      setWeeklyLog(placeholder)

      void awaitTemplateSync()

      try {
        const log = await loadWeeklyLog(newWeekStart)
        if (weekStartRef.current !== newWeekStart) return
        weeklyLogRef.current = log
        setWeeklyLog(log)
      } catch (e) {
        logError('goToWeek', e)
        if (weekStartRef.current === newWeekStart) {
          setWeeklyLog(emptyWeeklyLog(newWeekStart))
        }
      } finally {
        if (loadId === weekLoadGeneration.current) {
          setLoadingWeek(false)
        }
      }
    },
    [flushBlockLogWrite, awaitTemplateSync, loadWeeklyLog],
  )

  const getBlockLog = useCallback(
    (dayKey: DayKey, blockId: string) => weeklyLog.days[dayKey]?.[blockId] ?? emptyBlockLog(),
    [weeklyLog],
  )

  const getOneOffTasks = useCallback(
    (dayKey: DayKey, blockId: string) => {
      const dateKey = getDateKeyForDay(weekStart, dayKey)
      return weeklyLog.oneOffByDate[dateKey]?.[blockId] ?? []
    },
    [weeklyLog, weekStart],
  )

  const getBlockTasks = useCallback(
    (dayKey: DayKey, block: Block): RenderTask[] => {
      const blockLog = getBlockLog(dayKey, block.id)
      return getVisibleBlockTasks(block, blockLog, getOneOffTasks(dayKey, block.id))
    },
    [getBlockLog, getOneOffTasks],
  )

  const getHiddenBlockTasksForBlock = useCallback(
    (dayKey: DayKey, block: Block): RenderTask[] => {
      const blockLog = getBlockLog(dayKey, block.id)
      return getHiddenBlockTasks(block, blockLog, getOneOffTasks(dayKey, block.id))
    },
    [getBlockLog, getOneOffTasks],
  )

  const isBlockCompleteForDayFn = useCallback(
    (dayKey: DayKey, block: Block): boolean => {
      const blockLog = getBlockLog(dayKey, block.id)
      return isBlockComplete(block, blockLog, getOneOffTasks(dayKey, block.id))
    },
    [getBlockLog, getOneOffTasks],
  )

  const updateTemplate = useCallback(
    (updater: (prev: WeekTemplate) => WeekTemplate) => {
      setTemplate((prev) => {
        const next = updater(prev)
        persistTemplate(next)
        return next
      })
    },
    [persistTemplate],
  )

  const setFlexibleNote = useCallback(
    (dayKey: DayKey, blockId: string, note: string) => {
      setWeeklyLog((prev) => {
        const base = { ...prev, weekStart: weekStartRef.current }
        const dayLog = base.days[dayKey] ?? {}
        const blockLog = dayLog[blockId] ?? emptyBlockLog()
        const nextBlockLog = { ...blockLog, flexibleNote: note }
        const next: WeeklyLog = {
          ...base,
          days: {
            ...base.days,
            [dayKey]: { ...dayLog, [blockId]: nextBlockLog },
          },
        }
        weeklyLogRef.current = next
        persistBlockWeekLogDebounced(dayKey, blockId, nextBlockLog)
        return next
      })
    },
    [persistBlockWeekLogDebounced],
  )

  const toggleTask = useCallback(
    (dayKey: DayKey, blockId: string, taskId: string, kind: 'recurring' | 'one-off') => {
      const week = weekStartRef.current
      if (kind === 'one-off') {
        const dateKey = getDateKeyForDay(week, dayKey)
        const tasks = weeklyLogRef.current.oneOffByDate[dateKey]?.[blockId] ?? []
        const task = tasks.find((t) => t.id === taskId)
        if (!task) return
        const done = !task.done
        setWeeklyLog((prev) => {
          const base = { ...prev, weekStart: week }
          const dateMap = base.oneOffByDate[dateKey] ?? {}
          const next: WeeklyLog = {
            ...base,
            oneOffByDate: {
              ...base.oneOffByDate,
              [dateKey]: {
                ...dateMap,
                [blockId]: (dateMap[blockId] ?? []).map((t) =>
                  t.id === taskId ? { ...t, done } : t,
                ),
              },
            },
          }
          weeklyLogRef.current = next
          return next
        })
        void upsertOneOffTask(userId, { ...task, done }, dateKey, blockId).catch((e) =>
          logError('upsertOneOffTask', e),
        )
        return
      }

      const blockLog = weeklyLogRef.current.days[dayKey]?.[blockId] ?? emptyBlockLog()
      const done = !(blockLog.taskCompletion[taskId] ?? false)
      setWeeklyLog((prev) => {
        const base = { ...prev, weekStart: week }
        const dayLog = base.days[dayKey] ?? {}
        const currentBlockLog = dayLog[blockId] ?? emptyBlockLog()
        const next: WeeklyLog = {
          ...base,
          days: {
            ...base.days,
            [dayKey]: {
              ...dayLog,
              [blockId]: {
                ...currentBlockLog,
                taskCompletion: { ...currentBlockLog.taskCompletion, [taskId]: done },
              },
            },
          },
        }
        weeklyLogRef.current = next
        return next
      })
      void upsertTaskCompletion(userId, week, dayKey, blockId, taskId, done).catch((e) =>
        logError('upsertTaskCompletion', e),
      )
    },
    [userId],
  )

  const toggleHideTask = useCallback(
    (dayKey: DayKey, blockId: string, taskId: string, _kind: 'recurring' | 'one-off') => {
      const week = weekStartRef.current
      const dayLog = weeklyLogRef.current.days[dayKey] ?? {}
      const blockLog = dayLog[blockId] ?? emptyBlockLog()
      const hidden = new Set(blockLog.hiddenTasks ?? [])
      if (hidden.has(taskId)) hidden.delete(taskId)
      else hidden.add(taskId)
      const nextBlockLog = { ...blockLog, hiddenTasks: [...hidden] }
      setWeeklyLog((prev) => {
        const base = { ...prev, weekStart: week }
        const prevDayLog = base.days[dayKey] ?? {}
        const next: WeeklyLog = {
          ...base,
          days: {
            ...base.days,
            [dayKey]: { ...prevDayLog, [blockId]: nextBlockLog },
          },
        }
        weeklyLogRef.current = next
        return next
      })
      void upsertBlockWeekLog(userId, week, dayKey, blockId, nextBlockLog).catch((e) =>
        logError('upsertBlockWeekLog', e),
      )
    },
    [userId],
  )

  const addTask = useCallback(
    (dayKey: DayKey, blockId: string, label: string, recurring: boolean) => {
      if (recurring) {
        const task: TaskTemplate = { id: generateId(), label }
        setTemplate((prev) => {
          const next: WeekTemplate = {
            days: prev.days.map((d) =>
              d.key === dayKey
                ? {
                    ...d,
                    blocks: d.blocks.map((b) =>
                      b.id === blockId ? { ...b, tasks: [...b.tasks, task] } : b,
                    ),
                  }
                : d,
            ),
          }
          if (templateTimer.current) clearTimeout(templateTimer.current)
          templateTimer.current = null
          void enqueueTemplateSync(next)
          return next
        })
        return
      }

      const dateKey = getDateKeyForDay(weekStartRef.current, dayKey)
      const task: OneOffTask = { id: generateId(), label, done: false }
      setWeeklyLog((prev) => {
        const base = { ...prev, weekStart: weekStartRef.current }
        const dateMap = base.oneOffByDate[dateKey] ?? {}
        const existing = dateMap[blockId] ?? []
        const next: WeeklyLog = {
          ...base,
          oneOffByDate: {
            ...base.oneOffByDate,
            [dateKey]: { ...dateMap, [blockId]: [...existing, task] },
          },
        }
        weeklyLogRef.current = next
        return next
      })
      void upsertOneOffTask(userId, task, dateKey, blockId).catch((e) =>
        logError('upsertOneOffTask', e),
      )
    },
    [enqueueTemplateSync, userId],
  )

  const deleteRecurringTask = useCallback(
    (dayKey: DayKey, blockId: string, taskId: string, scope: 'week' | 'template') => {
      if (scope === 'template') {
        setTemplate((prev) => {
          const next: WeekTemplate = {
            days: prev.days.map((d) =>
              d.key === dayKey
                ? {
                    ...d,
                    blocks: d.blocks.map((b) =>
                      b.id === blockId
                        ? { ...b, tasks: b.tasks.filter((t) => t.id !== taskId) }
                        : b,
                    ),
                  }
                : d,
            ),
          }
          void enqueueTemplateSync(next)
          return next
        })
        return
      }
      const week = weekStartRef.current
      const dayLog = weeklyLogRef.current.days[dayKey] ?? {}
      const blockLog = dayLog[blockId] ?? emptyBlockLog()
      const hidden = blockLog.hiddenRecurringTasks ?? []
      if (hidden.includes(taskId)) return
      const nextBlockLog = { ...blockLog, hiddenRecurringTasks: [...hidden, taskId] }
      setWeeklyLog((prev) => {
        const base = { ...prev, weekStart: week }
        const prevDayLog = base.days[dayKey] ?? {}
        const next: WeeklyLog = {
          ...base,
          days: {
            ...base.days,
            [dayKey]: { ...prevDayLog, [blockId]: nextBlockLog },
          },
        }
        weeklyLogRef.current = next
        return next
      })
      void upsertBlockWeekLog(userId, week, dayKey, blockId, nextBlockLog).catch((e) =>
        logError('upsertBlockWeekLog', e),
      )
    },
    [enqueueTemplateSync, userId],
  )

  const deleteOneOffTask = useCallback(
    (dayKey: DayKey, blockId: string, taskId: string) => {
      const dateKey = getDateKeyForDay(weekStartRef.current, dayKey)
      setWeeklyLog((prev) => {
        const base = { ...prev, weekStart: weekStartRef.current }
        const dateMap = base.oneOffByDate[dateKey] ?? {}
        const tasks = dateMap[blockId] ?? []
        const next: WeeklyLog = {
          ...base,
          oneOffByDate: {
            ...base.oneOffByDate,
            [dateKey]: { ...dateMap, [blockId]: tasks.filter((t) => t.id !== taskId) },
          },
        }
        weeklyLogRef.current = next
        return next
      })
      void deleteOneOffTaskRow(userId, taskId).catch((e) => logError('deleteOneOffTaskRow', e))
    },
    [userId],
  )

  const renameOneOffTask = useCallback(
    (dayKey: DayKey, blockId: string, taskId: string, label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      const dateKey = getDateKeyForDay(weekStartRef.current, dayKey)
      const tasks = weeklyLogRef.current.oneOffByDate[dateKey]?.[blockId] ?? []
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const updated = { ...task, label: trimmed }
      setWeeklyLog((prev) => {
        const base = { ...prev, weekStart: weekStartRef.current }
        const dateMap = base.oneOffByDate[dateKey] ?? {}
        const next: WeeklyLog = {
          ...base,
          oneOffByDate: {
            ...base.oneOffByDate,
            [dateKey]: {
              ...dateMap,
              [blockId]: (dateMap[blockId] ?? []).map((t) =>
                t.id === taskId ? updated : t,
              ),
            },
          },
        }
        weeklyLogRef.current = next
        return next
      })
      void upsertOneOffTask(userId, updated, dateKey, blockId).catch((e) =>
        logError('upsertOneOffTask', e),
      )
    },
    [userId],
  )

  const renameRecurringTask = useCallback(
    (dayKey: DayKey, blockId: string, taskId: string, label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      setTemplate((prev) => {
        const next: WeekTemplate = {
          days: prev.days.map((d) =>
            d.key === dayKey
              ? {
                  ...d,
                  blocks: d.blocks.map((b) =>
                    b.id === blockId
                      ? {
                          ...b,
                          tasks: b.tasks.map((t) =>
                            t.id === taskId ? { ...t, label: trimmed } : t,
                          ),
                        }
                      : b,
                  ),
                }
              : d,
          ),
        }
        void enqueueTemplateSync(next)
        return next
      })
    },
    [enqueueTemplateSync],
  )

  const updateBlock = useCallback(
    (dayKey: DayKey, updated: Block) => {
      updateTemplate((prev) => ({
        days: prev.days.map((d) =>
          d.key === dayKey
            ? {
                ...d,
                blocks: normalizeOrders(
                  d.blocks.map((b) => (b.id === updated.id ? updated : b)),
                ),
              }
            : d,
        ),
      }))
    },
    [updateTemplate],
  )

  const deleteBlock = useCallback(
    (dayKey: DayKey, blockId: string) => {
      updateTemplate((prev) => ({
        days: prev.days.map((d) =>
          d.key === dayKey
            ? { ...d, blocks: normalizeOrders(d.blocks.filter((b) => b.id !== blockId)) }
            : d,
        ),
      }))
    },
    [updateTemplate],
  )

  const addBlock = useCallback(
    (dayKey: DayKey) => {
      const newBlock: Block = {
        id: generateId(),
        title: 'New Block',
        category: 'free',
        timeRangeLabel: '',
        description: '',
        badges: [],
        tasks: [],
        order: 999,
      }
      updateTemplate((prev) => ({
        days: prev.days.map((d) =>
          d.key === dayKey
            ? { ...d, blocks: normalizeOrders([...d.blocks, newBlock]) }
            : d,
        ),
      }))
      return newBlock.id
    },
    [updateTemplate],
  )

  const reorderBlocks = useCallback(
    (dayKey: DayKey, blockIds: string[]) => {
      updateTemplate((prev) => ({
        days: prev.days.map((d) => {
          if (d.key !== dayKey) return d
          const map = new Map(d.blocks.map((b) => [b.id, b]))
          const reordered = blockIds
            .map((id) => map.get(id))
            .filter((b): b is Block => b !== undefined)
          return { ...d, blocks: normalizeOrders(reordered) }
        }),
      }))
    },
    [updateTemplate],
  )

  const updateItemsStore = useCallback(
    (updater: (prev: typeof itemsStore) => typeof itemsStore) => {
      setItemsStore((prev) => {
        const next = updater(prev)
        persistItems(next)
        return next
      })
    },
    [persistItems],
  )

  const { categories, tags, items } = itemsStore

  const itemsByDay = useMemo(
    () => expandItemsForWeek(items, weekStart),
    [items, weekStart],
  )

  const dayCompletion = useMemo(() => {
    const result = {} as Record<DayKey, { done: number; total: number }>
    for (const day of template.days) {
      let done = 0
      let total = 0
      for (const block of day.blocks) {
        const tasks = getBlockTasks(day.key, block)
        total += tasks.length
        done += tasks.filter((t) => t.done).length
      }
      result[day.key] = { done, total }
    }
    return result
  }, [template, getBlockTasks])

  const weekCompletionPercent = useMemo(() => {
    let done = 0
    let total = 0
    for (const stats of Object.values(dayCompletion)) {
      done += stats.done
      total += stats.total
    }
    return total === 0 ? 0 : Math.round((done / total) * 100)
  }, [dayCompletion])

  const value: PlannerDataContextValue = {
    user,
    loading,
    loadingWeek,
    showImportBanner,
    importing,
    importLocalData,
    signOut: onSignOut,
    template,
    weekStart,
    weeklyLog,
    getBlockLog,
    getBlockTasks,
    getOneOffTasks,
    toggleTask,
    toggleHideTask,
    isBlockCompleteForDay: isBlockCompleteForDayFn,
    getHiddenBlockTasks: getHiddenBlockTasksForBlock,
    setFlexibleNote,
    addTask,
    deleteRecurringTask,
    deleteOneOffTask,
    renameOneOffTask,
    renameRecurringTask,
    updateBlock,
    deleteBlock,
    addBlock,
    reorderBlocks,
    goToWeek,
    dayCompletion,
    weekCompletionPercent,
    categories,
    tags,
    items,
    itemsByDay,
    getItemsForDay: (dayKey) => itemsByDay[dayKey] ?? [],
    getCategory: (id) => categories.find((c) => c.id === id) ?? null,
    getTag: (id) => tags.find((t) => t.id === id) ?? null,
    addCategory: (name) => {
      const category: Category = {
        id: generateId(),
        name: name.trim(),
        color: nextCategoryColor(categories),
      }
      updateItemsStore((prev) => ({
        ...prev,
        categories: [...prev.categories, category],
      }))
      return category.id
    },
    updateCategory: (id, updates) => {
      updateItemsStore((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === id ? { ...c, ...updates, id: c.id } : c,
        ),
      }))
    },
    deleteCategory: (id) => {
      updateItemsStore((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        items: prev.items.map((item) =>
          item.categoryId === id ? { ...item, categoryId: null } : item,
        ),
      }))
    },
    addTag: (name, icon) => {
      const tag: Tag = { id: generateId(), name: name.trim(), icon: icon?.trim() || undefined }
      updateItemsStore((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
      return tag.id
    },
    updateTag: (id, updates) => {
      updateItemsStore((prev) => ({
        ...prev,
        tags: prev.tags.map((t) => (t.id === id ? { ...t, ...updates, id: t.id } : t)),
      }))
    },
    deleteTag: (id) => {
      updateItemsStore((prev) => ({
        ...prev,
        tags: prev.tags.filter((t) => t.id !== id),
        items: prev.items.map((item) => ({
          ...item,
          tagIds: item.tagIds.filter((tid) => tid !== id),
        })),
      }))
    },
    addItem: (item) => {
      const done: ItemDone = item.recurrence ? {} : false
      const newItem: Item = { ...item, id: generateId(), done }
      updateItemsStore((prev) => ({ ...prev, items: [...prev.items, newItem] }))
      return newItem.id
    },
    updateItem: (id, updates) => {
      updateItemsStore((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== id) return item
          const next = { ...item, ...updates, id: item.id }
          if (updates.recurrence !== undefined) {
            if (updates.recurrence === null && isRecurringItem(item)) {
              next.done = getItemDone(item, item.dueDate ?? undefined)
            } else if (updates.recurrence !== null && !isRecurringItem(item)) {
              next.done = {}
            }
          }
          return next
        }),
      }))
    },
    deleteItem: (id) => {
      updateItemsStore((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      }))
    },
    toggleItemDone: (itemId, dateKey) => {
      updateItemsStore((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== itemId) return item
          if (isRecurringItem(item)) {
            const key = dateKey ?? item.dueDate
            if (!key) return item
            const map = typeof item.done === 'object' ? { ...item.done } : {}
            map[key] = !map[key]
            return { ...item, done: map }
          }
          return { ...item, done: !(item.done as boolean) }
        }),
      }))
    },
    filterItems: (list, categoryFilter, tagFilters) => {
      let result = list
      if (categoryFilter && categoryFilter !== 'all') {
        result =
          categoryFilter === NO_CATEGORY_ID
            ? result.filter((i) => i.categoryId === null)
            : result.filter((i) => i.categoryId === categoryFilter)
      }
      if (tagFilters.length > 0) {
        result = result.filter((i) => tagFilters.some((tid) => i.tagIds.includes(tid)))
      }
      return result
    },
    getColumnItems: (categoryId, categoryFilter, tagFilters) => {
      const base = items.filter((i) => i.categoryId === categoryId)
      const filtered =
        categoryFilter && categoryFilter !== 'all'
          ? categoryFilter === NO_CATEGORY_ID
            ? base.filter((i) => i.categoryId === null)
            : base.filter((i) => i.categoryId === categoryFilter)
          : base
      if (tagFilters.length === 0) return filtered
      return filtered.filter((i) => tagFilters.some((tid) => i.tagIds.includes(tid)))
    },
    getColumnStats: (columnItems) => {
      const done = columnItems.filter((item) => {
        if (isRecurringItem(item)) {
          return item.dueDate ? getItemDone(item, item.dueDate) : false
        }
        return item.done === true
      }).length
      return { done, total: columnItems.length }
    },
    linkedApps,
    addLinkedApp: (app) => {
      const entry: LinkedApp = { ...app, id: generateId() }
      setLinkedApps((prev) => {
        const next = [...prev, entry]
        persistApps(next)
        return next
      })
      return entry.id
    },
    updateLinkedApp: (id, updates) => {
      setLinkedApps((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...updates, id: a.id } : a))
        persistApps(next)
        return next
      })
    },
    deleteLinkedApp: (id) => {
      setLinkedApps((prev) => {
        const next = prev.filter((a) => a.id !== id)
        persistApps(next)
        return next
      })
    },
    openLinkedApp: (app) => {
      if (app.openMode === 'newTab') {
        window.open(app.url, '_blank', 'noopener,noreferrer')
        return null
      }
      return app
    },
  }

  return (
    <PlannerDataContext.Provider value={value}>
      {loading ? (
        <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
          <p className="text-sm text-muted">Loading your planner…</p>
        </div>
      ) : (
        children
      )}
    </PlannerDataContext.Provider>
  )
}

export function usePlannerData() {
  const ctx = useContext(PlannerDataContext)
  if (!ctx) throw new Error('usePlannerData must be used within PlannerDataProvider')
  return ctx
}

export type PlannerActions = Pick<
  ReturnType<typeof usePlannerData>,
  | 'template'
  | 'weekStart'
  | 'weeklyLog'
  | 'loadingWeek'
  | 'getBlockLog'
  | 'getBlockTasks'
  | 'getOneOffTasks'
  | 'toggleTask'
  | 'toggleHideTask'
  | 'isBlockCompleteForDay'
  | 'getHiddenBlockTasks'
  | 'setFlexibleNote'
  | 'addTask'
  | 'deleteRecurringTask'
  | 'deleteOneOffTask'
  | 'renameOneOffTask'
  | 'renameRecurringTask'
  | 'updateBlock'
  | 'deleteBlock'
  | 'addBlock'
  | 'reorderBlocks'
  | 'goToWeek'
  | 'dayCompletion'
  | 'weekCompletionPercent'
>

export type ItemsActions = Pick<
  ReturnType<typeof usePlannerData>,
  | 'categories'
  | 'tags'
  | 'items'
  | 'itemsByDay'
  | 'getItemsForDay'
  | 'getCategory'
  | 'getTag'
  | 'addCategory'
  | 'updateCategory'
  | 'deleteCategory'
  | 'addTag'
  | 'updateTag'
  | 'deleteTag'
  | 'addItem'
  | 'updateItem'
  | 'deleteItem'
  | 'toggleItemDone'
  | 'filterItems'
  | 'getColumnItems'
  | 'getColumnStats'
>

export type LinkedAppsActions = Pick<
  ReturnType<typeof usePlannerData>,
  'linkedApps' | 'addLinkedApp' | 'updateLinkedApp' | 'deleteLinkedApp' | 'openLinkedApp'
>

export function createTask(label: string): TaskTemplate {
  return { id: generateId(), label }
}
