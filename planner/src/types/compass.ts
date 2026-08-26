export const COMPASS = {
  accent: '#3E6B5E',
  soft: '#E8EFEB',
  ink: '#2A4A40',
  line: '#A9C3B8',
  ghostOpacity: 0.28,
} as const

export const EXERCISE_KEYS = [
  'dashboard',
  'workview',
  'lifeview',
  'coherence',
  'goodtime',
  'mindmap',
  'odyssey',
  'prototype',
  'choosing',
  'failure',
  'gravity',
  'team',
] as const

export type ExerciseKey = (typeof EXERCISE_KEYS)[number]

export type SnapshotStatus = 'draft' | 'complete'

export interface LdSnapshot {
  id: string
  userId: string
  exerciseKey: ExerciseKey
  takenAt: string // YYYY-MM-DD
  label: string | null
  status: SnapshotStatus
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface LdQuestion {
  id: string
  userId: string
  body: string
  cadenceDays: number
  nextDueOn: string
  isActive: boolean
  color: string
  createdAt: string
}

export interface LdAnswer {
  id: string
  questionId: string
  userId: string
  answeredOn: string
  body: string
  feeling: number | null
  createdAt: string
}

export type DashboardGaugeKey = 'health' | 'work' | 'play' | 'love'

export type DashboardStep = 0 | 1 | 2 | 3 | 4 // health, work, play, love, summary

export interface DashboardAreaState {
  items: string[]
  gauge: number | null
  gauge_touched: boolean
  note: string
}

export interface DashboardData {
  order: DashboardGaugeKey[]
  areas: Record<DashboardGaugeKey, DashboardAreaState>
  change: string
  step: DashboardStep
  /** Legacy fields — ignored when areas present */
  gauges?: Record<DashboardGaugeKey, number>
  reasons?: Record<DashboardGaugeKey, string>
  friction?: string
}

export const DASHBOARD_GAUGES: {
  key: DashboardGaugeKey
  label: string
  color: string
}[] = [
  { key: 'health', label: '건강', color: '#5E8C7B' },
  { key: 'work', label: '일', color: '#3E6B5E' },
  { key: 'play', label: '놀이', color: '#C08A4A' },
  { key: 'love', label: '사랑', color: '#B4635A' },
]

export const DASHBOARD_ORDER: DashboardGaugeKey[] = [
  'health',
  'work',
  'play',
  'love',
]

function emptyArea(): DashboardAreaState {
  return { items: [], gauge: null, gauge_touched: false, note: '' }
}

export function emptyDashboardData(): DashboardData {
  return {
    order: [...DASHBOARD_ORDER],
    areas: {
      health: emptyArea(),
      work: emptyArea(),
      play: emptyArea(),
      love: emptyArea(),
    },
    change: '',
    step: 0,
  }
}

/** Read gauge from v2 or legacy snapshot data. */
export function getDashboardGauge(
  data: DashboardData | Record<string, unknown> | null | undefined,
  key: DashboardGaugeKey,
): number | null {
  if (!data || typeof data !== 'object') return null
  const d = data as DashboardData
  if (d.areas?.[key]) {
    const g = d.areas[key].gauge
    return typeof g === 'number' ? g : null
  }
  const legacy = d.gauges?.[key]
  return typeof legacy === 'number' ? legacy : null
}

export function normalizeDashboardData(raw: unknown): DashboardData {
  const empty = emptyDashboardData()
  if (!raw || typeof raw !== 'object') return empty
  const d = raw as Partial<DashboardData>

  if (d.areas && typeof d.areas === 'object') {
    const areas = { ...empty.areas }
    for (const key of DASHBOARD_ORDER) {
      const a = d.areas[key]
      areas[key] = {
        items: Array.isArray(a?.items)
          ? a!.items.filter((x) => typeof x === 'string')
          : [],
        gauge: typeof a?.gauge === 'number' ? a.gauge : null,
        gauge_touched: Boolean(a?.gauge_touched) || typeof a?.gauge === 'number',
        note: typeof a?.note === 'string' ? a.note : '',
      }
    }
    const step =
      typeof d.step === 'number' && d.step >= 0 && d.step <= 4
        ? (d.step as DashboardStep)
        : 0
    return {
      order: [...DASHBOARD_ORDER],
      areas,
      change: typeof d.change === 'string' ? d.change : '',
      step,
    }
  }

  // Migrate legacy flat gauges/reasons/friction
  if (d.gauges) {
    const areas = { ...empty.areas }
    for (const key of DASHBOARD_ORDER) {
      const g = d.gauges[key]
      areas[key] = {
        items: [],
        gauge: typeof g === 'number' ? Math.min(120, Math.max(0, g)) : null,
        gauge_touched: typeof g === 'number',
        note: d.reasons?.[key] ?? '',
      }
    }
    return {
      order: [...DASHBOARD_ORDER],
      areas,
      change: typeof d.friction === 'string' ? d.friction : '',
      step: 0,
    }
  }

  return empty
}

export function isDashboardData(data: unknown): data is DashboardData {
  if (!data || typeof data !== 'object') return false
  const d = data as DashboardData
  return Boolean(d.areas) || Boolean(d.gauges)
}

// ─── Journal / Prototype / AI ───────────────────────────────────────────────

export interface AeiouData {
  activities: string
  environments: string
  interactions: string
  objects: string
  users: string
}

export function emptyAeiou(): AeiouData {
  return {
    activities: '',
    environments: '',
    interactions: '',
    objects: '',
    users: '',
  }
}

export const JOURNAL_DURATIONS = [15, 30, 60, 120, 180] as const
export type JournalDuration = (typeof JOURNAL_DURATIONS)[number]

export const JOURNAL_DURATION_LABELS: Record<JournalDuration, string> = {
  15: '15분',
  30: '30분',
  60: '1시간',
  120: '2시간',
  180: '3시간+',
}

/** @deprecated buckets removed in goodtime v2 — kept for legacy reads */
export const JOURNAL_BUCKETS = [
  'work',
  'study',
  'social',
  'body',
  'admin',
  'rest',
  'play',
] as const

export type JournalBucket = (typeof JOURNAL_BUCKETS)[number]

export const JOURNAL_BUCKET_LABELS: Record<JournalBucket, string> = {
  work: '일',
  study: '공부',
  social: '사람',
  body: '몸',
  admin: '잡무',
  rest: '쉼',
  play: '놀이',
}

export interface LdJournalEntry {
  id: string
  userId: string
  /** goodtime snapshot (run) id */
  runId: string | null
  entryDate: string
  activity: string
  durationMin: JournalDuration
  engagement: number
  energy: number
  isFlow: boolean
  zoomNote: string | null
  aeiou: AeiouData | null
  createdAt: string
  /** @deprecated */
  bucket?: JournalBucket | null
  /** @deprecated */
  note?: string | null
}

export type GoodtimeState =
  | 'setup'
  | 'week1'
  | 'week2'
  | 'week3'
  | 'zoom'
  | 'aeiou'
  | 'closing'
  | 'done'

export interface GoodtimeWeeklyReview {
  week: 1 | 2 | 3
  range: [string, string]
  engaging: string
  draining: string
  surprise: string
}

export interface GoodtimeRunData {
  state: GoodtimeState
  started_on: string
  weekly: GoodtimeWeeklyReview[]
  zoom_picks: string[]
  closing: string
  week2_nudge_seen: boolean
  /** UI: which aeiou activity is focused */
  aeiou_index?: number
}

export function emptyGoodtimeRunData(startedOn = ''): GoodtimeRunData {
  return {
    state: 'setup',
    started_on: startedOn,
    weekly: [],
    zoom_picks: [],
    closing: '',
    week2_nudge_seen: false,
  }
}

export function normalizeGoodtimeRunData(raw: unknown): GoodtimeRunData {
  const empty = emptyGoodtimeRunData()
  if (!raw || typeof raw !== 'object') return empty
  const d = raw as Partial<GoodtimeRunData>
  const weekly = Array.isArray(d.weekly)
    ? d.weekly
        .filter((w) => w && typeof w === 'object')
        .map((w) => ({
          week: ([1, 2, 3].includes(Number(w.week))
            ? Number(w.week)
            : 1) as 1 | 2 | 3,
          range: Array.isArray(w.range)
            ? ([String(w.range[0] ?? ''), String(w.range[1] ?? '')] as [
                string,
                string,
              ])
            : (['', ''] as [string, string]),
          engaging: String(w.engaging ?? ''),
          draining: String(w.draining ?? ''),
          surprise: String(w.surprise ?? ''),
        }))
    : []
  const state = (
    [
      'setup',
      'week1',
      'week2',
      'week3',
      'zoom',
      'aeiou',
      'closing',
      'done',
    ] as GoodtimeState[]
  ).includes(d.state as GoodtimeState)
    ? (d.state as GoodtimeState)
    : 'setup'
  return {
    state,
    started_on: String(d.started_on ?? ''),
    weekly,
    zoom_picks: Array.isArray(d.zoom_picks)
      ? d.zoom_picks.map(String).filter(Boolean)
      : [],
    closing: String(d.closing ?? ''),
    week2_nudge_seen: Boolean(d.week2_nudge_seen),
    aeiou_index:
      typeof d.aeiou_index === 'number' ? d.aeiou_index : undefined,
  }
}

export function goodtimeWeekRange(
  startedOn: string,
  week: 1 | 2 | 3,
): [string, string] {
  const startOffset = (week - 1) * 7
  const start = addDays(startedOn, startOffset)
  const end = addDays(startedOn, startOffset + 6)
  return [start, end]
}

export function goodtimeWeekForDate(
  startedOn: string,
  dateKey: string,
): 1 | 2 | 3 | null {
  if (!startedOn || !dateKey) return null
  const day = daysBetween(startedOn, dateKey)
  if (day < 0) return null
  if (day <= 6) return 1
  if (day <= 13) return 2
  if (day <= 20) return 3
  return null
}

export function normalizeJournalEntry(raw: unknown): LdJournalEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Partial<LdJournalEntry> & {
    duration_min?: number
    run_id?: string
    zoom_note?: string
    is_flow?: boolean
    entry_date?: string
    user_id?: string
    created_at?: string
  }
  const durationRaw = e.durationMin ?? e.duration_min ?? 60
  const durationMin = (
    JOURNAL_DURATIONS.includes(durationRaw as JournalDuration)
      ? durationRaw
      : 60
  ) as JournalDuration
  const eng = Number(e.engagement ?? 0)
  const ene = Number(e.energy ?? 0)
  return {
    id: String(e.id ?? ''),
    userId: String(e.userId ?? e.user_id ?? ''),
    runId: (e.runId ?? e.run_id ?? null) as string | null,
    entryDate: String(e.entryDate ?? e.entry_date ?? ''),
    activity: String(e.activity ?? ''),
    durationMin,
    engagement: Math.max(-5, Math.min(5, eng)),
    energy: Math.max(-5, Math.min(5, ene)),
    isFlow: Boolean(e.isFlow ?? e.is_flow),
    zoomNote: (e.zoomNote ?? e.zoom_note ?? null) as string | null,
    aeiou: e.aeiou ?? null,
    createdAt: String(e.createdAt ?? e.created_at ?? ''),
    bucket: (e.bucket as JournalBucket | null | undefined) ?? null,
    note: e.note ?? null,
  }
}

