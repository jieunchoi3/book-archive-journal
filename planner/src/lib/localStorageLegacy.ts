/**
 * Read-only localStorage access for one-time import into Supabase.
 * Do not use for runtime data after migration.
 */
import type { BlockDayLog, WeeklyLog } from '../types/planner'
import type { ItemsStore } from './itemStorageLegacy'
import { loadItemsStoreLegacy } from './itemStorageLegacy'
import type { LinkedApp } from '../types/linkedApp'
import { DEFAULT_LINKED_APPS } from '../types/linkedApp'
import { SEED_TEMPLATE } from '../data/seedTemplate'

const TEMPLATE_KEY = 'planner:template'
const LOG_PREFIX = 'planner:log:'
const LINKED_APPS_KEY = 'planner:linkedApps'

export function hasLocalPlannerData(): boolean {
  if (localStorage.getItem(TEMPLATE_KEY)) return true
  if (localStorage.getItem('planner:categories')) return true
  if (localStorage.getItem('planner:items')) return true
  if (localStorage.getItem(LINKED_APPS_KEY)) return true
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(LOG_PREFIX)) return true
  }
  return false
}

export const IMPORT_DONE_KEY = 'planner:imported-to-supabase'

export function isLocalImportDone(): boolean {
  return localStorage.getItem(IMPORT_DONE_KEY) === 'true'
}

export function markLocalImportDone(): void {
  localStorage.setItem(IMPORT_DONE_KEY, 'true')
}

export function loadTemplateLegacy() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY)
    if (raw) return JSON.parse(raw) as import('../types/planner').WeekTemplate
  } catch {
    // fall through
  }
  return structuredClone(SEED_TEMPLATE)
}

function migrateWeeklyLog(raw: Record<string, unknown>, weekStart: string): WeeklyLog {
  const days: WeeklyLog['days'] = {}
  const rawDays = raw.days as WeeklyLog['days'] | undefined
  if (rawDays) {
    for (const [dayKey, blockMap] of Object.entries(rawDays)) {
      if (!blockMap) continue
      days[dayKey as keyof WeeklyLog['days']] = {}
      for (const [blockId, blockLog] of Object.entries(blockMap)) {
        const log = blockLog as unknown as Record<string, unknown>
        days[dayKey as keyof WeeklyLog['days']]![blockId] = {
          taskCompletion:
            (log.taskCompletion as Record<string, boolean>) ??
            (log.tasks as Record<string, boolean>) ??
            {},
          flexibleNote: log.flexibleNote as string | undefined,
          hiddenRecurringTasks: log.hiddenRecurringTasks as string[] | undefined,
        } satisfies BlockDayLog
      }
    }
  }
  return {
    weekStart,
    days,
    oneOffByDate: (raw.oneOffByDate as WeeklyLog['oneOffByDate']) ?? {},
  }
}

export function loadAllWeeklyLogsLegacy(): WeeklyLog[] {
  const logs: WeeklyLog[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(LOG_PREFIX)) continue
    const weekStart = key.slice(LOG_PREFIX.length)
    try {
      const raw = JSON.parse(localStorage.getItem(key)!) as Record<string, unknown>
      logs.push(migrateWeeklyLog(raw, weekStart))
    } catch {
      // skip
    }
  }
  return logs
}

export function loadLinkedAppsLegacy(): LinkedApp[] {
  try {
    const raw = localStorage.getItem(LINKED_APPS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LinkedApp[]
      if (parsed.length > 0) return parsed
    }
  } catch {
    // fall through
  }
  return structuredClone(DEFAULT_LINKED_APPS)
}

export function loadItemsStoreFromLegacy(): ItemsStore {
  return loadItemsStoreLegacy()
}

export function clearPlannerLocalData(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (
      key &&
      (key.startsWith('planner:') && key !== IMPORT_DONE_KEY && key !== 'planner:sidebarCollapsed')
    ) {
      keys.push(key)
    }
  }
  for (const key of keys) localStorage.removeItem(key)
}
