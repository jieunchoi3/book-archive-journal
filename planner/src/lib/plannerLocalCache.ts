import type { WeekTemplate, WeeklyLog } from '../types/planner'

function weekLogKey(userId: string, weekStart: string) {
  return `planner:weekLog:${userId}:${weekStart}`
}

function templateKey(userId: string) {
  return `planner:template:${userId}`
}

export function saveWeeklyLogLocal(userId: string, log: WeeklyLog): void {
  try {
    localStorage.setItem(weekLogKey(userId, log.weekStart), JSON.stringify(log))
  } catch {
    // ignore quota / private mode
  }
}

export function loadWeeklyLogLocal(userId: string, weekStart: string): WeeklyLog | null {
  try {
    const raw = localStorage.getItem(weekLogKey(userId, weekStart))
    if (!raw) return null
    return JSON.parse(raw) as WeeklyLog
  } catch {
    return null
  }
}

export function saveTemplateLocal(userId: string, template: WeekTemplate): void {
  try {
    localStorage.setItem(templateKey(userId), JSON.stringify(template))
  } catch {
    // ignore quota / private mode
  }
}

export function loadTemplateLocal(userId: string): WeekTemplate | null {
  try {
    const raw = localStorage.getItem(templateKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as WeekTemplate
  } catch {
    return null
  }
}

export function weeklyLogHasContent(log: WeeklyLog): boolean {
  const hasDayLogs = Object.values(log.days).some((day) =>
    Object.values(day).some(
      (block) =>
        Object.keys(block.taskCompletion ?? {}).length > 0 ||
        Boolean(block.flexibleNote?.trim()) ||
        (block.hiddenTasks?.length ?? 0) > 0 ||
        (block.hiddenRecurringTasks?.length ?? 0) > 0,
    ),
  )
  const hasOneOff = Object.values(log.oneOffByDate).some((dateMap) =>
    Object.values(dateMap).some((tasks) => tasks.length > 0),
  )
  return hasDayLogs || hasOneOff
}