export type PrototypeKind = 'conversation' | 'experience'
export type PrototypeStatus = 'planned' | 'done' | 'dropped'
export type ProtoQuestionOrigin = 'odyssey' | 'prototype' | 'manual'
export type PrototypeAnswered = 'a_lot' | 'some' | 'more_confused'
export type PrototypeDuration =
  | '1시간'
  | '반나절'
  | '하루'
  | '주말'
  | '한 달'

export const PROTOTYPE_DURATIONS: PrototypeDuration[] = [
  '1시간',
  '반나절',
  '하루',
  '주말',
  '한 달',
]

export const PROTOTYPE_STARTER_QUESTIONS = [
  '어떻게 이 일을 하게 됐어요?',
  '하루가 실제로 어떻게 흘러가요?',
  '이 일에서 제일 좋은 게 뭐예요?',
  '제일 싫은 건요?',
  '시작할 때 아무도 안 알려준 게 있어요?',
  '오래 하는 사람이랑 그만두는 사람 차이가 뭐예요?',
  '제가 또 누구랑 얘기해보면 좋을까요?',
] as const

export const PROTOTYPE_REFERRAL_QUESTION =
  '제가 또 누구랑 얘기해보면 좋을까요?'

export interface ProtoQuestionOriginRef {
  snapshot_id?: string
  plan_key?: string
  index?: number
  prototype_id?: string
}

