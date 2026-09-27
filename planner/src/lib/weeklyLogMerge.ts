import type { DayKey, WeeklyLog } from '../types/planner'
import { weeklyLogHasContent } from './plannerLocalCache'

/** Merge two week logs; local (`incoming`) wins on overlapping completion keys. */
export function mergeWeeklyLogs(base: WeeklyLog, incoming: WeeklyLog): WeeklyLog {
  if (base.weekStart !== incoming.weekStart) return base

  const days: WeeklyLog['days'] = { ...base.days }

  for (const [dayKey, blockMap] of Object.entries(incoming.days)) {
    if (!blockMap) continue
    const dk = dayKey as DayKey
    if (!days[dk]) days[dk] = {}
    for (const [blockId, blockLog] of Object.entries(blockMap)) {
      const existing = days[dk]![blockId] ?? { taskCompletion: {} }
      const taskCompletion = {
        ...existing.taskCompletion,
        ...(blockLog.taskCompletion ?? {}),
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
            done: task.done,
          })
        }
      }
      if (!oneOffByDate[dateKey]) oneOffByDate[dateKey] = {}
      oneOffByDate[dateKey][blockId] = [...byId.values()]
    }
  }

  return { weekStart: base.weekStart, days, oneOffByDate }
}

/** Same rules as initial load — never discard local-only tasks or completions. */
export function resolveWeeklyLogMerge(cloud: WeeklyLog, local: WeeklyLog | null): WeeklyLog {
  if (!local || local.weekStart !== cloud.weekStart) return cloud
  if (!weeklyLogHasContent(local)) return cloud
  if (!weeklyLogHasContent(cloud)) return local
  return mergeWeeklyLogs(cloud, local)
}

/** Layer disk + in-memory (and any other) sources; later sources win on conflicts. */
export function mergeWeeklyLogSources(
  cloud: WeeklyLog,
  ...sources: (WeeklyLog | null | undefined)[]
): WeeklyLog {
  let result = cloud
  for (const source of sources) {
    if (!source) continue
    result = resolveWeeklyLogMerge(result, source)
  }
  return result
}

export function countWeeklyCompletions(log: WeeklyLog): number {
  let n = 0
  for (const blockMap of Object.values(log.days)) {
    if (!blockMap) continue
    for (const block of Object.values(blockMap)) {
      for (const done of Object.values(block.taskCompletion ?? {})) {
        if (done) n += 1
      }
    }
  }
  for (const blockMap of Object.values(log.oneOffByDate)) {
    for (const tasks of Object.values(blockMap)) {
      for (const task of tasks) {
        if (task.done) n += 1
      }
    }
  }
  return n
}

export function countOneOffTasks(log: WeeklyLog): number {
  let n = 0
  for (const blockMap of Object.values(log.oneOffByDate)) {
    for (const tasks of Object.values(blockMap)) {
      n += tasks.length
    }
  }
  return n
}

/** Merge cloud + locals and re-layer any source that would lose completions or one-offs. */
export function coalesceWeeklyLog(
  cloud: WeeklyLog,
  ...sources: (WeeklyLog | null | undefined)[]
): WeeklyLog {
  let merged = mergeWeeklyLogSources(cloud, ...sources)
  for (const source of sources) {
    if (!source || source.weekStart !== merged.weekStart) continue
    const loseCompletions = countWeeklyCompletions(merged) < countWeeklyCompletions(source)
    const loseOneOffs = countOneOffTasks(merged) < countOneOffTasks(source)
    if (loseCompletions || loseOneOffs) {
      merged = mergeWeeklyLogs(merged, source)
    }
  }
  return merged
}
