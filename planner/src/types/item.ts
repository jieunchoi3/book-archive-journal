export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: RecurrenceFreq
  interval: number
  byDay?: string[]
  until?: string | null
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface Tag {
  id: string
  name: string
  icon?: string
}

export type ItemDone = boolean | Record<string, boolean>

export interface Item {
  id: string
  title: string
  categoryId: string | null
  tagIds: string[]
  dueDate: string | null
  recurrence: Recurrence | null
  done: ItemDone
  showOnWeeklyView: boolean
  /** Optional time label for weekly chips, e.g. "16:30–18:30" */
  time?: string
  /** Whether weekly chip supports check-off (default true) */
  checkable: boolean
}

export interface ItemOccurrence {
  item: Item
  dateKey: string
  done: boolean
}

export const RRULE_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type RRuleDay = (typeof RRULE_DAYS)[number]

export const RRULE_DAY_LABELS: Record<RRuleDay, string> = {
  MO: '월',
  TU: '화',
  WE: '수',
  TH: '목',
  FR: '금',
  SA: '토',
  SU: '일',
}

export const FREQ_LABELS: Record<RecurrenceFreq | 'none', string> = {
  none: '없음',
  daily: '매일',
  weekly: '매주',
  monthly: '매월',
  yearly: '매년',
}

/** Full rainbow palette for event categories (red → violet). */
export const CATEGORY_PALETTE = [
  '#FF3B30',
  '#FF2D55',
  '#FF453A',
  '#FF6B35',
  '#FF9500',
  '#FFAB40',
  '#FFCC00',
  '#FFD60A',
  '#FFE620',
  '#34C759',
  '#30D158',
  '#4CD964',
  '#00C7BE',
  '#5AC8FA',
  '#32ADE6',
  '#007AFF',
  '#0A84FF',
  '#5856D6',
  '#5E5CE6',
  '#7B61FF',
  '#AF52DE',
  '#BF5AF2',
  '#FF2D92',
  '#FF6482',
  '#FF375F',
  '#8E8E93',
  '#636366',
  '#48484A',
] as const

export const NO_CATEGORY_ID = '__none__'

export function isRecurringItem(item: Item): boolean {
  return item.recurrence !== null
}

export function getItemDone(item: Item, dateKey?: string): boolean {
  if (typeof item.done === 'boolean') return item.done
  if (!dateKey) return false
  return !!item.done[dateKey]
}

export function nextCategoryColor(existing: Category[]): string {
  const used = new Set(existing.map((c) => c.color))
  const available = CATEGORY_PALETTE.find((c) => !used.has(c))
  return available ?? CATEGORY_PALETTE[existing.length % CATEGORY_PALETTE.length]
}

export function formatDueDate(dateKey: string | null): string {
  if (!dateKey) return 'no due date'
  const [, m, d] = dateKey.split('-').map(Number)
  return `${m}/${d}`
}

export function formatDueDateLong(dateKey: string | null): string {
  if (!dateKey) return 'no due date'
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${y}. ${m}. ${d}`
}