export interface LdProtoQuestion {
  id: string
  userId: string
  body: string
  origin: ProtoQuestionOrigin
  originRef: ProtoQuestionOriginRef | null
  isOpen: boolean
  createdAt: string
}

export interface LdProtoIdea {
  id: string
  userId: string
  questionId: string
  kind: PrototypeKind
  body: string
  promoted: boolean
  createdAt: string
}

export interface PrototypePrepChecks {
  notJob: boolean
  listen: boolean
  questions: boolean
}

export interface LdPrototype {
  id: string
  userId: string
  questionId: string
  kind: PrototypeKind
  title: string
  status: PrototypeStatus
  /** conversation */
  person: string | null
  howKnown: string | null
  prepChecks: PrototypePrepChecks | null
  questions: string[]
  /** experience */
  scope: string | null
  duration: string | null
  learnGoal: string | null
  /** reflection */
  happenedOn: string | null
  learned: string | null
  answered: PrototypeAnswered | null
  engagement: number | null
  energy: number | null
  referral: string | null
  createdAt: string
  /** @deprecated v1 — kept for migration only */
  goingInQ?: string | null
  nextStep?: string | null
  linkedPlan?: string | null
}

export function emptyPrepChecks(): PrototypePrepChecks {
  return { notJob: false, listen: false, questions: false }
}

export function normalizePrototype(raw: unknown): LdPrototype | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const id = String(e.id ?? '')
  if (!id) return null
  const kind: PrototypeKind =
    e.kind === 'experience' ? 'experience' : 'conversation'
  const status: PrototypeStatus =
    e.status === 'done' || e.status === 'dropped' ? e.status : 'planned'
  const prepRaw = e.prepChecks ?? e.prep_checks
  let prepChecks: PrototypePrepChecks | null = null
  if (prepRaw && typeof prepRaw === 'object') {
    const p = prepRaw as Record<string, unknown>
    prepChecks = {
      notJob: Boolean(p.notJob ?? p.not_job),
      listen: Boolean(p.listen),
      questions: Boolean(p.questions),
    }
  }
  const qsRaw = e.questions
  const questions = Array.isArray(qsRaw)
    ? qsRaw.filter((x): x is string => typeof x === 'string')
    : []
  const answeredRaw = e.answered
  const answered: PrototypeAnswered | null =
    answeredRaw === 'a_lot' ||
    answeredRaw === 'some' ||
    answeredRaw === 'more_confused'
      ? answeredRaw
      : null
  const eng = e.engagement
  const ene = e.energy
  return {
    id,
    userId: String(e.userId ?? e.user_id ?? ''),
    questionId: String(e.questionId ?? e.question_id ?? ''),
    kind,
    title: String(e.title ?? ''),
    status,
    person: (e.person as string | null | undefined) ?? null,
    howKnown: (e.howKnown ?? e.how_known ?? null) as string | null,
    prepChecks,
    questions,
    scope: (e.scope as string | null | undefined) ?? null,
    duration: (e.duration as string | null | undefined) ?? null,
    learnGoal: (e.learnGoal ?? e.learn_goal ?? null) as string | null,
    happenedOn: (e.happenedOn ?? e.happened_on ?? null) as string | null,
    learned: (e.learned as string | null | undefined) ?? null,
    answered,
    engagement:
      typeof eng === 'number' ? Math.max(-5, Math.min(5, eng)) : null,
    energy: typeof ene === 'number' ? Math.max(-5, Math.min(5, ene)) : null,
    referral: (e.referral as string | null | undefined) ?? null,
    createdAt: String(e.createdAt ?? e.created_at ?? ''),
    goingInQ: (e.goingInQ ?? e.going_in_q ?? null) as string | null,
    nextStep: (e.nextStep ?? e.next_step ?? null) as string | null,
    linkedPlan: (e.linkedPlan ?? e.linked_plan ?? null) as string | null,
  }
}

export function normalizeProtoQuestion(raw: unknown): LdProtoQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const id = String(e.id ?? '')
  if (!id) return null
  const originRaw = e.origin
  const origin: ProtoQuestionOrigin =
    originRaw === 'odyssey' || originRaw === 'prototype' || originRaw === 'manual'
      ? originRaw
      : 'manual'
  const refRaw = e.originRef ?? e.origin_ref
  let originRef: ProtoQuestionOriginRef | null = null
  if (refRaw && typeof refRaw === 'object') {
    const r = refRaw as Record<string, unknown>
    originRef = {
      snapshot_id: r.snapshot_id ? String(r.snapshot_id) : undefined,
      plan_key: r.plan_key ? String(r.plan_key) : undefined,
      index: typeof r.index === 'number' ? r.index : undefined,
      prototype_id: r.prototype_id ? String(r.prototype_id) : undefined,
    }
  }
  return {
    id,
    userId: String(e.userId ?? e.user_id ?? ''),
    body: String(e.body ?? ''),
    origin,
    originRef,
    isOpen:
      e.isOpen === undefined && e.is_open === undefined
        ? true
        : Boolean(e.isOpen ?? e.is_open),
    createdAt: String(e.createdAt ?? e.created_at ?? ''),
  }
}

export function normalizeProtoIdea(raw: unknown): LdProtoIdea | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const id = String(e.id ?? '')
  if (!id) return null
  return {
    id,
    userId: String(e.userId ?? e.user_id ?? ''),
    questionId: String(e.questionId ?? e.question_id ?? ''),
    kind: e.kind === 'experience' ? 'experience' : 'conversation',
    body: String(e.body ?? ''),
    promoted: Boolean(e.promoted),
    createdAt: String(e.createdAt ?? e.created_at ?? new Date().toISOString()),
  }
}

