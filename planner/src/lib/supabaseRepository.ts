import type { BlockDayLog, DayKey, OneOffTask, WeekTemplate, WeeklyLog } from '../types/planner'
import { DAY_KEYS } from '../types/planner'
import type { Category, Item, Tag } from '../types/item'
import type { LinkedApp } from '../types/linkedApp'
import { DEFAULT_LINKED_APPS } from '../types/linkedApp'
import type { ItemsStore } from '../lib/itemStorageLegacy'
import { SEED_TEMPLATE } from '../data/seedTemplate'
import { supabase } from './supabase'
import { emptyWeeklyLog } from './storageUtils'
import { getDateKeyForDay } from './weekUtils'

/** Temporary debug — remove after confirming save/load round-trip */
function logWeeklyLogSnapshot(tag: 'SAVE' | 'LOAD', weekStart: string, log: WeeklyLog): void {
  const checked: { dateKey: string; taskId: string; blockId: string }[] = []
  for (const [dayKey, blockMap] of Object.entries(log.days)) {
    if (!blockMap) continue
    const dateKey = getDateKeyForDay(weekStart, dayKey as DayKey)
    for (const [blockId, blockLog] of Object.entries(blockMap)) {
      for (const [taskId, done] of Object.entries(blockLog.taskCompletion)) {
        if (done) checked.push({ dateKey, taskId, blockId })
      }
    }
  }
  const oneOff: { dateKey: string; taskId: string; label: string; done: boolean; blockId: string }[] =
    []
  for (const [dateKey, blockMap] of Object.entries(log.oneOffByDate)) {
    for (const [blockId, tasks] of Object.entries(blockMap)) {
      for (const task of tasks) {
        oneOff.push({ dateKey, taskId: task.id, label: task.label, done: task.done, blockId })
      }
    }
  }
  console.log(`[planner] ${tag} week=${weekStart}`, { checked, oneOff })
}

function logTemplateSnapshot(tag: 'SAVE' | 'LOAD', template: WeekTemplate): void {
  const recurring: { dayKey: string; blockId: string; taskId: string; label: string }[] = []
  for (const day of template.days) {
    for (const block of day.blocks) {
      for (const task of block.tasks) {
        recurring.push({
          dayKey: day.key,
          blockId: block.id,
          taskId: task.id,
          label: task.label,
        })
      }
    }
  }
  console.log(`[planner] ${tag} template`, { recurringCount: recurring.length, recurring })
}

export async function fetchTemplate(userId: string): Promise<WeekTemplate | null> {
  const [daysRes, blocksRes, tasksRes] = await Promise.all([
    supabase.from('day_templates').select('*').eq('user_id', userId),
    supabase.from('blocks').select('*').eq('user_id', userId).order('sort_order'),
    supabase.from('recurring_tasks').select('*').eq('user_id', userId).order('sort_order'),
  ])
  if (daysRes.error) throw daysRes.error
  if (blocksRes.error) throw blocksRes.error
  if (tasksRes.error) throw tasksRes.error
  if (!daysRes.data?.length) return null

  const tasksByBlock = new Map<string, (typeof tasksRes.data)[0][]>()
  for (const t of tasksRes.data ?? []) {
    const list = tasksByBlock.get(t.block_id) ?? []
    list.push(t)
    tasksByBlock.set(t.block_id, list)
  }

  const blocksByDay = new Map<string, (typeof blocksRes.data)[0][]>()
  for (const b of blocksRes.data ?? []) {
    const list = blocksByDay.get(b.day_key) ?? []
    list.push(b)
    blocksByDay.set(b.day_key, list)
  }

  const dayMap = new Map((daysRes.data ?? []).map((d) => [d.day_key, d]))

  const result = {
    days: DAY_KEYS.map((key) => {
      const dayMeta = dayMap.get(key)
      return {
        key,
        dayName: dayMeta?.day_name ?? key,
        dayType: (dayMeta?.day_type ?? 'office') as import('../types/planner').DayType,
        tag: dayMeta?.tag ?? '',
        blocks: (blocksByDay.get(key) ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          category: b.category as import('../types/planner').BlockCategory,
          timeRangeLabel: b.time_range_label,
          description: b.description,
          badges: (b.badges as string[]) ?? [],
          order: b.sort_order,
          isFlexible: b.is_flexible,
          tasks: (tasksByBlock.get(b.id) ?? []).map((t) => ({
            id: t.id,
            label: t.label,
          })),
        })),
      }
    }),
  }
  logTemplateSnapshot('LOAD', result)
  return result
}

