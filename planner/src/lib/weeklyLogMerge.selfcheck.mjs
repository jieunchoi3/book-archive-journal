/**
 * Run: node planner/src/lib/weeklyLogMerge.selfcheck.mjs
 * Lightweight sanity checks for weekly log merge (no test runner required).
 */

function mergeWeeklyLogs(base, incoming) {
  if (base.weekStart !== incoming.weekStart) return base
  const days = { ...base.days }
  for (const [dayKey, blockMap] of Object.entries(incoming.days ?? {})) {
    if (!blockMap) continue
    if (!days[dayKey]) days[dayKey] = {}
    for (const [blockId, blockLog] of Object.entries(blockMap)) {
      const existing = days[dayKey][blockId] ?? { taskCompletion: {} }
      days[dayKey][blockId] = {
        ...existing,
        ...blockLog,
        taskCompletion: {
          ...existing.taskCompletion,
          ...(blockLog.taskCompletion ?? {}),
        },
      }
    }
  }
  const oneOffByDate = { ...base.oneOffByDate }
  for (const [dateKey, blockMap] of Object.entries(incoming.oneOffByDate ?? {})) {
    for (const [blockId, tasks] of Object.entries(blockMap)) {
      const existing = oneOffByDate[dateKey]?.[blockId] ?? []
      const byId = new Map(existing.map((t) => [t.id, t]))
      for (const task of tasks) {
        const prev = byId.get(task.id)
        byId.set(task.id, prev ? { ...prev, ...task, done: task.done } : task)
      }
      if (!oneOffByDate[dateKey]) oneOffByDate[dateKey] = {}
      oneOffByDate[dateKey][blockId] = [...byId.values()]
    }
  }
  return { weekStart: base.weekStart, days, oneOffByDate }
}

const week = '2026-09-21'
const cloud = {
  weekStart: week,
  days: { mon: { b1: { taskCompletion: { t1: false } } } },
  oneOffByDate: {},
}
const local = {
  weekStart: week,
  days: { mon: { b1: { taskCompletion: { t1: true } } } },
  oneOffByDate: {
    '2026-09-22': { b1: [{ id: 'o1', label: 'New task', done: false }] },
  },
}

const merged = mergeWeeklyLogs(cloud, local)
if (merged.days.mon.b1.taskCompletion.t1 !== true) {
  console.error('FAIL: local completion should win')
  process.exit(1)
}
if (!merged.oneOffByDate['2026-09-22']?.b1?.length) {
  console.error('FAIL: local one-off task should survive merge')
  process.exit(1)
}

console.log('weeklyLogMerge selfcheck: OK')
