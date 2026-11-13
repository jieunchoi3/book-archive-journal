import type { DayKey } from '../types/planner'
import type {
  CommitmentDefaultTask,
  CommitmentPlacementTask,
  WeekCommitment,
  WeekCommitmentPlacement,
  WeekCommitmentStore,
} from '../types/weekCommitment'
import { emptyCommitmentStore } from '../types/weekCommitment'
import { supabase } from './supabase'
import {
  loadWeekCommitmentStoreLocal,
  saveWeekCommitmentStoreLocal,
} from './weekCommitmentCache'

type CommitmentRow = {
  id: string
  title: string
  color: string
  target_per_week: number
  default_tasks: CommitmentDefaultTask[] | null
  sort_order: number
}

type PlacementRow = {
  id: string
  week_start: string
  commitment_id: string
  day_key: string
  sort_order: number
}

type TaskRow = {
  id: string
  placement_id: string
  label: string
  done: boolean
  repeat_weekly: boolean
  source_default_id: string | null
  sort_order: number
}

function normalizeDefaultTasks(raw: unknown): CommitmentDefaultTask[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is CommitmentDefaultTask => Boolean(t && typeof t === 'object'))
    .map((t, i) => ({
      id: typeof t.id === 'string' ? t.id : `dt-${i}`,
      label: String(t.label ?? '').trim() || 'Task',
      repeatWeekly: Boolean(t.repeatWeekly),
    }))
}

function rowToCommitment(row: CommitmentRow): WeekCommitment {
  return {
    id: row.id,
    title: row.title,
    color: row.color || '#007AFF',
    targetPerWeek: row.target_per_week ?? 1,
    defaultTasks: normalizeDefaultTasks(row.default_tasks),
    sortOrder: row.sort_order ?? 0,
  }
}

export async function fetchWeekCommitmentStore(userId: string): Promise<WeekCommitmentStore> {
  const [cRes, pRes, tRes] = await Promise.all([
    supabase.from('week_commitments').select('*').eq('user_id', userId).order('sort_order'),
    supabase.from('week_commitment_placements').select('*').eq('user_id', userId),
    supabase.from('week_commitment_tasks').select('*').eq('user_id', userId).order('sort_order'),
  ])
  if (cRes.error) throw cRes.error
  if (pRes.error) throw pRes.error
  if (tRes.error) throw tRes.error

  const tasksByPlacement = new Map<string, CommitmentPlacementTask[]>()
  for (const row of (tRes.data ?? []) as TaskRow[]) {
    const list = tasksByPlacement.get(row.placement_id) ?? []
    list.push({
      id: row.id,
      label: row.label,
      done: row.done,
      repeatWeekly: row.repeat_weekly,
      sourceDefaultId: row.source_default_id ?? undefined,
      sortOrder: row.sort_order ?? 0,
    })
    tasksByPlacement.set(row.placement_id, list)
  }

  const placements: WeekCommitmentPlacement[] = ((pRes.data ?? []) as PlacementRow[]).map(
    (row) => ({
      id: row.id,
      weekStart: String(row.week_start).slice(0, 10),
      commitmentId: row.commitment_id,
      dayKey: row.day_key as DayKey,
      sortOrder: row.sort_order ?? 0,
      tasks: tasksByPlacement.get(row.id) ?? [],
    }),
  )

  return {
    commitments: ((cRes.data ?? []) as CommitmentRow[]).map(rowToCommitment),
    placements,
  }
}