export async function syncTemplate(userId: string, template: WeekTemplate): Promise<void> {
  logTemplateSnapshot('SAVE', template)
  const dayRows = template.days.map((d) => ({
    user_id: userId,
    day_key: d.key,
    day_name: d.dayName,
    day_type: d.dayType,
    tag: d.tag,
  }))
  const { error: dayErr } = await supabase
    .from('day_templates')
    .upsert(dayRows, { onConflict: 'user_id,day_key' })
  if (dayErr) throw dayErr

  const blockIds: string[] = []
  const taskIds: string[] = []

  for (const day of template.days) {
    for (let i = 0; i < day.blocks.length; i++) {
      const block = { ...day.blocks[i], order: i }
      blockIds.push(block.id)
      const { error } = await supabase.from('blocks').upsert({
        id: block.id,
        user_id: userId,
        day_key: day.key,
        title: block.title,
        category: block.category,
        time_range_label: block.timeRangeLabel,
        description: block.description,
        badges: block.badges,
        sort_order: i,
        is_flexible: block.isFlexible ?? false,
      })
      if (error) throw error

      for (let j = 0; j < block.tasks.length; j++) {
        const task = block.tasks[j]
        taskIds.push(task.id)
        const { error: tErr } = await supabase.from('recurring_tasks').upsert({
          id: task.id,
          user_id: userId,
          block_id: block.id,
          label: task.label,
          sort_order: j,
        })
        if (tErr) throw tErr
      }
    }
  }

  const { data: existingBlocks } = await supabase
    .from('blocks')
    .select('id')
    .eq('user_id', userId)
  const orphanBlocks = (existingBlocks ?? [])
    .map((b) => b.id)
    .filter((id) => !blockIds.includes(id))
  if (orphanBlocks.length) {
    await supabase.from('blocks').delete().in('id', orphanBlocks)
  }

  const { data: existingTasks } = await supabase
    .from('recurring_tasks')
    .select('id')
    .eq('user_id', userId)
  const orphanTasks = (existingTasks ?? [])
    .map((t) => t.id)
    .filter((id) => !taskIds.includes(id))
  if (orphanTasks.length) {
    await supabase.from('recurring_tasks').delete().in('id', orphanTasks)
  }
}

