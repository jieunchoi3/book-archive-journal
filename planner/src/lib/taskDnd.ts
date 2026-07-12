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

export function parseBlockDragId(id: string): { dayKey: DayKey; blockId: string } | null {
  const match = id.match(/^block:([^:]+):(.+)$/)
  if (!match) return null
  return { dayKey: match[1] as DayKey, blockId: match[2] }
}
