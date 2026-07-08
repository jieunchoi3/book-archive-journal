export function generateId(): string {
  return crypto.randomUUID()
}

export function getCurrentWeekStart(): string {
  return getWeekStartDate()
}

export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
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

export function formatWeekRange(weekStart: string): string {
  const start = parseDateKey(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(start)} – ${fmt(end)}`
}

export function getDayKeyFromDate(date: Date): import('../types/planner').DayKey {
  const day = date.getDay()
  const map: import('../types/planner').DayKey[] = [
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
  ]
  return map[day]
}

export function isToday(dayKey: import('../types/planner').DayKey, weekStart: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentWeekStart = getWeekStartDate(today)
  if (currentWeekStart !== weekStart) return false
  return getDayKeyFromDate(today) === dayKey
}

export function getDateForDayKey(weekStart: string, dayKey: import('../types/planner').DayKey): Date {
  const start = parseDateKey(weekStart)
  const dayIndex: Record<import('../types/planner').DayKey, number> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
    sun: 6,
  }
  const d = new Date(start)
  d.setDate(d.getDate() + dayIndex[dayKey])
  return d
}

export function getDateKeyForDay(
  weekStart: string,
  dayKey: import('../types/planner').DayKey,
): string {
  return formatDateKey(getDateForDayKey(weekStart, dayKey))
}

/** weekStart is always a Monday; shift by whole weeks */
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
      if (week[6].dateKey > formatDateKey(lastOfMonth) && week[0].dateKey > formatDateKey(lastOfMonth)) {
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

export function weekStartFromDateKey(dateKey: string): string {
  return getWeekStartDate(parseDateKey(dateKey))
}

export function getMonthYearFromWeekStart(weekStart: string): { year: number; month: number } {
  const d = parseDateKey(weekStart)
  return { year: d.getFullYear(), month: d.getMonth() }
}
