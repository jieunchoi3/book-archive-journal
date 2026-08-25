import type {
  AeiouData,
  AiReportOutput,
  AiReportType,
  ExerciseKey,
  JournalDuration,
  LdAiReport,
  LdAnswer,
  LdJournalEntry,
  LdPrototype,
  LdQuestion,
  LdSnapshot,
  PrototypeKind,
  PrototypeStatus,
  SnapshotStatus,
} from '../types/compass'
import { JOURNAL_DURATIONS } from '../types/compass'
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

type JournalRow = {
  id: string
  user_id: string
  run_id: string | null
  entry_date: string
  activity: string
  duration_min: number
  engagement: number
  energy: number
  is_flow: boolean
  zoom_note: string | null
  aeiou: AeiouData | null
  created_at: string
  /** legacy */
  bucket?: string | null
  note?: string | null
}

type PrototypeRow = {
  id: string
  user_id: string
  kind: PrototypeKind
  title: string
  person: string | null
  happened_on: string | null
  going_in_q: string | null
  learned: string | null
  next_step: string | null
  linked_plan: string | null
  status: PrototypeStatus
  created_at: string
}

type AiReportRow = {
  id: string
  user_id: string
  report_type: AiReportType
  input_hash: string
  input_refs: Record<string, unknown>
  output: AiReportOutput
  model: string | null
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

function rowToJournal(row: JournalRow): LdJournalEntry {
  const durationRaw = row.duration_min ?? 60
  const durationMin = (
    JOURNAL_DURATIONS.includes(durationRaw as JournalDuration)
      ? durationRaw
      : 60
  ) as JournalDuration
  return {
    id: row.id,
    userId: row.user_id,
    runId: row.run_id ?? null,
    entryDate: row.entry_date,
    activity: row.activity,
    durationMin,
    engagement: row.engagement,
    energy: row.energy,
    isFlow: row.is_flow,
    zoomNote: row.zoom_note ?? null,
    aeiou: row.aeiou,
    createdAt: row.created_at,
    note: row.note ?? null,
  }
}

function journalToRow(e: LdJournalEntry) {
  return {
    id: e.id,
    user_id: e.userId,
    run_id: e.runId,
    entry_date: e.entryDate,
    activity: e.activity,
    duration_min: e.durationMin,
    engagement: e.engagement,
    energy: e.energy,
    is_flow: e.isFlow,
    zoom_note: e.zoomNote,
    aeiou: e.aeiou,
    created_at: e.createdAt,
  }
}

function rowToPrototype(row: PrototypeRow): LdPrototype {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    person: row.person,
    happenedOn: row.happened_on,
    goingInQ: row.going_in_q,
    learned: row.learned,
    nextStep: row.next_step,
    linkedPlan: row.linked_plan,
    status: row.status,
    createdAt: row.created_at,
  }
}

function prototypeToRow(p: LdPrototype) {
  return {
    id: p.id,
    user_id: p.userId,
    kind: p.kind,
    title: p.title,
    person: p.person,
    happened_on: p.happenedOn,
    going_in_q: p.goingInQ,
    learned: p.learned,
    next_step: p.nextStep,
    linked_plan: p.linkedPlan,
    status: p.status,
    created_at: p.createdAt,
  }
}

function rowToAiReport(row: AiReportRow): LdAiReport {
  return {
    id: row.id,
    userId: row.user_id,
    reportType: row.report_type,
    inputHash: row.input_hash,
    inputRefs: row.input_refs,
    output: row.output,
    model: row.model,
    createdAt: row.created_at,
  }
}

function aiReportToRow(r: LdAiReport) {
  return {
    id: r.id,
    user_id: r.userId,
    report_type: r.reportType,
    input_hash: r.inputHash,
    input_refs: r.inputRefs,
    output: r.output,
    model: r.model,
    created_at: r.createdAt,
  }
}

function isMissingTable(msg: string) {
  return /relation|schema cache|does not exist|404/i.test(msg)
}

export async function fetchCompassCloud(userId: string): Promise<{
  snapshots: LdSnapshot[]
  questions: LdQuestion[]
  answers: LdAnswer[]
  journalEntries: LdJournalEntry[]
  prototypes: LdPrototype[]
  aiReports: LdAiReport[]
} | null> {
  const [snapRes, qRes, aRes, jRes, pRes, aiRes] = await Promise.all([
    supabase.from('ld_snapshot').select('*').eq('user_id', userId),
    supabase.from('ld_question').select('*').eq('user_id', userId),
    supabase.from('ld_answer').select('*').eq('user_id', userId),
    supabase.from('ld_journal_entry').select('*').eq('user_id', userId),
    supabase.from('ld_prototype').select('*').eq('user_id', userId),
    supabase.from('ld_ai_report').select('*').eq('user_id', userId),
  ])

  if (snapRes.error || qRes.error || aRes.error) {
    const msg =
      snapRes.error?.message || qRes.error?.message || aRes.error?.message || ''
    if (isMissingTable(msg)) return null
    throw snapRes.error || qRes.error || aRes.error
  }

  const journalEntries =
    jRes.error && isMissingTable(jRes.error.message)
      ? []
      : jRes.error
        ? (() => {
            throw jRes.error
          })()
        : ((jRes.data ?? []) as JournalRow[]).map(rowToJournal)

  const prototypes =
    pRes.error && isMissingTable(pRes.error.message)
      ? []
      : pRes.error
        ? (() => {
            throw pRes.error
          })()
        : ((pRes.data ?? []) as PrototypeRow[]).map(rowToPrototype)

  const aiReports =
    aiRes.error && isMissingTable(aiRes.error.message)
      ? []
      : aiRes.error
        ? (() => {
            throw aiRes.error
          })()
        : ((aiRes.data ?? []) as AiReportRow[]).map(rowToAiReport)

  return {
    snapshots: ((snapRes.data ?? []) as SnapshotRow[]).map(rowToSnapshot),
    questions: ((qRes.data ?? []) as QuestionRow[]).map(rowToQuestion),
    answers: ((aRes.data ?? []) as AnswerRow[]).map(rowToAnswer),
    journalEntries,
    prototypes,
    aiReports,
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

export async function upsertJournalCloud(entry: LdJournalEntry): Promise<void> {
  const { error } = await supabase
    .from('ld_journal_entry')
    .upsert(journalToRow(entry), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteJournalCloud(id: string): Promise<void> {
  const { error } = await supabase.from('ld_journal_entry').delete().eq('id', id)
  if (error) throw error
}

export async function upsertPrototypeCloud(proto: LdPrototype): Promise<void> {
  const { error } = await supabase
    .from('ld_prototype')
    .upsert(prototypeToRow(proto), { onConflict: 'id' })
  if (error) throw error
}

export async function deletePrototypeCloud(id: string): Promise<void> {
  const { error } = await supabase.from('ld_prototype').delete().eq('id', id)
  if (error) throw error
}

export async function upsertAiReportCloud(report: LdAiReport): Promise<void> {
  const { error } = await supabase
    .from('ld_ai_report')
    .upsert(aiReportToRow(report), { onConflict: 'id' })
  if (error) throw error
}

export async function invokeCompassAnalyze(body: {
  reportType: AiReportType
  inputHash: string
  inputRefs: Record<string, unknown>
  payload: unknown
}): Promise<{ report: LdAiReport; cached: boolean }> {
  const { data, error } = await supabase.functions.invoke('compass-analyze', {
    body,
  })
  if (error) throw error
  const report = data?.report as LdAiReport | undefined
  if (!report) throw new Error('INVALID_AI_RESPONSE')
  return { report, cached: Boolean(data?.cached) }
}
