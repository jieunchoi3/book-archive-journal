export type SnapCourse = '쇼트' | '싱글' | '더블' | '커스텀' | '미분류'

export type SnapPaymentMethod = 'cash_gbp' | 'krw_transfer' | 'unpaid'

export type SnapStatus =
  | '문의'
  | '확정'
  | '촬영완료'
  | '사진전달'
  | '입금완료'

export type SnapSource = 'manual' | 'notion_import'

export interface SnapBooking {
  id: string
  date: string
  customerName: string
  spots: string[]
  minutes: number | null
  course: SnapCourse | string
  headcount: number
  listPriceGbp: number
  paymentMethod: SnapPaymentMethod | null
  amountGbp: number | null
  amountKrw: number | null
  fxRate: number | null
  status: SnapStatus | string
  gender: string | null
  ageBand: string | null
  purpose: string | null
  stars: number | null
  photosUrl: string | null
  note: string | null
  source: SnapSource
  createdAt: string
}

export type SnapPeriod = 'month' | 'year' | 'all'

export const SNAP_SPOT_OPTIONS = [
  '빅벤·런던아이',
  '타워브릿지',
  '켄싱턴',
  '노팅힐',
  '하이드파크',
  '트라팔가 스퀘어',
  'V&A 뮤지엄',
  '리젠트파크',
  '풀럼 팰리스 가든',
] as const

export const SNAP_COURSE_OPTIONS: SnapCourse[] = ['쇼트', '싱글', '더블', '커스텀']

export const SNAP_STATUS_OPTIONS: SnapStatus[] = [
  '문의',
  '확정',
  '촬영완료',
  '사진전달',
  '입금완료',
]

export const SNAP_PURPOSE_OPTIONS = [
  '홀로 여행',
  '커플 여행',
  '가족 여행',
  '신혼 여행',
  '어학 연수',
  '기타',
] as const

export interface CourseDefaults {
  minutes: number | null
  defaultSpots: number
  listPriceGbp: number | null
  cashPriceGbp: number | null
}

export const COURSE_DEFAULTS: Record<SnapCourse, CourseDefaults> = {
  쇼트: { minutes: 30, defaultSpots: 1, listPriceGbp: 45, cashPriceGbp: 45 },
  싱글: { minutes: 50, defaultSpots: 1, listPriceGbp: 55, cashPriceGbp: 50 },
  더블: { minutes: 100, defaultSpots: 2, listPriceGbp: 85, cashPriceGbp: 80 },
  커스텀: { minutes: null, defaultSpots: 3, listPriceGbp: null, cashPriceGbp: null },
  미분류: { minutes: null, defaultSpots: 1, listPriceGbp: null, cashPriceGbp: null },
}

export function formatGbp(amount: number): string {
  return `£${amount.toFixed(2)}`
}

export function formatKrw(amount: number): string {
  return `₩${Math.round(amount).toLocaleString('en-GB')}`
}

export function paymentMethodLabel(method: SnapPaymentMethod | null): string {
  if (method === 'cash_gbp') return '현금 £'
  if (method === 'krw_transfer') return '한국 계좌 ₩'
  if (method === 'unpaid') return '아직 미입금'
  return '기록 안 함'
}