export type AiReportType = 'snapshot' | 'compare' | 'pathway'

export interface AiObservation {
  text: string
  evidence: string[]
  source: string
}

export interface AiPathway {
  name: string
  why_it_fits: string[]
  friction: string[]
  smallest_test: string
  confidence: 'high' | 'medium' | 'low'
}

export interface AiReportOutput {
  report_type: AiReportType
  headline: string
  observations: AiObservation[]
  pathways?: AiPathway[]
  tension: string | null
  unknowns: string[]
  next_question?: string
  what_changed?: string[]
  what_stayed?: string[]
  implications?: string[]
  highlights?: string[]
  blind_spot?: string
}

export interface LdAiReport {
  id: string
  userId: string
  reportType: AiReportType
  inputHash: string
  inputRefs: Record<string, unknown>
  output: AiReportOutput
  model: string | null
  createdAt: string
}

// ─── Exercise snapshot data shapes ──────────────────────────────────────────

export type LongformStep = 0 | 1 | 2

export interface LongformData {
  reasons: string[]
  body: string
  questions_checked: string[]
  values: [string, string, string]
  step: LongformStep
  /** legacy */
  chips_used?: string[]
  promptsUsed?: string[]
}

export function emptyLongformData(): LongformData {
  return {
    reasons: [],
    body: '',
    questions_checked: [],
    values: ['', '', ''],
    step: 0,
  }
}

export function normalizeLongformData(raw: unknown): LongformData {
  const empty = emptyLongformData()
  if (!raw || typeof raw !== 'object') return empty
  const d = raw as Partial<LongformData>

  if (Array.isArray(d.reasons) || typeof d.step === 'number') {
    const valuesRaw = Array.isArray(d.values) ? d.values : ['', '', '']
    return {
      reasons: Array.isArray(d.reasons)
        ? d.reasons.filter((x) => typeof x === 'string')
        : [],
      body: typeof d.body === 'string' ? d.body : '',
      questions_checked: Array.isArray(d.questions_checked)
        ? d.questions_checked.filter((x) => typeof x === 'string')
        : [],
      values: [
        String(valuesRaw[0] ?? ''),
        String(valuesRaw[1] ?? ''),
        String(valuesRaw[2] ?? ''),
      ],
      step:
        typeof d.step === 'number' && d.step >= 0 && d.step <= 2
          ? (d.step as LongformStep)
          : 0,
    }
  }

  // Legacy body-only / chips_used
  return {
    ...empty,
    body: typeof d.body === 'string' ? d.body : '',
    step: typeof d.body === 'string' && d.body.trim() ? 1 : 0,
  }
}

/** @deprecated v1 link kinds — migrated away in normalizeCoherenceData */
export type CoherenceLinkKind = '맞물림' | '충돌' | '애매'

/** @deprecated v1 */
export interface CoherenceLink {
  id: string
  leftText: string
  rightText: string
  kind: CoherenceLinkKind
  action?: string
}

export type CoherenceMarkKind = 'complement' | 'clash' | 'drives'
export type CoherenceDriveDirection = 'work_to_life' | 'life_to_work'
export type CoherenceStep = 0 | 1 | 2

export interface CoherenceMark {
  id: string
  kind: CoherenceMarkKind
  work_sid: string
  life_sid: string
  work_text: string
  life_text: string
  direction: CoherenceDriveDirection | null
}

export interface CoherenceData {
  source: {
    workview_id: string
    workview_date: string
    lifeview_id: string
    lifeview_date: string
  }
  marks: CoherenceMark[]
  answers: {
    complement: string
    clash: string
    drives: string
  }
  values_snapshot: {
    work: string[]
    life: string[]
  }
  step: CoherenceStep
  /** legacy v1 fields (ignored after normalize) */
  workviewSnapshotId?: string | null
  lifeviewSnapshotId?: string | null
  links?: CoherenceLink[]
}

export function emptyCoherenceData(): CoherenceData {
  return {
    source: {
      workview_id: '',
      workview_date: '',
      lifeview_id: '',
      lifeview_date: '',
    },
    marks: [],
    answers: { complement: '', clash: '', drives: '' },
    values_snapshot: { work: [], life: [] },
    step: 0,
  }
}

export function normalizeCoherenceData(raw: unknown): CoherenceData {
  const empty = emptyCoherenceData()
  if (!raw || typeof raw !== 'object') return empty
  const d = raw as Partial<CoherenceData> & {
    workviewSnapshotId?: string | null
    lifeviewSnapshotId?: string | null
    links?: CoherenceLink[]
  }

  // v2 shape
  if (d.source || Array.isArray(d.marks) || d.answers) {
    const source = d.source ?? empty.source
    const marks = Array.isArray(d.marks)
      ? d.marks
          .filter((m) => m && typeof m === 'object')
          .map((m) => ({
            id: String(m.id || newId()),
            kind:
              m.kind === 'clash' || m.kind === 'drives' || m.kind === 'complement'
                ? m.kind
                : ('complement' as CoherenceMarkKind),
            work_sid: String(m.work_sid ?? ''),
            life_sid: String(m.life_sid ?? ''),
            work_text: String(m.work_text ?? ''),
            life_text: String(m.life_text ?? ''),
            direction:
              m.direction === 'work_to_life' || m.direction === 'life_to_work'
                ? m.direction
                : null,
          }))
      : []
    const answers = d.answers ?? empty.answers
    const vs = d.values_snapshot ?? empty.values_snapshot
    return {
      source: {
        workview_id: String(source.workview_id ?? ''),
        workview_date: String(source.workview_date ?? ''),
        lifeview_id: String(source.lifeview_id ?? ''),
        lifeview_date: String(source.lifeview_date ?? ''),
      },
      marks,
      answers: {
        complement: String(answers.complement ?? ''),
        clash: String(answers.clash ?? ''),
        drives: String(answers.drives ?? ''),
      },
      values_snapshot: {
        work: Array.isArray(vs.work)
          ? vs.work.map(String).filter(Boolean)
          : [],
        life: Array.isArray(vs.life)
          ? vs.life.map(String).filter(Boolean)
          : [],
      },
      step:
        typeof d.step === 'number' && d.step >= 0 && d.step <= 2
          ? (d.step as CoherenceStep)
          : 0,
    }
  }

  // v1 → empty-ish with source ids if present
  return {
    ...empty,
    source: {
      workview_id: String(d.workviewSnapshotId ?? ''),
      workview_date: '',
      lifeview_id: String(d.lifeviewSnapshotId ?? ''),
      lifeview_date: '',
    },
  }
}

