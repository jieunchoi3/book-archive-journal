import type { Block, BlockDayLog, OneOffTask, RenderTask } from '../types/planner'

function recurringTasks(
  block: Block,
  blockLog: BlockDayLog,
): Omit<RenderTask, 'done'>[] {
  const hiddenWeek = new Set(blockLog.hiddenRecurringTasks ?? [])
  return block.tasks
    .filter((t) => !hiddenWeek.has(t.id))
    .map((t) => ({ id: t.id, label: t.label, kind: 'recurring' as const }))
}

function oneOffRenderTasks(oneOffTasks: OneOffTask[]): Omit<RenderTask, 'done'>[] {
  return oneOffTasks.map((t) => ({
    id: t.id,
    label: t.label,
    kind: 'one-off' as const,
  }))
}

export function getVisibleBlockTasks(
  block: Block,
  blockLog: BlockDayLog,
  oneOffTasks: OneOffTask[],
): RenderTask[] {
  const hiddenDay = new Set(blockLog.hiddenTasks ?? [])
  const tasks = [...recurringTasks(block, blockLog), ...oneOffRenderTasks(oneOffTasks)]
  return tasks
    .filter((t) => !hiddenDay.has(t.id))
    .map((t) => ({
      ...t,
      done: t.kind === 'one-off'
        ? (oneOffTasks.find((o) => o.id === t.id)?.done ?? false)
        : !!blockLog.taskCompletion[t.id],
    }))
}

export function getHiddenBlockTasks(
  block: Block,
  blockLog: BlockDayLog,
  oneOffTasks: OneOffTask[],
): RenderTask[] {
  const hiddenDay = new Set(blockLog.hiddenTasks ?? [])
  if (hiddenDay.size === 0) return []

  return [...recurringTasks(block, blockLog), ...oneOffRenderTasks(oneOffTasks)]
    .filter((t) => hiddenDay.has(t.id))
    .map((t) => ({
      ...t,
      done: t.kind === 'one-off'
        ? (oneOffTasks.find((o) => o.id === t.id)?.done ?? false)
        : !!blockLog.taskCompletion[t.id],
    }))
}

/** True when every visible task is done, or all tasks are hidden for this date. */
export function isBlockCompleteForDay(
  block: Block,
  blockLog: BlockDayLog,
  oneOffTasks: OneOffTask[],
): boolean {
  const hiddenWeek = new Set(blockLog.hiddenRecurringTasks ?? [])
  const taskCount =
    block.tasks.filter((t) => !hiddenWeek.has(t.id)).length + oneOffTasks.length
  if (taskCount === 0) return false

  const visible = getVisibleBlockTasks(block, blockLog, oneOffTasks)
  if (visible.length === 0) return true
  return visible.every((t) => t.done)
}

export function countHiddenTasksForDay(
  blocks: Block[],
  getBlockLog: (blockId: string) => BlockDayLog,
  getOneOffTasks: (blockId: string) => OneOffTask[],
): number {
  let count = 0
  for (const block of blocks) {
    count += getHiddenBlockTasks(block, getBlockLog(block.id), getOneOffTasks(block.id)).length
  }
  return count
}