function mergeStores(cloud: WeekCommitmentStore, local: WeekCommitmentStore): WeekCommitmentStore {
  const commitments = new Map<string, WeekCommitment>()
  for (const c of cloud.commitments) commitments.set(c.id, c)
  for (const c of local.commitments) {
    const existing = commitments.get(c.id)
    commitments.set(c.id, existing ? { ...existing, ...c, id: c.id } : c)
  }

  const placements = new Map<string, WeekCommitmentPlacement>()
  for (const p of cloud.placements) placements.set(p.id, p)
  for (const p of local.placements) {
    const existing = placements.get(p.id)
    if (!existing) {
      placements.set(p.id, p)
      continue
    }
    const taskMap = new Map(existing.tasks.map((t) => [t.id, t]))
    for (const t of p.tasks) {
      const prev = taskMap.get(t.id)
      taskMap.set(t.id, prev ? { ...prev, ...t, id: t.id } : t)
    }
    placements.set(p.id, {
      ...existing,
      ...p,
      id: p.id,
      tasks: [...taskMap.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    })
  }

  return {
    commitments: [...commitments.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    placements: [...placements.values()],
  }
}

/** Upsert store without wiping unrelated planner tables. */
export async function syncWeekCommitmentStore(
  userId: string,
  store: WeekCommitmentStore,
): Promise<void> {
  const errors: string[] = []

  for (const c of store.commitments) {
    const { error } = await supabase.from('week_commitments').upsert({
      id: c.id,
      user_id: userId,
      title: c.title,
      color: c.color,
      target_per_week: c.targetPerWeek,
      default_tasks: c.defaultTasks,
      sort_order: c.sortOrder,
      updated_at: new Date().toISOString(),
    })
    if (error) errors.push(`commitment ${c.id}: ${error.message}`)
  }

  const commitmentIds = new Set(store.commitments.map((c) => c.id))
  const { data: remoteCommitments } = await supabase
    .from('week_commitments')
    .select('id')
    .eq('user_id', userId)
  for (const row of remoteCommitments ?? []) {
    if (commitmentIds.has(row.id)) continue
    const { error } = await supabase
      .from('week_commitments')
      .delete()
      .eq('user_id', userId)
      .eq('id', row.id)
    if (error) errors.push(`delete commitment ${row.id}: ${error.message}`)
  }

  for (const p of store.placements) {
    if (!commitmentIds.has(p.commitmentId)) continue
    const { error } = await supabase.from('week_commitment_placements').upsert({
      id: p.id,
      user_id: userId,
      week_start: p.weekStart,
      commitment_id: p.commitmentId,
      day_key: p.dayKey,
      sort_order: p.sortOrder,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      errors.push(`placement ${p.id}: ${error.message}`)
      continue
    }

    const taskIds = new Set(p.tasks.map((t) => t.id))
    for (const t of p.tasks) {
      const { error: tErr } = await supabase.from('week_commitment_tasks').upsert({
        id: t.id,
        user_id: userId,
        placement_id: p.id,
        label: t.label,
        done: t.done,
        repeat_weekly: t.repeatWeekly,
        source_default_id: t.sourceDefaultId ?? null,
        sort_order: t.sortOrder,
      })
      if (tErr) errors.push(`task ${t.id}: ${tErr.message}`)
    }

    const { data: remoteTasks } = await supabase
      .from('week_commitment_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('placement_id', p.id)
    for (const row of remoteTasks ?? []) {
      if (taskIds.has(row.id)) continue
      const { error } = await supabase
        .from('week_commitment_tasks')
        .delete()
        .eq('user_id', userId)
        .eq('id', row.id)
      if (error) errors.push(`delete task ${row.id}: ${error.message}`)
    }
  }

  const placementIds = new Set(store.placements.map((p) => p.id))
  const { data: remotePlacements } = await supabase
    .from('week_commitment_placements')
    .select('id')
    .eq('user_id', userId)
  for (const row of remotePlacements ?? []) {
    if (placementIds.has(row.id)) continue
    const { error } = await supabase
      .from('week_commitment_placements')
      .delete()
      .eq('user_id', userId)
      .eq('id', row.id)
    if (error) errors.push(`delete placement ${row.id}: ${error.message}`)
  }

  if (errors.length) {
    throw new Error(`syncWeekCommitmentStore partial failure (${errors.length}): ${errors[0]}`)
  }
}

export async function loadWeekCommitmentStoreMerged(
  userId: string,
): Promise<WeekCommitmentStore> {
  const local = loadWeekCommitmentStoreLocal(userId)
  let cloud = emptyCommitmentStore()
  try {
    cloud = await fetchWeekCommitmentStore(userId)
  } catch (e) {
    console.warn('[weekCommitments] cloud fetch failed, using local', e)
    return local
  }

  const merged = mergeStores(cloud, local)
  saveWeekCommitmentStoreLocal(userId, merged)

  const richerLocal =
    local.commitments.length > cloud.commitments.length ||
    local.placements.length > cloud.placements.length ||
    local.placements.some((lp) => !cloud.placements.some((cp) => cp.id === lp.id))

  if (richerLocal || cloud.commitments.length === 0 && local.commitments.length > 0) {
    try {
      await syncWeekCommitmentStore(userId, merged)
    } catch (e) {
      console.warn('[weekCommitments] push merged store failed', e)
    }
  }

  return merged
}