export async function fetchWeeklyLog(userId: string, weekStart: string): Promise<WeeklyLog> {
  const weekEnd = addDays(weekStart, 6)

  const [blockLogsRes, completionsRes, oneOffRes] = await Promise.all([
    supabase
      .from('block_week_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart),
    supabase
      .from('task_completions')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart),
    supabase
      .from('one_off_tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('task_date', weekStart)
      .lte('task_date', weekEnd),
  ])

  if (blockLogsRes.error) throw blockLogsRes.error
  if (completionsRes.error) throw completionsRes.error
  if (oneOffRes.error) throw oneOffRes.error

  const log = emptyWeeklyLog(weekStart)

  for (const row of blockLogsRes.data ?? []) {
    const dayKey = row.day_key as DayKey
    if (!log.days[dayKey]) log.days[dayKey] = {}
    log.days[dayKey]![row.block_id] = {
      taskCompletion: {},
      flexibleNote: row.flexible_note ?? undefined,
      hiddenRecurringTasks: (row.hidden_recurring_tasks as string[]) ?? [],
      hiddenTasks: (row.hidden_tasks as string[]) ?? [],
    }
  }

  for (const row of completionsRes.data ?? []) {
    const dayKey = row.day_key as DayKey
    if (!log.days[dayKey]) log.days[dayKey] = {}
    if (!log.days[dayKey]![row.block_id]) {
      log.days[dayKey]![row.block_id] = { taskCompletion: {} }
    }
    log.days[dayKey]![row.block_id].taskCompletion[row.task_id] = row.done
  }

  for (const row of oneOffRes.data ?? []) {
    const dateKey = row.task_date as string
    if (!log.oneOffByDate[dateKey]) log.oneOffByDate[dateKey] = {}
    if (!log.oneOffByDate[dateKey][row.block_id]) log.oneOffByDate[dateKey][row.block_id] = []
    log.oneOffByDate[dateKey][row.block_id].push({
      id: row.id,
      label: row.label,
      done: row.done,
    })
  }

  logWeeklyLogSnapshot('LOAD', weekStart, log)
  return log
}

function logRowUpsert(table: string, row: Record<string, unknown>): void {
  console.log(`[planner] UPSERT ${table}`, row)
}

export async function upsertTaskCompletion(
  userId: string,
  weekStart: string,
  dayKey: DayKey,
  blockId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  const row = {
    user_id: userId,
    week_start: weekStart,
    day_key: dayKey,
    block_id: blockId,
    task_id: taskId,
    done,
  }
  logRowUpsert('task_completions', row)
  const { error } = await supabase
    .from('task_completions')
    .upsert(row, { onConflict: 'user_id,week_start,day_key,block_id,task_id' })
  if (error) throw error
}

export async function upsertBlockWeekLog(
  userId: string,
  weekStart: string,
  dayKey: DayKey,
  blockId: string,
  blockLog: BlockDayLog,
): Promise<void> {
  const row = {
    user_id: userId,
    week_start: weekStart,
    day_key: dayKey,
    block_id: blockId,
    flexible_note: blockLog.flexibleNote ?? null,
    hidden_recurring_tasks: blockLog.hiddenRecurringTasks ?? [],
    hidden_tasks: blockLog.hiddenTasks ?? [],
  }
  logRowUpsert('block_week_logs', row)
  const { error } = await supabase
    .from('block_week_logs')
    .upsert(row, { onConflict: 'user_id,week_start,day_key,block_id' })
  if (error) throw error
}

export async function upsertOneOffTask(
  userId: string,
  task: OneOffTask,
  taskDate: string,
  blockId: string,
): Promise<void> {
  const row = {
    id: task.id,
    user_id: userId,
    task_date: taskDate,
    block_id: blockId,
    label: task.label,
    done: task.done,
  }
  logRowUpsert('one_off_tasks', row)
  const { error } = await supabase.from('one_off_tasks').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

export async function deleteOneOffTaskRow(userId: string, taskId: string): Promise<void> {
  console.log(`[planner] DELETE one_off_tasks`, { userId, taskId })
  const { error } = await supabase
    .from('one_off_tasks')
    .delete()
    .eq('user_id', userId)
    .eq('id', taskId)
  if (error) throw error
}

/** Bulk upsert for local import — no week-wide delete. */
export async function syncWeeklyLog(userId: string, log: WeeklyLog): Promise<void> {
  const weekStart = log.weekStart

  const blockLogRows: Record<string, unknown>[] = []
  const completionRows: Record<string, unknown>[] = []
  const oneOffRows: Record<string, unknown>[] = []

  for (const [dayKey, blockMap] of Object.entries(log.days)) {
    if (!blockMap) continue
    for (const [blockId, blockLog] of Object.entries(blockMap)) {
      if (
        blockLog.flexibleNote ||
        (blockLog.hiddenRecurringTasks && blockLog.hiddenRecurringTasks.length > 0) ||
        (blockLog.hiddenTasks && blockLog.hiddenTasks.length > 0)
      ) {
        blockLogRows.push({
          user_id: userId,
          week_start: weekStart,
          day_key: dayKey,
          block_id: blockId,
          flexible_note: blockLog.flexibleNote ?? null,
          hidden_recurring_tasks: blockLog.hiddenRecurringTasks ?? [],
          hidden_tasks: blockLog.hiddenTasks ?? [],
        })
      }
      for (const [taskId, done] of Object.entries(blockLog.taskCompletion)) {
        completionRows.push({
          user_id: userId,
          week_start: weekStart,
          day_key: dayKey,
          block_id: blockId,
          task_id: taskId,
          done,
        })
      }
    }
  }

  for (const [dateKey, blockMap] of Object.entries(log.oneOffByDate)) {
    for (const [blockId, tasks] of Object.entries(blockMap)) {
      for (const task of tasks) {
        oneOffRows.push({
          id: task.id,
          user_id: userId,
          task_date: dateKey,
          block_id: blockId,
          label: task.label,
          done: task.done,
        })
      }
    }
  }

  logWeeklyLogSnapshot('SAVE', weekStart, log)

  if (blockLogRows.length) {
    const { error } = await supabase
      .from('block_week_logs')
      .upsert(blockLogRows, { onConflict: 'user_id,week_start,day_key,block_id' })
    if (error) throw error
  }
  if (completionRows.length) {
    const { error } = await supabase
      .from('task_completions')
      .upsert(completionRows, { onConflict: 'user_id,week_start,day_key,block_id,task_id' })
    if (error) throw error
  }
  if (oneOffRows.length) {
    const { error } = await supabase.from('one_off_tasks').upsert(oneOffRows, { onConflict: 'id' })
    if (error) throw error
  }
}

export async function fetchItemsStore(userId: string): Promise<ItemsStore> {
  const [catRes, tagRes, itemRes, itemTagsRes] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('tags').select('*').eq('user_id', userId),
    supabase.from('items').select('*').eq('user_id', userId),
    supabase.from('item_tags').select('*').eq('user_id', userId),
  ])
  if (catRes.error) throw catRes.error
  if (tagRes.error) throw tagRes.error
  if (itemRes.error) throw itemRes.error
  if (itemTagsRes.error) throw itemTagsRes.error

  const tagsByItem = new Map<string, string[]>()
  for (const row of itemTagsRes.data ?? []) {
    const list = tagsByItem.get(row.item_id) ?? []
    list.push(row.tag_id)
    tagsByItem.set(row.item_id, list)
  }

  return {
    categories: (catRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    tags: (tagRes.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon ?? undefined,
    })),
    items: (itemRes.data ?? []).map((i) => ({
      id: i.id,
      title: i.title,
      categoryId: i.category_id,
      tagIds: tagsByItem.get(i.id) ?? [],
      dueDate: i.due_date,
      recurrence: i.recurrence as Item['recurrence'],
      done: i.done as Item['done'],
      showOnWeeklyView: i.show_on_weekly_view,
      time: i.time_label ?? undefined,
      checkable: i.checkable,
    })),
  }
}

