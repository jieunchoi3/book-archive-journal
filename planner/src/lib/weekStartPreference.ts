import type { DayKey } from '../types/planner'
import { DAY_KEYS } from '../types/planner'

const DEFAULT: DayKey = 'mon'

/** Runtime value read by weekUtils so date math stays consistent without threading every call. */
let runtimeWeekStartsOn: DayKey = DEFAULT

export function getWeekStartsOnRuntime(): DayKey {
  return runtimeWeekStartsOn
}

export function setWeekStartsOnRuntime(day: DayKey): void {
  runtimeWeekStartsOn = day
}

function storageKey(userId: string) {
  return `planner:weekStartsOn:${userId}`
}

export function loadWeekStartsOn(userId: string): DayKey {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (raw && (DAY_KEYS as string[]).includes(raw)) {
      return raw as DayKey
    }
  } catch {
    /* ignore */
  }
  return DEFAULT
}

export function saveWeekStartsOn(userId: string, day: DayKey): void {
  try {
    localStorage.setItem(storageKey(userId), day)
  } catch {
    /* ignore */
  }
  setWeekStartsOnRuntime(day)
}

export const WEEK_START_LABELS: Record<DayKey, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
}
