import type { DayKey, WeeklyLog } from '../types/planner'
import { weeklyLogHasContent } from './plannerLocalCache'

/** Merge two week logs; `done` and one-off tasks union with OR on completion. */
export function mergeWeeklyLogs(base: WeeklyLog, incoming: WeeklyLog): WeeklyLog {
  if (base.weekStart !== incoming.weekStart) return base

  const days: WeeklyLog['days'] = { ...base.days }

  for (const [dayKey, blockMap] of Object.entries(incoming.days)) {
    if (!blockMap) continue
    const dk = dayKey as DayKey
    if (!days[dk]) days[dk] = {}
    for (const [blockId, blockLog] of Object.entries(blockMap)) {
      const existing = days[dk]![blockId] ?? { taskCompletion: {} }
      const taskCompletion = { ...existing.taskCompletion }
      for (const [taskId, done] of Object.entries(blockLog.taskCompletion ?? {})) {
        taskCompletion[taskId] = Boolean(taskCompletion[taskId] || done)
      }
      days[dk]![blockId] = {
        ...existing,
        ...blockLog,
        taskCompletion,
        flexibleNote: existing.flexibleNote?.trim()
          ? existing.flexibleNote
          : blockLog.flexibleNote,
        hiddenTasks: [
          ...new Set([...(existing.hiddenTasks ?? []), ...(blockLog.hiddenTasks ?? [])]),
        ],
        hiddenRecurringTasks: [
          ...new Set([
            ...(existing.hiddenRecurringTasks ?? []),
            ...(blockLog.hiddenRecurringTasks ?? []),
          ]),
        ],
      }
    }
  }

  const oneOffByDate: WeeklyLog['oneOffByDate'] = { ...base.oneOffByDate }
  for (const [dateKey, blockMap] of Object.entries(incoming.oneOffByDate)) {
    for (const [blockId, tasks] of Object.entries(blockMap)) {
      const existing = oneOffByDate[dateKey]?.[blockId] ?? []
      const byId = new Map(existing.map((task) => [task.id, task]))
      for (const task of tasks) {
        const prev = byId.get(task.id)
        if (!prev) {
          byId.set(task.id, task)
        } else {
          byId.set(task.id, {
            ...prev,
            ...task,
            label: task.label || prev.label,
            done: prev.done || task.done,
          })
        }
      }
      if (!oneOffByDate[dateKey]) oneOffByDate[dateKey] = {}
      oneOffByDate[dateKey][blockId] = [...byId.values()]
    }
  }

  return { weekStart: base.weekStart, days, oneOffByDate }
}

/**
 * Pick the authoritative week log from cloud + local snapshots.
 * Never prefer an empty cloud payload over local edits that failed to upload yet.
 */
export function resolveWeeklyLogSync(
  cloud: WeeklyLog,
  local: WeeklyLog | null | undefined,
): { log: WeeklyLog; pushToCloud: boolean } {
  if (!local || !weeklyLogHasContent(local)) {
    return { log: cloud, pushToCloud: false }
  }
  if (!weeklyLogHasContent(cloud)) {
    return { log: local, pushToCloud: true }
  }
  return { log: mergeWeeklyLogs(cloud, local), pushToCloud: true }
}

/** Combine persisted localStorage with the in-memory week (current tab). */
export function mergeWeeklyLogSnapshots(
  stored: WeeklyLog | null | undefined,
  memory: WeeklyLog | null | undefined,
): WeeklyLog | null {
  if (!stored && !memory) return null
  if (!stored || !weeklyLogHasContent(stored)) return memory ?? null
  if (!memory || !weeklyLogHasContent(memory)) return stored
  if (stored.weekStart !== memory.weekStart) return stored
  return mergeWeeklyLogs(stored, memory)
}
