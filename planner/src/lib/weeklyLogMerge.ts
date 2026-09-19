import type { DayKey, WeeklyLog } from '../types/planner'

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
