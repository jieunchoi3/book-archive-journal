import type { LdAnswer, LdQuestion, LdSnapshot, SnapshotStatus } from '../types/compass'
import type { ExerciseKey } from '../types/compass'
import { supabase } from './supabase'

type SnapshotRow = {
  id: string
  user_id: string
  exercise_key: string
  taken_at: string
  label: string | null
  status: SnapshotStatus
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

type QuestionRow = {
  id: string
  user_id: string
  body: string
  cadence_days: number
  next_due_on: string
  is_active: boolean
  color: string
  created_at: string
}

type AnswerRow = {
  id: string
  question_id: string
  user_id: string
  answered_on: string
  body: string
  feeling: number | null
  created_at: string
}

function rowToSnapshot(row: SnapshotRow): LdSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    exerciseKey: row.exercise_key as ExerciseKey,
    takenAt: row.taken_at,
    label: row.label,
    status: row.status,
    data: row.data ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function snapshotToRow(s: LdSnapshot) {
  return {
    id: s.id,
    user_id: s.userId,
    exercise_key: s.exerciseKey,
    taken_at: s.takenAt,
    label: s.label,
    status: s.status,
    data: s.data,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }
}

function rowToQuestion(row: QuestionRow): LdQuestion {
  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    cadenceDays: row.cadence_days,
    nextDueOn: row.next_due_on,
    isActive: row.is_active,
    color: row.color,
    createdAt: row.created_at,
  }
}

function questionToRow(q: LdQuestion) {
  return {
    id: q.id,
    user_id: q.userId,
    body: q.body,
    cadence_days: q.cadenceDays,
    next_due_on: q.nextDueOn,
    is_active: q.isActive,
    color: q.color,
    created_at: q.createdAt,
  }
}

function rowToAnswer(row: AnswerRow): LdAnswer {
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    answeredOn: row.answered_on,
    body: row.body,
    feeling: row.feeling,
    createdAt: row.created_at,
  }
}

function answerToRow(a: LdAnswer) {
  return {
    id: a.id,
    question_id: a.questionId,
    user_id: a.userId,
    answered_on: a.answeredOn,
    body: a.body,
    feeling: a.feeling,
    created_at: a.createdAt,
  }
}

export async function fetchCompassCloud(userId: string): Promise<{
  snapshots: LdSnapshot[]
  questions: LdQuestion[]
  answers: LdAnswer[]
} | null> {
  const [snapRes, qRes, aRes] = await Promise.all([
    supabase.from('ld_snapshot').select('*').eq('user_id', userId),
    supabase.from('ld_question').select('*').eq('user_id', userId),
    supabase.from('ld_answer').select('*').eq('user_id', userId),
  ])

  if (snapRes.error || qRes.error || aRes.error) {
    const msg =
      snapRes.error?.message || qRes.error?.message || aRes.error?.message || ''
    // Table missing / not exposed yet — treat as empty remote
    if (/relation|schema cache|does not exist|404/i.test(msg)) return null
    throw snapRes.error || qRes.error || aRes.error
  }

  return {
    snapshots: ((snapRes.data ?? []) as SnapshotRow[]).map(rowToSnapshot),
    questions: ((qRes.data ?? []) as QuestionRow[]).map(rowToQuestion),
    answers: ((aRes.data ?? []) as AnswerRow[]).map(rowToAnswer),
  }
}

export async function upsertSnapshotCloud(snapshot: LdSnapshot): Promise<void> {
  const { error } = await supabase
    .from('ld_snapshot')
    .upsert(snapshotToRow(snapshot), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteSnapshotCloud(id: string): Promise<void> {
  const { error } = await supabase.from('ld_snapshot').delete().eq('id', id)
  if (error) throw error
}

export async function upsertQuestionCloud(question: LdQuestion): Promise<void> {
  const { error } = await supabase
    .from('ld_question')
    .upsert(questionToRow(question), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteQuestionCloud(id: string): Promise<void> {
  const { error } = await supabase.from('ld_question').delete().eq('id', id)
  if (error) throw error
}

export async function upsertAnswerCloud(answer: LdAnswer): Promise<void> {
  const { error } = await supabase
    .from('ld_answer')
    .upsert(answerToRow(answer), { onConflict: 'id' })
  if (error) throw error
}
