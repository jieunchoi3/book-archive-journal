import type { DayKey, TaskKind } from '../types/planner'

export type TaskDragData = {
  type: 'task'
  dayKey: DayKey
  blockId: string
  taskId: string
  kind: TaskKind
  label: string
}

export type BlockDropData = {
  type: 'block-drop'
  dayKey: DayKey
  blockId: string
}

export type BlockDragData = {
  type: 'block'
  dayKey: DayKey
  blockId: string
}

/** Unused weekly quota chip dragged from the sidebar pool onto a day. */
export type CommitmentSlotDragData = {
  type: 'commitment-slot'
  commitmentId: string
  slotIndex: number
  title: string
  color: string
}

/** Already-placed commitment block moved between days. */
export type CommitmentPlacementDragData = {
  type: 'commitment-placement'
  placementId: string
  dayKey: DayKey
  title: string
  color: string
}

export type DayCommitmentDropData = {
  type: 'day-commitment-drop'
  dayKey: DayKey
}

export function taskDragId(
  dayKey: DayKey,
  blockId: string,
  kind: TaskKind,
  taskId: string,
): string {
  return `task:${dayKey}:${blockId}:${kind}:${taskId}`
}

export function blockDragId(dayKey: DayKey, blockId: string): string {
  return `block:${dayKey}:${blockId}`
}

export function blockDropId(dayKey: DayKey, blockId: string): string {
  return `drop:${dayKey}:${blockId}`
}

export function commitmentSlotDragId(commitmentId: string, slotIndex: number): string {
  return `cslot:${commitmentId}:${slotIndex}`
}

export function commitmentPlacementDragId(placementId: string): string {
  return `cplace:${placementId}`
}

export function dayCommitmentDropId(dayKey: DayKey): string {
  return `cday:${dayKey}`
}

export function parseBlockDragId(id: string): { dayKey: DayKey; blockId: string } | null {
  const match = id.match(/^block:([^:]+):(.+)$/)
  if (!match) return null
  return { dayKey: match[1] as DayKey, blockId: match[2] }
}
