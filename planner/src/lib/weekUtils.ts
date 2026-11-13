import type { DayKey } from '../types/planner'
import { DAY_KEYS } from '../types/planner'
import { getWeekStartsOnRuntime } from './weekStartPreference'

export function generateId(): string {
  return crypto.randomUUID()
}

/** JS getDay(): 0=Sun … 6=Sat */
const DAY_KEY_TO_JS: Record<DayKey, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

/** Column / week order starting at the chosen weekday. */
export function orderedDayKeys(weekStartsOn: DayKey = getWeekStartsOnRuntime()): DayKey[] {
  const i = DAY_KEYS.indexOf(weekStartsOn)
  if (i <= 0) return [...DAY_KEYS]
  return [...DAY_KEYS.slice(i), ...DAY_KEYS.slice(0, i)]
}

export function getCurrentWeekStart(
  weekStartsOn: DayKey = getWeekStartsOnRuntime(),
): string {
  return getWeekStartDate(new Date(), weekStartsOn)
}

/** Most recent `weekStartsOn` on or before `date` (7-day window). */
export function getWeekStartDate(
  date: Date = new Date(),
  weekStartsOn: DayKey = getWeekStartsOnRuntime(),
): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const jsDay = d.getDay()
  const target = DAY_KEY_TO_JS[weekStartsOn]
  const diff = (jsDay - target + 7) % 7
  d.setDate(d.getDate() - diff)
  return formatDateKey(d)
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function shiftDateKey(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + days)
  return formatDateKey(d)
}

export function formatWeekRange(weekStart: string): string {
  const start = parseDateKey(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(start)} – ${fmt(end)}`
}

export function getDayKeyFromDate(date: Date): DayKey {
  const day = date.getDay()
  const map: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return map[day]!
}

export function isToday(
  dayKey: DayKey,
  weekStart: string,
  weekStartsOn: DayKey = getWeekStartsOnRuntime(),
): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentWeekStart = getWeekStartDate(today, weekStartsOn)
  if (currentWeekStart !== weekStart) return false
  return getDayKeyFromDate(today) === dayKey
}

/**
 * Map a calendar weekday onto the current week window.
 * `weekStart` is the date of the preferred start weekday.
 */
export function getDateForDayKey(
  weekStart: string,
  dayKey: DayKey,
  weekStartsOn: DayKey = getWeekStartsOnRuntime(),
): Date {
  const order = orderedDayKeys(weekStartsOn)
  const index = order.indexOf(dayKey)
  const d = parseDateKey(weekStart)
  d.setDate(d.getDate() + (index >= 0 ? index : 0))
  return d
}

export function getDateKeyForDay(
  weekStart: string,
  dayKey: DayKey,
  weekStartsOn: DayKey = getWeekStartsOnRuntime(),
): string {
  return formatDateKey(getDateForDayKey(weekStart, dayKey, weekStartsOn))
}

export function formatShortDateForDay(
  weekStart: string,
  dayKey: DayKey,
  weekStartsOn: DayKey = getWeekStartsOnRuntime(),
): string {
  const d = getDateForDayKey(weekStart, dayKey, weekStartsOn)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** Shift by whole weeks (anchor day preserved). */
export function shiftWeekStart(weekStart: string, weeks: number): string {
  const d = parseDateKey(weekStart)
  d.setDate(d.getDate() + weeks * 7)
  return formatDateKey(d)
}

export interface MonthGridDay {
  dateKey: string
  inMonth: boolean
}

export function getMonthGrid(year: number, month: number): MonthGridDay[][] {
  const weeks: MonthGridDay[][] = []
  const first = new Date(year, month, 1)
  first.setHours(0, 0, 0, 0)

  const start = new Date(first)
  const dow = start.getDay()
  // Month grid stays Monday-first for a stable calendar.
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

  const cursor = new Date(start)
  for (let w = 0; w < 6; w++) {
    const week: MonthGridDay[] = []
    for (let d = 0; d < 7; d++) {
      week.push({
        dateKey: formatDateKey(cursor),
        inMonth: cursor.getMonth() === month,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    if (w >= 4) {
      const lastOfMonth = new Date(year, month + 1, 0)
      if (week[6]!.dateKey > formatDateKey(lastOfMonth) && week[0]!.dateKey > formatDateKey(lastOfMonth)) {
        break
      }
    }
  }
  return weeks
}

export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function getTodayKey(): string {
  return formatDateKey(new Date())
}

export function weekStartFromDateKey(
  dateKey: string,
  weekStartsOn: DayKey = getWeekStartsOnRuntime(),
): string {
  return getWeekStartDate(parseDateKey(dateKey), weekStartsOn)
}

export function getMonthYearFromWeekStart(weekStart: string): { year: number; month: number } {
  const d = parseDateKey(weekStart)
  return { year: d.getFullYear(), month: d.getMonth() }
}
