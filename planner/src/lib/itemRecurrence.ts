import { RRule, type Weekday } from 'rrule'
import type { DayKey } from '../types/planner'
import type { Item, ItemOccurrence, Recurrence, RRuleDay } from '../types/item'
import { getItemDone, isRecurringItem, RRULE_DAYS } from '../types/item'
import {
  formatDateKey,
  getDateKeyForDay,
  getTodayKey,
  parseDateKey,
  shiftWeekStart,
} from './weekUtils'

/** How far back to scan recurring events for unfinished occurrences. */
const OVERDUE_LOOKBACK_DAYS = 90
const OVERDUE_MAX_ITEMS = 60

function shiftDateKey(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + days)
  return formatDateKey(d)
}

/**
 * Checkable events past their due/occurrence date that are still incomplete.
 * One-shot: dueDate < today && !done.
 * Recurring: each past occurrence in the lookback window that is not done.
 */
export function getOverdueOccurrences(
  items: Item[],
  todayKey: string = getTodayKey(),
): ItemOccurrence[] {
  const yesterdayKey = shiftDateKey(todayKey, -1)
  const lookbackStart = shiftDateKey(todayKey, -OVERDUE_LOOKBACK_DAYS)
  const out: ItemOccurrence[] = []

  for (const item of items) {
    if (!item.checkable) continue

    if (!isRecurringItem(item)) {
      if (item.dueDate && item.dueDate < todayKey && !getItemDone(item)) {
        out.push({ item, dateKey: item.dueDate, done: false })
      }
      continue
    }

    if (!item.dueDate || item.dueDate >= todayKey) continue

    const startKey = item.dueDate > lookbackStart ? item.dueDate : lookbackStart
    if (startKey > yesterdayKey) continue

    for (const dateKey of getOccurrenceDatesInRange(item, startKey, yesterdayKey)) {
      if (dateKey < todayKey && !getItemDone(item, dateKey)) {
        out.push({ item, dateKey, done: false })
      }
    }
  }

  out.sort((a, b) => {
    const byDate = a.dateKey.localeCompare(b.dateKey)
    if (byDate !== 0) return byDate
    return a.item.title.localeCompare(b.item.title, 'ko')
  })

  return out.slice(0, OVERDUE_MAX_ITEMS)
}

const RRULE_WEEKDAY: Record<RRuleDay, Weekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
}

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function dateAtNoon(dateKey: string): Date {
  const d = parseDateKey(dateKey)
  d.setHours(12, 0, 0, 0)
  return d
}

function endOfDay(dateKey: string): Date {
  const d = parseDateKey(dateKey)
  d.setHours(23, 59, 59, 999)
  return d
}

function weekEndKey(weekStart: string): string {
  const end = parseDateKey(shiftWeekStart(weekStart, 1))
  end.setDate(end.getDate() - 1)
  return formatDateKey(end)
}

export function buildRRule(recurrence: Recurrence, anchorDate: string): RRule {
  const freqMap = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  } as const

  const options: ConstructorParameters<typeof RRule>[0] = {
    freq: freqMap[recurrence.freq],
    interval: Math.max(1, recurrence.interval),
    dtstart: dateAtNoon(anchorDate),
  }

  if (recurrence.byDay?.length) {
    options.byweekday = recurrence.byDay
      .filter((d): d is RRuleDay => RRULE_DAYS.includes(d as RRuleDay))
      .map((d) => RRULE_WEEKDAY[d])
  }

  if (recurrence.until) {
    options.until = endOfDay(recurrence.until)
  }

  return new RRule(options)
}

export function getOccurrenceDates(item: Item, weekStart: string): string[] {
  const endKey = weekEndKey(weekStart)
  return getOccurrenceDatesInRange(item, weekStart, endKey)
}

export function getOccurrenceDatesInRange(
  item: Item,
  startKey: string,
  endKey: string,
): string[] {
  if (!isRecurringItem(item)) {
    if (item.dueDate && item.dueDate >= startKey && item.dueDate <= endKey) {
      return [item.dueDate]
    }
    return []
  }

  if (!item.dueDate) return []

  const rule = buildRRule(item.recurrence!, item.dueDate)
  const rangeStart = parseDateKey(startKey)
  rangeStart.setHours(0, 0, 0, 0)

  return rule.between(rangeStart, endOfDay(endKey), true).map(formatDateKey)
}

export function expandItemsForMonth(
  items: Item[],
  year: number,
  month: number,
): Record<string, ItemOccurrence[]> {
  const startKey = formatDateKey(new Date(year, month, 1))
  const endKey = formatDateKey(new Date(year, month + 1, 0))
  const byDate: Record<string, ItemOccurrence[]> = {}

  for (const item of items) {
    const dates = getOccurrenceDatesInRange(item, startKey, endKey)
    for (const dateKey of dates) {
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push({
        item,
        dateKey,
        done: getItemDone(item, dateKey),
      })
    }
  }

  for (const key of Object.keys(byDate)) {
    byDate[key].sort((a, b) => a.item.title.localeCompare(b.item.title, 'ko'))
  }

  return byDate
}

export function expandItemsForWeek(
  items: Item[],
  weekStart: string,
): Record<DayKey, ItemOccurrence[]> {
  const result = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  } as Record<DayKey, ItemOccurrence[]>

  for (const item of items) {
    if (!item.showOnWeeklyView) continue
    const dates = getOccurrenceDates(item, weekStart)
    for (const dateKey of dates) {
      const dayKey = DAY_KEYS.find((k) => getDateKeyForDay(weekStart, k) === dateKey)
      if (!dayKey) continue
      result[dayKey].push({
        item,
        dateKey,
        done: getItemDone(item, dateKey),
      })
    }
  }

  for (const key of DAY_KEYS) {
    result[key].sort((a, b) => a.item.title.localeCompare(b.item.title, 'ko'))
  }

  return result
}

export function dayKeyToRRuleDay(dayKey: DayKey): RRuleDay {
  const map: Record<DayKey, RRuleDay> = {
    mon: 'MO',
    tue: 'TU',
    wed: 'WE',
    thu: 'TH',
    fri: 'FR',
    sat: 'SA',
    sun: 'SU',
  }
  return map[dayKey]
}

export function dateKeyToRRuleDay(dateKey: string): RRuleDay {
  const jsDay = parseDateKey(dateKey).getDay()
  const map: RRuleDay[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
  return map[jsDay]!
}

export function normalizeRecurrenceForDate(
  recurrence: Recurrence | null,
  dateKey: string,
): Recurrence | null {
  if (!recurrence) return null
  if (recurrence.freq === 'weekly' && !recurrence.byDay?.length) {
    return { ...recurrence, byDay: [dateKeyToRRuleDay(dateKey)] }
  }
  return recurrence
}

/** Weekly interval 1 → block template habit; anything else → scheduled event item. */
export function isTemplateWeeklyHabit(recurrence: Recurrence | null): boolean {
  return recurrence?.freq === 'weekly' && recurrence.interval === 1
}
