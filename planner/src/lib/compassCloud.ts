import type {
  AeiouData,
  AiReportOutput,
  AiReportType,
  ExerciseKey,
  JournalDuration,
  LdAiReport,
  LdAnswer,
  LdJournalEntry,
  LdProtoIdea,
  LdProtoQuestion,
  LdPrototype,
  LdQuestion,
  LdSnapshot,
  PrototypeKind,
  PrototypeStatus,
  SnapshotStatus,
} from '../types/compass'
import {
  JOURNAL_DURATIONS,
  normalizeProtoIdea,
  normalizeProtoQuestion,
  normalizePrototype,
} from '../types/compass'
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
  question_id: string | null
  kind: PrototypeKind
  title: string
  person: string | null
  how_known: string | null
  prep_checks: Record<string, unknown> | null
  questions: string[] | null
  scope: string | null
  duration: string | null
  learn_goal: string | null
  happened_on: string | null
  learned: string | null
  answered: string | null
  engagement: number | null
  energy: number | null
  referral: string | null
  going_in_q: string | null
  next_step: string | null
  linked_plan: string | null
  status: PrototypeStatus
  created_at: string
}

type ProtoQuestionRow = {
  id: string
  user_id: string
  body: string
  origin: string
  origin_ref: Record<string, unknown> | null
  is_open: boolean
  created_at: string
}

type ProtoIdeaRow = {
  id: string
  user_id: string
  question_id: string
  kind: PrototypeKind
  body: string
  promoted: boolean
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
  return (
    normalizePrototype({
      id: row.id,
      user_id: row.user_id,
      question_id: row.question_id,
      kind: row.kind,
      title: row.title,
      person: row.person,
      how_known: row.how_known,
      prep_checks: row.prep_checks,
      questions: row.questions,
      scope: row.scope,
      duration: row.duration,
      learn_goal: row.learn_goal,
      happened_on: row.happened_on,
      learned: row.learned,
      answered: row.answered,
      engagement: row.engagement,
      energy: row.energy,
      referral: row.referral,
      going_in_q: row.going_in_q,
      next_step: row.next_step,
      linked_plan: row.linked_plan,
      status: row.status,
      created_at: row.created_at,
    }) ?? {
      id: row.id,
      userId: row.user_id,
      questionId: row.question_id ?? '',
      kind: row.kind,
      title: row.title,
      status: row.status,
      person: row.person,
      howKnown: null,
      prepChecks: null,
      questions: [],
      scope: null,
      duration: null,
      learnGoal: null,
      happenedOn: row.happened_on,
      learned: row.learned,
      answered: null,
      engagement: null,
      energy: null,
      referral: null,
      createdAt: row.created_at,
    }
  )
}

function prototypeToRow(p: LdPrototype) {
  return {
    id: p.id,
    user_id: p.userId,
    question_id: p.questionId || null,
    kind: p.kind,
    title: p.title,
    person: p.person,
    how_known: p.howKnown,
    prep_checks: p.prepChecks
      ? {
          not_job: p.prepChecks.notJob,
          listen: p.prepChecks.listen,
          questions: p.prepChecks.questions,
        }
      : null,
    questions: p.questions,
    scope: p.scope,
    duration: p.duration,
    learn_goal: p.learnGoal,
    happened_on: p.happenedOn,
    learned: p.learned,
    answered: p.answered,
    engagement: p.engagement,
    energy: p.energy,
    referral: p.referral,
    going_in_q: p.goingInQ ?? null,
    next_step: p.nextStep ?? null,
    linked_plan: p.linkedPlan ?? null,
    status: p.status,
    created_at: p.createdAt,
  }
}

function rowToProtoQuestion(row: ProtoQuestionRow): LdProtoQuestion {
  return (
    normalizeProtoQuestion({
      id: row.id,
      user_id: row.user_id,
      body: row.body,
      origin: row.origin,
      origin_ref: row.origin_ref,
      is_open: row.is_open,
      created_at: row.created_at,
    }) ?? {
      id: row.id,
      userId: row.user_id,
      body: row.body,
      origin: 'manual',
      originRef: null,
      isOpen: row.is_open,
      createdAt: row.created_at,
    }
  )
}

function protoQuestionToRow(q: LdProtoQuestion) {
  return {
    id: q.id,
    user_id: q.userId,
    body: q.body,
    origin: q.origin,
    origin_ref: q.originRef,
    is_open: q.isOpen,
    created_at: q.createdAt,
  }
}

function rowToProtoIdea(row: ProtoIdeaRow): LdProtoIdea {
  return (
    normalizeProtoIdea({
      id: row.id,
      user_id: row.user_id,
      question_id: row.question_id,
      kind: row.kind,
      body: row.body,
      promoted: row.promoted,
      created_at: row.created_at,
    }) ?? {
      id: row.id,
      userId: row.user_id,
      questionId: row.question_id,
      kind: row.kind,
      body: row.body,
      promoted: row.promoted,
      createdAt: row.created_at,
    }
  )
}

function protoIdeaToRow(i: LdProtoIdea) {
  return {
    id: i.id,
    user_id: i.userId,
    question_id: i.questionId,
    kind: i.kind,
    body: i.body,
    promoted: i.promoted,
    created_at: i.createdAt,
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
  protoQuestions: LdProtoQuestion[]
  protoIdeas: LdProtoIdea[]
  aiReports: LdAiReport[]
} | null> {
  const [snapRes, qRes, aRes, jRes, pRes, pqRes, piRes, aiRes] = await Promise.all([
    supabase.from('ld_snapshot').select('*').eq('user_id', userId),
    supabase.from('ld_question').select('*').eq('user_id', userId),
    supabase.from('ld_answer').select('*').eq('user_id', userId),
    supabase.from('ld_journal_entry').select('*').eq('user_id', userId),
    supabase.from('ld_prototype').select('*').eq('user_id', userId),
    supabase.from('ld_proto_question').select('*').eq('user_id', userId),
    supabase.from('ld_proto_idea').select('*').eq('user_id', userId),
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

  const protoQuestions =
    pqRes.error && isMissingTable(pqRes.error.message)
      ? []
      : pqRes.error
        ? (() => {
            throw pqRes.error
          })()
        : ((pqRes.data ?? []) as ProtoQuestionRow[]).map(rowToProtoQuestion)

  const protoIdeas =
    piRes.error && isMissingTable(piRes.error.message)
      ? []
      : piRes.error
        ? (() => {
            throw piRes.error
          })()
        : ((piRes.data ?? []) as ProtoIdeaRow[]).map(rowToProtoIdea)

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
    protoQuestions,
    protoIdeas,
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

export async function upsertProtoQuestionCloud(
  q: LdProtoQuestion,
): Promise<void> {
  const { error } = await supabase
    .from('ld_proto_question')
    .upsert(protoQuestionToRow(q), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteProtoQuestionCloud(id: string): Promise<void> {
  const { error } = await supabase.from('ld_proto_question').delete().eq('id', id)
  if (error) throw error
}

export async function upsertProtoIdeaCloud(idea: LdProtoIdea): Promise<void> {
  const { error } = await supabase
    .from('ld_proto_idea')
    .upsert(protoIdeaToRow(idea), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteProtoIdeaCloud(id: string): Promise<void> {
  const { error } = await supabase.from('ld_proto_idea').delete().eq('id', id)
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
