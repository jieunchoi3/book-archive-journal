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

export const CATEGORY_PALETTE = [
  '#9B8EC4',
  '#7BA882',
  '#E07A6F',
  '#5BAFA8',
  '#7B8FA1',
  '#D4845A',
  '#E8A838',
  '#5B6B8A',
  '#5856D6',
  '#FF9500',
  '#34C759',
  '#FF2D55',
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