export const COHERENCE_MARK_LABEL: Record<CoherenceMarkKind, string> = {
  complement: '보완',
  clash: '충돌',
  drives: '이끎',
}

export const COHERENCE_MARK_COLOR: Record<CoherenceMarkKind, string> = {
  complement: COMPASS.accent,
  clash: '#C08A4A',
  drives: '#5B4E73',
}

export type MindmapMapKey = 'engagement' | 'energy' | 'flow'

export const MINDMAP_MAP_KEYS: MindmapMapKey[] = [
  'engagement',
  'energy',
  'flow',
]

export const MINDMAP_MAP_LABELS: Record<MindmapMapKey, string> = {
  engagement: '몰입',
  energy: '에너지',
  flow: 'flow',
}

export type MindmapRing = 0 | 1 | 2 | 3

export interface MindmapTreeNode {
  id: string
  label: string
  ring: MindmapRing
  parent: string | null
  x: number
  y: number
}

export interface MindmapEdge {
  source: string
  target: string
}

export interface MindmapRole {
  description: string
  name: string
  sketch_url: string
  sketch_kind: 'draw' | 'photo' | ''
}

export interface MindmapMapState {
  key: MindmapMapKey
  nodes: MindmapTreeNode[]
  edges: MindmapEdge[]
  seconds_used: number
  picked: string[]
  role: MindmapRole
  skipped?: boolean
}

export interface MindmapSourcePick {
  activity: string
  from_journal: boolean
  entry_ref?: string
}

/** @deprecated v1 — still emitted for Odyssey/Choosing consumers */
export interface MindmapRoleIdea {
  id: string
  words: string[]
  title: string
  daySketch: string
}

export type MindmapStep =
  | 'gate'
  | 'sources'
  | 'draw'
  | 'pick'
  | 'role'
  | 'summary'

export interface MindmapData {
  sources: {
    engagement: MindmapSourcePick | null
    energy: MindmapSourcePick | null
    flow: MindmapSourcePick | null
  }
  maps: MindmapMapState[]
  different_enough: boolean | null
  step: MindmapStep
  /** which map is active during draw/pick/role */
  map_index: 0 | 1 | 2
  /** synced for Odyssey / Choosing */
  roleIdeas: MindmapRoleIdea[]
}

export function emptyMindmapRole(): MindmapRole {
  return { description: '', name: '', sketch_url: '', sketch_kind: '' }
}

export function emptyMindmapMap(key: MindmapMapKey): MindmapMapState {
  return {
    key,
    nodes: [],
    edges: [],
    seconds_used: 0,
    picked: [],
    role: emptyMindmapRole(),
  }
}

export function emptyMindmapData(): MindmapData {
  return {
    sources: { engagement: null, energy: null, flow: null },
    maps: MINDMAP_MAP_KEYS.map(emptyMindmapMap),
    different_enough: null,
    step: 'gate',
    map_index: 0,
    roleIdeas: [],
  }
}

export function mindmapRoleIdeasFromData(data: MindmapData): MindmapRoleIdea[] {
  return data.maps
    .filter((m) => !m.skipped && m.role.name.trim())
    .map((m) => ({
      id: `role-${m.key}`,
      words: m.picked
        .map((id) => m.nodes.find((n) => n.id === id)?.label ?? '')
        .filter(Boolean),
      title: m.role.name.trim(),
      daySketch: m.role.description.trim(),
    }))
}

export function normalizeMindmapData(raw: unknown): MindmapData {
  const empty = emptyMindmapData()
  if (!raw || typeof raw !== 'object') return empty
  const d = raw as Partial<MindmapData> & {
    nodes?: unknown[]
    roleIdeas?: MindmapRoleIdea[]
  }

  // v2
  if (d.sources || d.maps || d.step) {
    const mapsRaw = Array.isArray(d.maps) ? d.maps : []
    const maps = MINDMAP_MAP_KEYS.map((key, i) => {
      const m = mapsRaw.find((x) => x && (x as MindmapMapState).key === key) as
        | MindmapMapState
        | undefined
      const fallback = mapsRaw[i] as MindmapMapState | undefined
      const src = m ?? fallback
      if (!src || typeof src !== 'object') return emptyMindmapMap(key)
      return {
        key,
        nodes: Array.isArray(src.nodes)
          ? src.nodes.map((n) => ({
              id: String(n.id),
              label: String(n.label ?? ''),
              ring: ([0, 1, 2, 3].includes(Number(n.ring))
                ? Number(n.ring)
                : 0) as MindmapRing,
              parent: n.parent ?? null,
              x: Number(n.x ?? 0),
              y: Number(n.y ?? 0),
            }))
          : [],
        edges: Array.isArray(src.edges)
          ? src.edges.map((e) => ({
              source: String(e.source),
              target: String(e.target),
            }))
          : [],
        seconds_used: Number(src.seconds_used ?? 0),
        picked: Array.isArray(src.picked) ? src.picked.map(String) : [],
        role: {
          description: String(src.role?.description ?? ''),
          name: String(src.role?.name ?? ''),
          sketch_url: String(src.role?.sketch_url ?? ''),
          sketch_kind:
            src.role?.sketch_kind === 'draw' || src.role?.sketch_kind === 'photo'
              ? src.role.sketch_kind
              : ('' as const),
        },
        skipped: Boolean(src.skipped),
      }
    })
    const sources = d.sources ?? empty.sources
    const normPick = (p: MindmapSourcePick | null | undefined) =>
      p && p.activity
        ? {
            activity: String(p.activity),
            from_journal: Boolean(p.from_journal),
            entry_ref: p.entry_ref ? String(p.entry_ref) : undefined,
          }
        : null
    const step = (
      [
        'gate',
        'sources',
        'draw',
        'pick',
        'role',
        'summary',
      ] as MindmapStep[]
    ).includes(d.step as MindmapStep)
      ? (d.step as MindmapStep)
      : 'sources'
    const base: MindmapData = {
      sources: {
        engagement: normPick(sources.engagement),
        energy: normPick(sources.energy),
        flow: normPick(sources.flow),
      },
      maps,
      different_enough:
        typeof d.different_enough === 'boolean' ? d.different_enough : null,
      step,
      map_index: ([0, 1, 2].includes(Number(d.map_index))
        ? Number(d.map_index)
        : 0) as 0 | 1 | 2,
      roleIdeas: Array.isArray(d.roleIdeas) ? d.roleIdeas : [],
    }
    if (!base.roleIdeas.length) {
      base.roleIdeas = mindmapRoleIdeasFromData(base)
    }
    return base
  }

  // v1 → empty shell with any legacy roleIdeas preserved
  return {
    ...empty,
    step: 'sources',
    roleIdeas: Array.isArray(d.roleIdeas) ? d.roleIdeas : [],
  }
}

