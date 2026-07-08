import type { BlockDayLog, WeeklyLog } from '../types/planner'
import { getWeekStartDate } from './weekUtils'
import { SEED_TEMPLATE } from '../data/seedTemplate'

const TEMPLATE_KEY = 'planner:template'
const LOG_PREFIX = 'planner:log:'

export function loadTemplate() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY)
    if (raw) {
      return JSON.parse(raw) as import('../types/planner').WeekTemplate
    }
  } catch {
    // fall through to seed
  }
  return structuredClone(SEED_TEMPLATE)
}

export function saveTemplate(template: import('../types/planner').WeekTemplate): void {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template))
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
        const migrated: BlockDayLog = {
          taskCompletion:
            (log.taskCompletion as Record<string, boolean>) ??
            (log.tasks as Record<string, boolean>) ??
            {},
          flexibleNote: log.flexibleNote as string | undefined,
          hiddenRecurringTasks: log.hiddenRecurringTasks as string[] | undefined,
        }
        days[dayKey as keyof WeeklyLog['days']]![blockId] = migrated
      }
    }
  }

  return {
    weekStart,
    days,
    oneOffByDate: (raw.oneOffByDate as WeeklyLog['oneOffByDate']) ?? {},
  }
}

export function loadWeeklyLog(weekStart: string): WeeklyLog {
  try {
    const raw = localStorage.getItem(`${LOG_PREFIX}${weekStart}`)
    if (raw) {
      return migrateWeeklyLog(JSON.parse(raw) as Record<string, unknown>, weekStart)
    }
  } catch {
    // fall through
  }
  return { weekStart, days: {}, oneOffByDate: {} }
}

export function saveWeeklyLog(log: WeeklyLog): void {
  localStorage.setItem(`${LOG_PREFIX}${log.weekStart}`, JSON.stringify(log))
}

export function getCurrentWeekStart(): string {
  return getWeekStartDate()
}

export function resetTemplateToSeed() {
  const seed = structuredClone(SEED_TEMPLATE)
  saveTemplate(seed)
  return seed
}

export function emptyWeeklyLog(weekStart: string): WeeklyLog {
  return { weekStart, days: {}, oneOffByDate: {} }
}
