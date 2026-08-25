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

export interface LdPrototype {
  id: string
  userId: string
  kind: PrototypeKind
  title: string
  person: string | null
  happenedOn: string | null
  goingInQ: string | null
  learned: string | null
  nextStep: string | null
  linkedPlan: string | null
  status: PrototypeStatus
  createdAt: string
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

export interface OdysseyMilestone {
  id: string
  yearIndex: number
  label: string
}

export interface OdysseyPlan {
  id: string
  badge: string
  title: string
  milestones: OdysseyMilestone[]
  questions: [string, string, string]
  gauges: { resources: number; pull: number; confidence: number; coherence: number }
}

export interface OdysseyData {
  plans: [OdysseyPlan, OdysseyPlan, OdysseyPlan]
}

export const ODYSSEY_DEFAULT_BADGES = [
  'A 지금 길의 연장',
  'B 그 길이 사라진다면',
  'C 돈도 평판도 상관없다면',
] as const

export function emptyOdysseyData(): OdysseyData {
  const mk = (i: number): OdysseyPlan => ({
    id: ['A', 'B', 'C'][i],
    badge: ODYSSEY_DEFAULT_BADGES[i],
    title: '',
    milestones: [],
    questions: ['', '', ''],
    gauges: { resources: 3, pull: 3, confidence: 3, coherence: 3 },
  })
  return { plans: [mk(0), mk(1), mk(2)] }
}

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
    description: '5년짜리 길 세 갈래를 나란히 그리기',
    cadenceDays: 180,
    phase: 2,
  },
  {
    key: 'prototype',
    name: '프로토타입 로그',
    description: '대화와 작은 실험 기록',
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