/** @deprecated v1 node shape */
export interface MindmapNode {
  id: string
  parentId: string | null
  label: string
  x: number
  y: number
  ring: 0 | 1 | 2
}

export type OdysseyPlanKey = 'current' | 'gone' | 'no_object'
export type OdysseyYearKey = '1' | '2' | '3' | '4' | '5'
export type OdysseyStep =
  | 'prep'
  | 'plan0'
  | 'plan1'
  | 'plan2'
  | 'side'
  | 'present'

export const ODYSSEY_PLAN_KEYS: OdysseyPlanKey[] = [
  'current',
  'gone',
  'no_object',
]
export const ODYSSEY_YEAR_KEYS: OdysseyYearKey[] = ['1', '2', '3', '4', '5']

export const ODYSSEY_PLAN_META: Record<
  OdysseyPlanKey,
  { label: string; blurb: string }
> = {
  current: {
    label: '지금 가는 길',
    blurb:
      '지금 삶이 그대로 이어지면. 아니면 계속 마음에 품고만 있던 그 아이디어.',
  },
  gone: {
    label: '그게 사라지면',
    blurb:
      '①이 갑자기 불가능해지면. 회사가 없어지거나, 그 길이 막히거나. 그럼 뭘 할 거야?',
  },
  no_object: {
    label: '돈도 남 눈도 상관없다면',
    blurb: '돈이 문제가 안 되고, 아무도 뭐라고 안 하면.',
  },
}

export type OdysseyGaugeKey =
  | 'resources'
  | 'liking'
  | 'confidence'
  | 'coherence'

export const ODYSSEY_GAUGE_META: {
  key: OdysseyGaugeKey
  label: string
  def: string
  note?: string
}[] = [
  {
    key: 'resources',
    label: '자원',
    def: '시간·돈·기술·인맥이 지금 있어?',
  },
  { key: 'liking', label: '끌림', def: '얼마나 하고 싶어?' },
  {
    key: 'confidence',
    label: '자신감',
    def: '해낼 수 있을 것 같아?',
    note: '자원 없어도 자신 있을 수 있어',
  },
  {
    key: 'coherence',
    label: '일관성',
    def: '내 일 관점·삶 관점이랑 맞아?',
  },
]

export interface OdysseyTimeline {
  work: Record<OdysseyYearKey, string[]>
  life: Record<OdysseyYearKey, string[]>
}

export interface OdysseyPlan {
  key: OdysseyPlanKey
  label: string
  title: string
  timeline: OdysseyTimeline
  questions: [string, string, string]
  gauges: Record<OdysseyGaugeKey, number | null>
  sketch_url: string
  sketch_kind: 'draw' | 'photo' | ''
  from_role: string
}

export interface OdysseyPresented {
  to: string
  most_alive: 'plan1' | 'plan2' | 'plan3' | 'unsure' | ''
  their_questions: string
  my_notice: string
  skipped: boolean
}

export interface OdysseyData {
  plans: [OdysseyPlan, OdysseyPlan, OdysseyPlan]
  different_enough: boolean | null
  presented: OdysseyPresented
  compass_ref: string
  step: OdysseyStep
}

function emptyTimeline(): OdysseyTimeline {
  const mk = () =>
    Object.fromEntries(ODYSSEY_YEAR_KEYS.map((y) => [y, [] as string[]])) as Record<
      OdysseyYearKey,
      string[]
    >
  return { work: mk(), life: mk() }
}

export function emptyOdysseyPlan(key: OdysseyPlanKey): OdysseyPlan {
  return {
    key,
    label: ODYSSEY_PLAN_META[key].label,
    title: '',
    timeline: emptyTimeline(),
    questions: ['', '', ''],
    gauges: {
      resources: null,
      liking: null,
      confidence: null,
      coherence: null,
    },
    sketch_url: '',
    sketch_kind: '',
    from_role: '',
  }
}

export function emptyOdysseyData(): OdysseyData {
  return {
    plans: [
      emptyOdysseyPlan('current'),
      emptyOdysseyPlan('gone'),
      emptyOdysseyPlan('no_object'),
    ],
    different_enough: null,
    presented: {
      to: '',
      most_alive: '',
      their_questions: '',
      my_notice: '',
      skipped: false,
    },
    compass_ref: '',
    step: 'prep',
  }
}

