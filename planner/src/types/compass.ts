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

export interface ExerciseMeta {
  key: ExerciseKey
  name: string
  description: string
  cadenceDays: number | null
  phase: 1 | 2 | 3
}

/** Phase 1 ships dashboard + ask; others listed for overview cards later. */
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