export async function syncItemsStore(userId: string, store: ItemsStore): Promise<void> {
  for (const c of store.categories) {
    const { error } = await supabase.from('categories').upsert({
      id: c.id,
      user_id: userId,
      name: c.name,
      color: c.color,
    })
    if (error) throw error
  }

  const { data: existingCats } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
  const catIds = store.categories.map((c) => c.id)
  const orphanCats = (existingCats ?? []).map((c) => c.id).filter((id) => !catIds.includes(id))
  if (orphanCats.length) await supabase.from('categories').delete().in('id', orphanCats)

  for (const t of store.tags) {
    const { error } = await supabase.from('tags').upsert({
      id: t.id,
      user_id: userId,
      name: t.name,
      icon: t.icon ?? null,
    })
    if (error) throw error
  }

  const { data: existingTags } = await supabase.from('tags').select('id').eq('user_id', userId)
  const tagIds = store.tags.map((t) => t.id)
  const orphanTags = (existingTags ?? []).map((t) => t.id).filter((id) => !tagIds.includes(id))
  if (orphanTags.length) await supabase.from('tags').delete().in('id', orphanTags)

  await supabase.from('item_tags').delete().eq('user_id', userId)

  for (const item of store.items) {
    const { error } = await supabase.from('items').upsert({
      id: item.id,
      user_id: userId,
      title: item.title,
      category_id: item.categoryId,
      due_date: item.dueDate,
      recurrence: item.recurrence,
      done: item.done,
      show_on_weekly_view: item.showOnWeeklyView,
      time_label: item.time ?? null,
      checkable: item.checkable,
    })
    if (error) throw error

    if (item.tagIds.length) {
      const { error: tagErr } = await supabase.from('item_tags').insert(
        item.tagIds.map((tagId) => ({
          item_id: item.id,
          tag_id: tagId,
          user_id: userId,
        })),
      )
      if (tagErr) throw tagErr
    }
  }

  const { data: existingItems } = await supabase.from('items').select('id').eq('user_id', userId)
  const itemIds = store.items.map((i) => i.id)
  const orphanItems = (existingItems ?? []).map((i) => i.id).filter((id) => !itemIds.includes(id))
  if (orphanItems.length) await supabase.from('items').delete().in('id', orphanItems)
}