function migrateGauge(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  // v1 was 0–5
  if (n >= 0 && n <= 5) return Math.round(n * 20)
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function normalizeOdysseyData(raw: unknown): OdysseyData {
  const empty = emptyOdysseyData()
  if (!raw || typeof raw !== 'object') return empty
  const d = raw as Partial<OdysseyData> & {
    plans?: unknown[]
  }

  // v2 shape
  if (
    d.step ||
    d.presented ||
    (Array.isArray(d.plans) &&
      d.plans[0] &&
      typeof d.plans[0] === 'object' &&
      'timeline' in (d.plans[0] as object))
  ) {
    const plans = ODYSSEY_PLAN_KEYS.map((key, i) => {
      const src = (Array.isArray(d.plans) ? d.plans[i] : null) as
        | Partial<OdysseyPlan>
        | undefined
      const base = emptyOdysseyPlan(key)
      if (!src) return base
      const tl = src.timeline
      const work = { ...base.timeline.work }
      const life = { ...base.timeline.life }
      if (tl && typeof tl === 'object') {
        for (const y of ODYSSEY_YEAR_KEYS) {
          work[y] = Array.isArray(tl.work?.[y])
            ? tl.work![y].map(String).filter(Boolean)
            : []
          life[y] = Array.isArray(tl.life?.[y])
            ? tl.life![y].map(String).filter(Boolean)
            : []
        }
      }
      const g = src.gauges ?? base.gauges
      return {
        ...base,
        title: String(src.title ?? ''),
        timeline: { work, life },
        questions: [
          String(src.questions?.[0] ?? ''),
          String(src.questions?.[1] ?? ''),
          String(src.questions?.[2] ?? ''),
        ],
        gauges: {
          resources: migrateGauge(g.resources),
          liking: migrateGauge(
            (g as { liking?: unknown; pull?: unknown }).liking ??
              (g as { pull?: unknown }).pull,
          ),
          confidence: migrateGauge(g.confidence),
          coherence: migrateGauge(g.coherence),
        },
        sketch_url: String(src.sketch_url ?? ''),
        sketch_kind:
          src.sketch_kind === 'draw' || src.sketch_kind === 'photo'
            ? src.sketch_kind
            : ('' as const),
        from_role: String(src.from_role ?? ''),
      }
    }) as OdysseyData['plans']

    const presented = d.presented ?? empty.presented
    const step = (
      ['prep', 'plan0', 'plan1', 'plan2', 'side', 'present'] as OdysseyStep[]
    ).includes(d.step as OdysseyStep)
      ? (d.step as OdysseyStep)
      : 'prep'

    return {
      plans,
      different_enough:
        typeof d.different_enough === 'boolean' ? d.different_enough : null,
      presented: {
        to: String(presented.to ?? ''),
        most_alive: (
          ['plan1', 'plan2', 'plan3', 'unsure', ''] as const
        ).includes(presented.most_alive as OdysseyPresented['most_alive'])
          ? (presented.most_alive as OdysseyPresented['most_alive'])
          : '',
        their_questions: String(presented.their_questions ?? ''),
        my_notice: String(presented.my_notice ?? ''),
        skipped: Boolean(presented.skipped),
      },
      compass_ref: String(d.compass_ref ?? ''),
      step,
    }
  }

  // v1 → migrate milestones into work timeline
  if (Array.isArray(d.plans) && d.plans.length >= 3) {
    const plans = ODYSSEY_PLAN_KEYS.map((key, i) => {
      const src = d.plans![i] as {
        title?: string
        questions?: string[]
        gauges?: Record<string, number>
        milestones?: { yearIndex: number; label: string }[]
      }
      const base = emptyOdysseyPlan(key)
      const work = { ...base.timeline.work }
      for (const m of src.milestones ?? []) {
        const y = String(
          Math.min(5, Math.max(1, (m.yearIndex ?? 0) + 1)),
        ) as OdysseyYearKey
        if (m.label?.trim()) work[y] = [...work[y], m.label.trim()]
      }
      return {
        ...base,
        title: String(src.title ?? ''),
        timeline: { work, life: base.timeline.life },
        questions: [
          String(src.questions?.[0] ?? ''),
          String(src.questions?.[1] ?? ''),
          String(src.questions?.[2] ?? ''),
        ] as [string, string, string],
        gauges: {
          resources: migrateGauge(src.gauges?.resources),
          liking: migrateGauge(src.gauges?.pull ?? src.gauges?.liking),
          confidence: migrateGauge(src.gauges?.confidence),
          coherence: migrateGauge(src.gauges?.coherence),
        },
      }
    }) as OdysseyData['plans']
    return { ...empty, plans, step: 'prep' }
  }

  return empty
}

export function odysseyChipCount(plan: OdysseyPlan): number {
  let n = 0
  for (const y of ODYSSEY_YEAR_KEYS) {
    n += plan.timeline.work[y].length + plan.timeline.life[y].length
  }
  return n
}

export function odysseyLifeChipCount(plan: OdysseyPlan): number {
  let n = 0
  for (const y of ODYSSEY_YEAR_KEYS) n += plan.timeline.life[y].length
  return n
}

export function countEojeol(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

export function odysseyYearLabel(yearIndex: number, baseYear = new Date().getFullYear()) {
  return `${baseYear + yearIndex - 1} · ${yearIndex}년차`
}

/** @deprecated v1 */
export interface OdysseyMilestone {
  id: string
  yearIndex: number
  label: string
}

/** @deprecated */
export const ODYSSEY_DEFAULT_BADGES = [
  'A 지금 길의 연장',
  'B 그 길이 사라진다면',
  'C 돈도 평판도 상관없다면',
] as const

export interface PrototypeGoalData {
  quarterlyGoal: number
}

export function emptyPrototypeMeta(): PrototypeGoalData {
  return { quarterlyGoal: 3 }
}

export interface ChoosingOption {
  id: string
  label: string
  source?: string
  head?: string
  body?: string
}

export interface ChoosingData {
  step: 0 | 1 | 2 | 3
  options: ChoosingOption[]
  narrowed: string[]
  chosenId: string | null
}

export function emptyChoosingData(): ChoosingData {
  return { step: 0, options: [], narrowed: [], chosenId: null }
}

export type FailureKind = '실수' | '약점' | '성장통'

export interface FailureRow {
  id: string
  event: string
  kind: FailureKind | null
  leftover: string
}

export interface FailureData {
  rows: FailureRow[]
}

export function emptyFailureData(): FailureData {
  return { rows: [] }
}

export interface GravityItem {
  id: string
  problem: string
  changeable: boolean
  note: string
}

export interface GravityData {
  items: GravityItem[]
}

export function emptyGravityData(): GravityData {
  return { items: [] }
}

export type TeamRole = '멘토' | '응원' | '같이 하는 사람' | '현실 검증'

export interface TeamPerson {
  id: string
  name: string
  relation: string
  roles: TeamRole[]
  lastContact: string | null
  note: string
  linkedPrototypeId: string | null
}

export interface TeamData {
  people: TeamPerson[]
}

export function emptyTeamData(): TeamData {
  return { people: [] }
}

export function normalizeTeamData(raw: unknown): TeamData {
  if (!raw || typeof raw !== 'object') return emptyTeamData()
  const d = raw as Partial<TeamData>
  const people = Array.isArray(d.people) ? d.people : []
  return {
    people: people
      .filter((p): p is TeamPerson => Boolean(p && typeof p === 'object'))
      .map((p) => ({
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        relation: String(p.relation ?? ''),
        roles: Array.isArray(p.roles)
          ? (p.roles.filter((r) => typeof r === 'string') as TeamRole[])
          : [],
        lastContact: (p.lastContact as string | null) ?? null,
        note: String(p.note ?? ''),
        linkedPrototypeId: (p.linkedPrototypeId as string | null) ?? null,
      })),
  }
}

export function emptyDataForExercise(key: ExerciseKey): Record<string, unknown> {
  switch (key) {
    case 'dashboard':
      return emptyDashboardData() as unknown as Record<string, unknown>
    case 'workview':
    case 'lifeview':
      return emptyLongformData() as unknown as Record<string, unknown>
    case 'coherence':
      return emptyCoherenceData() as unknown as Record<string, unknown>
    case 'mindmap':
      return emptyMindmapData() as unknown as Record<string, unknown>
    case 'odyssey':
      return emptyOdysseyData() as unknown as Record<string, unknown>
    case 'prototype':
      return emptyPrototypeMeta() as unknown as Record<string, unknown>
    case 'choosing':
      return emptyChoosingData() as unknown as Record<string, unknown>
    case 'failure':
      return emptyFailureData() as unknown as Record<string, unknown>
    case 'gravity':
      return emptyGravityData() as unknown as Record<string, unknown>
    case 'team':
      return emptyTeamData() as unknown as Record<string, unknown>
    case 'goodtime':
      return emptyGoodtimeRunData() as unknown as Record<string, unknown>
    default:
      return {}
  }
}

export interface ExerciseMeta {
  key: ExerciseKey
  name: string
  description: string
  cadenceDays: number | null
  phase: 1 | 2 | 3
}

/** Phase 1–3 exercises; Ask Myself is separate from this list. */
export const EXERCISE_META: ExerciseMeta[] = [
  {
    key: 'dashboard',
    name: '라이프 대시보드',
    description: '건강 · 일 · 놀이 · 사랑을 순서대로 읽고, 바꾸고 싶은 것을 적기',
    cadenceDays: 30,
    phase: 1,
  },
  {
    key: 'workview',
    name: '일 관점',
    description: '일이 나에게 무엇인지 길게 쓰기',
    cadenceDays: 180,
    phase: 2,
  },
  {
    key: 'lifeview',
    name: '삶 관점',
    description: '삶을 의미 있게 만드는 것 쓰기',
    cadenceDays: 180,
    phase: 2,
  },
  {
    key: 'coherence',
    name: '두 관점 맞춰보기',
    description: '보완 · 충돌 · 이끎 세 질문으로 나침반 만들기',
    cadenceDays: 365,
    phase: 2,
  },
  {
    key: 'goodtime',
    name: '굿타임 저널',
    description: '3주 동안 몰입과 에너지를 기록하고 패턴을 읽기',
    cadenceDays: 180,
    phase: 2,
  },
  {
    key: 'mindmap',
    name: '마인드맵',
    description: '굿타임에서 고른 셋으로 맵을 그리고 역할 세 개 만들기',
    cadenceDays: 90,
    phase: 3,
  },
  {
    key: 'odyssey',
    name: '오디세이 플랜',
    description: '5년짜리 길 세 갈래를 하나씩 그리고 말해보기',
    cadenceDays: 180,
    phase: 2,
  },
  {
    key: 'prototype',
    name: '프로토타입',
    description: '작게 물어보고 작게 해보기',
    cadenceDays: null,
    phase: 3,
  },
  {
    key: 'choosing',
    name: '고르기',
    description: '옵션을 모으고 좁히고 하나 고르기',
    cadenceDays: null,
    phase: 3,
  },
  {
    key: 'failure',
    name: '실패 정리',
    description: '있었던 일을 실수·약점·성장통으로 나누기',
    cadenceDays: 90,
    phase: 3,
  },
  {
    key: 'gravity',
    name: '중력 문제',
    description: '바꿀 수 있는 것과 안고 갈 것을 가르기',
    cadenceDays: 90,
    phase: 3,
  },
  {
    key: 'team',
    name: '나의 팀',
    description: '멘토·응원·동료를 한곳에 모아 두기',
    cadenceDays: 180,
    phase: 3,
  },
]

export const ASK_COLOR_PALETTE = [
  '#3E6B5E',
  '#5E8C7B',
  '#C08A4A',
  '#B4635A',
  '#6B7C93',
  '#8A6B8A',
  '#4A7C8A',
] as const

export const CADENCE_PRESETS = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
] as const

export type CompassRoute =
  | { page: 'overview' }
  | { page: 'exercise'; key: ExerciseKey; snapshotId?: string }
  | { page: 'ask' }
  | { page: 'askDetail'; questionId: string; revealPast?: boolean }
  | { page: 'compare' }
  | { page: 'ai' }

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a)
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return todayKey(d)
}

export function formatYm(dateKey: string): string {
  const [y, m] = dateKey.split('-')
  return `${y}.${m}`
}

export function newId(): string {
  return crypto.randomUUID()
}
