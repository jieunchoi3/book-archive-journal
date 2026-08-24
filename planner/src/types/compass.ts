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

export interface DashboardData {
  gauges: Record<DashboardGaugeKey, number>
  reasons: Record<DashboardGaugeKey, string>
  friction: string
}

export const DASHBOARD_GAUGES: {
  key: DashboardGaugeKey
  label: string
  color: string
}[] = [
  { key: 'health', label: '건강', color: '#5E8C7B' },
  { key: 'work', label: '일', color: '#3E6B5E' },
  { key: 'play', label: '놀이', color: '#C08A4A' },
  { key: 'love', label: '관계', color: '#B4635A' },
]

export function emptyDashboardData(): DashboardData {
  return {
    gauges: { health: 50, work: 50, play: 50, love: 50 },
    reasons: { health: '', work: '', play: '', love: '' },
    friction: '',
  }
}

export function isDashboardData(data: unknown): data is DashboardData {
  if (!data || typeof data !== 'object') return false
  const d = data as DashboardData
  return Boolean(d.gauges && d.reasons && typeof d.friction === 'string')
}

// ─── Journal / Prototype / AI ───────────────────────────────────────────────

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

export interface LdJournalEntry {
  id: string
  userId: string
  entryDate: string
  activity: string
  bucket: JournalBucket | null
  engagement: number
  energy: number
  isFlow: boolean
  note: string | null
  aeiou: AeiouData | null
  createdAt: string
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

export interface LongformData {
  body: string
  /** @deprecated use chips_used */
  promptsUsed?: string[]
  chips_used: string[]
}

export function emptyLongformData(): LongformData {
  return { body: '', chips_used: [] }
}

export function normalizeLongformData(raw: unknown): LongformData {
  const d = (raw ?? {}) as Partial<LongformData>
  const chips = d.chips_used ?? d.promptsUsed ?? []
  return {
    body: typeof d.body === 'string' ? d.body : '',
    chips_used: [...chips],
  }
}

export type CoherenceLinkKind = '맞물림' | '충돌' | '애매'

export interface CoherenceLink {
  id: string
  leftText: string
  rightText: string
  kind: CoherenceLinkKind
  action?: string
}

export interface CoherenceData {
  workviewSnapshotId: string | null
  lifeviewSnapshotId: string | null
  links: CoherenceLink[]
}

export function emptyCoherenceData(): CoherenceData {
  return { workviewSnapshotId: null, lifeviewSnapshotId: null, links: [] }
}

export interface MindmapNode {
  id: string
  parentId: string | null
  label: string
  x: number
  y: number
  ring: 0 | 1 | 2
}

export interface MindmapRoleIdea {
  id: string
  words: string[]
  title: string
  daySketch: string
}

export interface MindmapData {
  nodes: MindmapNode[]
  roleIdeas: MindmapRoleIdea[]
}

export function emptyMindmapData(): MindmapData {
  return { nodes: [], roleIdeas: [] }
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
      return {}
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
    description: '건강 · 일 · 놀이 · 관계의 충전량을 눈으로 보기',
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
    description: '일과 삶의 관점을 연결해 보기',
    cadenceDays: 180,
    phase: 2,
  },
  {
    key: 'goodtime',
    name: '굿타임 저널',
    description: '몰입과 에너지를 매일 짧게 기록',
    cadenceDays: null,
    phase: 2,
  },
  {
    key: 'mindmap',
    name: '마인드맵',
    description: '관심사를 가지로 펼치고 역할 아이디어 만들기',
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