export async function fetchLinkedApps(userId: string): Promise<LinkedApp[]> {
  const { data, error } = await supabase
    .from('linked_apps')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
  if (error) throw error
  if (!data?.length) return seedDefaultLinkedApps(userId)
  return data.map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    icon: a.icon ?? undefined,
    openMode: a.open_mode as LinkedApp['openMode'],
  }))
}

export async function seedDefaultLinkedApps(userId: string): Promise<LinkedApp[]> {
  const apps = structuredClone(DEFAULT_LINKED_APPS)
  await syncLinkedApps(userId, apps)
  return apps
}

export async function fetchSidebarNote(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sidebar_notes')
    .select('content')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return data.content ?? ''
}

export async function upsertSidebarNote(userId: string, content: string): Promise<void> {
  const { error } = await supabase.from('sidebar_notes').upsert({
    user_id: userId,
    content,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function syncLinkedApps(userId: string, apps: LinkedApp[]): Promise<void> {
  for (let i = 0; i < apps.length; i++) {
    const app = apps[i]
    const { error } = await supabase.from('linked_apps').upsert({
      id: app.id,
      user_id: userId,
      name: app.name,
      url: app.url,
      icon: app.icon ?? null,
      open_mode: app.openMode,
      sort_order: i,
    })
    if (error) throw error
  }
  const { data: existing } = await supabase.from('linked_apps').select('id').eq('user_id', userId)
  const ids = apps.map((a) => a.id)
  const orphans = (existing ?? []).map((a) => a.id).filter((id) => !ids.includes(id))
  if (orphans.length) await supabase.from('linked_apps').delete().in('id', orphans)
}

export async function seedDefaultTemplate(userId: string): Promise<WeekTemplate> {
  const seed = structuredClone(SEED_TEMPLATE)
  await syncTemplate(userId, seed)
  return seed
}

export async function importAllFromLocal(
  userId: string,
  data: {
    template: WeekTemplate
    weeklyLogs: WeeklyLog[]
    itemsStore: ItemsStore
    linkedApps: LinkedApp[]
  },
): Promise<void> {
  await syncTemplate(userId, data.template)
  for (const log of data.weeklyLogs) {
    await syncWeeklyLog(userId, log)
  }
  await syncItemsStore(userId, data.itemsStore)
  await syncLinkedApps(userId, data.linkedApps)
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export type { Category, Tag, Item, LinkedApp }
