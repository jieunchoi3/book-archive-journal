export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type DayType = 'office' | 'off' | 'wfh'

export type BlockCategory =
  | 'morning'
  | 'work'
  | 'chore'
  | 'meal'
  | 'growth'
  | 'exercise'
  | 'free'
  | 'night'

export interface TaskTemplate {
  id: string
  label: string
}

export interface OneOffTask {
  id: string
  label: string
  done: boolean
}

export interface Block {
  id: string
  title: string
  category: BlockCategory
  timeRangeLabel: string
  description: string
  badges: string[]
  /** Recurring tasks — part of the weekly template */
  tasks: TaskTemplate[]
  order: number
  isFlexible?: boolean
}

export interface DayTemplate {
  key: DayKey
  dayName: string
  dayType: DayType
  tag: string
  blocks: Block[]
}

export interface WeekTemplate {
  days: DayTemplate[]
}

export interface BlockDayLog {
  /** Completion state for recurring template tasks, scoped to this week */
  taskCompletion: Record<string, boolean>
  /** Recurring task IDs hidden for this week only (delete-this-week) */
  hiddenRecurringTasks?: string[]
  flexibleNote?: string
}

export interface WeeklyLog {
  weekStart: string
  days: Partial<Record<DayKey, Record<string, BlockDayLog>>>
  /** date (YYYY-MM-DD) → blockId → one-off tasks for that specific date */
  oneOffByDate: Record<string, Record<string, OneOffTask[]>>
}

export type TaskKind = 'recurring' | 'one-off'

export interface RenderTask {
  id: string
  label: string
  kind: TaskKind
  done: boolean
}

export const FLEXIBLE_TAGS = ['AI학습', 'AI활용', '코딩', '영상편집', 'SNS'] as const

export type FlexibleTag = (typeof FLEXIBLE_TAGS)[number]

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  office: 'Office',
  off: 'Off Day',
  wfh: 'WFH',
}
