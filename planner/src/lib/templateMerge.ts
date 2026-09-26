import type { Block, TaskTemplate, WeekTemplate } from '../types/planner'

function mergeTaskLists(cloudTasks: TaskTemplate[], localTasks: TaskTemplate[]): TaskTemplate[] {
  const map = new Map<string, TaskTemplate>()
  for (const task of cloudTasks) map.set(task.id, task)
  for (const task of localTasks) {
    const existing = map.get(task.id)
    if (!existing) {
      map.set(task.id, task)
      continue
    }
    map.set(task.id, {
      ...existing,
      ...task,
      label: task.label?.trim() ? task.label : existing.label,
    })
  }
  return [...map.values()]
}

function mergeBlocks(cloudBlocks: Block[], localBlocks: Block[]): Block[] {
  const localById = new Map(localBlocks.map((b) => [b.id, b]))
  const seen = new Set<string>()
  const merged = cloudBlocks.map((cloudBlock) => {
    seen.add(cloudBlock.id)
    const localBlock = localById.get(cloudBlock.id)
    if (!localBlock) return cloudBlock
    return {
      ...cloudBlock,
      ...localBlock,
      id: cloudBlock.id,
      tasks: mergeTaskLists(cloudBlock.tasks, localBlock.tasks),
    }
  })
  for (const localBlock of localBlocks) {
    if (!seen.has(localBlock.id)) merged.push(localBlock)
  }
  return merged
}

/** Union template tasks/blocks so pending local edits are not wiped by cloud revalidate. */
export function mergeWeekTemplates(cloud: WeekTemplate, local: WeekTemplate): WeekTemplate {
  const localDayByKey = new Map(local.days.map((d) => [d.key, d]))
  const days = cloud.days.map((cloudDay) => {
    const localDay = localDayByKey.get(cloudDay.key)
    if (!localDay) return cloudDay
    return {
      ...cloudDay,
      blocks: mergeBlocks(cloudDay.blocks, localDay.blocks),
    }
  })
  for (const localDay of local.days) {
    if (!days.some((d) => d.key === localDay.key)) {
      days.push(localDay)
    }
  }
  return { days }
}

export function templateTaskCount(template: WeekTemplate): number {
  return template.days.reduce((n, day) => n + day.blocks.reduce((m, b) => m + b.tasks.length, 0), 0)
}
