import type { WeeklyLog } from '../types/planner'

export function emptyWeeklyLog(weekStart: string): WeeklyLog {
  return { weekStart, days: {}, oneOffByDate: {} }
}
