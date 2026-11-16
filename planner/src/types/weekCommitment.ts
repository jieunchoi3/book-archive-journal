import type { DayKey } from './planner'

/** Default subtask baked into a commitment definition. */
export interface CommitmentDefaultTask {
  id: string
  label: string
  /** When true, copied onto every new weekly placement. */
  repeatWeekly: boolean
}

/** Reusable weekly quota (e.g. “AI 연출 공부 · 2 / week”). */
export interface WeekCommitment {
  id: string
  title: string
  color: string
  targetPerWeek: number
  defaultTasks: CommitmentDefaultTask[]
  sortOrder: number
}

/** Instance subtask on a placed block for one week/day. */
export interface CommitmentPlacementTask {
  id: string
  label: string
  done: boolean
  repeatWeekly: boolean
  sourceDefaultId?: string
  sortOrder: number
}

/** A commitment slot placed onto a specific day in a week. */
export interface WeekCommitmentPlacement {
  id: string
  weekStart: string
  commitmentId: string
  dayKey: DayKey
  sortOrder: number
  tasks: CommitmentPlacementTask[]
}

export interface WeekCommitmentStore {
  commitments: WeekCommitment[]
  placements: WeekCommitmentPlacement[]
}

/** Same rich set as event categories so Weekly blocks can match Monthly colours. */
export const COMMITMENT_COLORS = [
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
  '#64D2FF',
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

export function emptyCommitmentStore(): WeekCommitmentStore {
  return { commitments: [], placements: [] }
}

export function remainingSlotsForCommitment(
  commitment: WeekCommitment,
  placements: WeekCommitmentPlacement[],
  weekStart: string,
): number {
  const used = placements.filter(
    (p) => p.commitmentId === commitment.id && p.weekStart === weekStart,
  ).length
  return Math.max(0, commitment.targetPerWeek - used)
}
