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

export const COMMITMENT_COLORS = [
  '#007AFF',
  '#AF52DE',
  '#FF2D55',
  '#FF9500',
  '#34C759',
  '#5856D6',
  '#64D2FF',
  '#8E8E93',
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
