import type { SnapBooking } from '../types/snap'

type SeedRow = {
  date: string
  customerName: string
  spots: string
  minutes: number | null
  course: string
  headcount: number
  amountGbp: number
  gender: string | null
  ageBand: string | null
  purpose: string | null
  stars: number | null
}

const RAW: SeedRow[] = [
  { date: '2025-07-18', customerName: '박윤아', spots: '리젠트파크', minutes: 60, course: '싱글', headcount: 1, amountGbp: 30, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-07-20', customerName: '박윤아', spots: '빅벤·런던아이', minutes: 60, course: '싱글', headcount: 1, amountGbp: 30, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-08-01', customerName: '김진해', spots: '빅벤·런던아이', minutes: 60, course: '싱글', headcount: 1, amountGbp: 30, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-08-09', customerName: '김유빈', spots: '빅벤·런던아이|타워브릿지', minutes: 90, course: '더블', headcount: 1, amountGbp: 40, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-08-14', customerName: '김라윤', spots: '빅벤·런던아이|타워브릿지', minutes: 120, course: '더블', headcount: 1, amountGbp: 50, gender: '여', ageBand: '20대 후반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-08-15', customerName: '박지혁', spots: '빅벤·런던아이|타워브릿지', minutes: 120, course: '더블', headcount: 1, amountGbp: 50, gender: '남', ageBand: '30대 초반', purpose: '홀로 여행', stars: 3 },
  { date: '2025-08-22', customerName: '양다빈', spots: '빅벤·런던아이', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 23, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-08-23', customerName: '양다빈', spots: '타워브릿지', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 23, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: 4 },
  { date: '2025-08-25', customerName: '송채올', spots: '빅벤·런던아이', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 23, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: null },
  { date: '2025-08-25', customerName: '송채율', spots: '켄싱턴|노팅힐', minutes: 120, course: '더블', headcount: 1, amountGbp: 50, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-08-28', customerName: '피정주', spots: '타워브릿지', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 25, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: null },
  { date: '2025-08-30', customerName: '김채림', spots: '빅벤·런던아이|타워브릿지', minutes: 100, course: '더블', headcount: 1, amountGbp: 75, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-09-12', customerName: '장예림', spots: '빅벤·런던아이', minutes: 50, course: '싱글', headcount: 1, amountGbp: 55, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: null },
  { date: '2025-09-15', customerName: '해은', spots: '빅벤·런던아이', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 23, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-09-26', customerName: '이선민님과 규호', spots: '빅벤·런던아이|타워브릿지', minutes: 100, course: '더블', headcount: 2, amountGbp: 78, gender: null, ageBand: '30대 초반', purpose: '신혼 여행', stars: 5 },
  { date: '2025-09-29', customerName: '노재영', spots: '켄싱턴|노팅힐', minutes: 90, course: '더블', headcount: 1, amountGbp: 40, gender: null, ageBand: null, purpose: null, stars: null },
  { date: '2025-10-05', customerName: '정소윤', spots: '타워브릿지', minutes: 50, course: '싱글', headcount: 4, amountGbp: 100, gender: null, ageBand: '20대 후반 /  60대', purpose: '가족 여행', stars: null },
  { date: '2025-10-06', customerName: '예솔', spots: '타워브릿지', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 40, gender: '여', ageBand: '20대 초중반', purpose: '어학 연수', stars: 3 },
  { date: '2025-10-10', customerName: '이슬기', spots: '하이드파크|노팅힐', minutes: 100, course: '더블', headcount: 1, amountGbp: 85, gender: '여', ageBand: '20대 후반', purpose: '홀로 여행', stars: 4 },
  { date: '2025-10-16', customerName: '예솔', spots: 'V&A 뮤지엄', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 45, gender: '여', ageBand: '20대 초중반', purpose: '어학 연수', stars: null },
  { date: '2025-10-27', customerName: '이지영', spots: '켄싱턴|노팅힐', minutes: null, course: '미분류', headcount: 1, amountGbp: 85, gender: null, ageBand: null, purpose: null, stars: null },
  { date: '2025-11-20', customerName: '김민주', spots: '빅벤·런던아이|타워브릿지', minutes: 100, course: '더블', headcount: 1, amountGbp: 85, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2025-11-21', customerName: '김지연 & 하태수', spots: '빅벤·런던아이', minutes: 50, course: '싱글', headcount: 2, amountGbp: 50, gender: '남 /  여', ageBand: '20대 초중반', purpose: '커플 여행', stars: 4 },
  { date: '2025-11-26', customerName: '예솔', spots: '풀럼 팰리스 가든', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 40, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: null },
  { date: '2025-12-07', customerName: '손예빈', spots: 'V&A 뮤지엄', minutes: 50, course: '싱글', headcount: 1, amountGbp: 55, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: null },
  { date: '2026-01-30', customerName: '나윤', spots: '빅벤·런던아이', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 40, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 4 },
  { date: '2026-03-02', customerName: '혜원', spots: '켄싱턴|노팅힐', minutes: 100, course: '더블', headcount: 1, amountGbp: 75, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 4 },
  { date: '2026-05-10', customerName: '김도현', spots: '빅벤·런던아이|트라팔가 스퀘어', minutes: 50, course: '싱글', headcount: 1, amountGbp: 50, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2026-05-12', customerName: '한가영', spots: '빅벤·런던아이', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 45, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: 5 },
  { date: '2026-05-18', customerName: '조수연', spots: '노팅힐', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 45, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: null },
  { date: '2026-05-22', customerName: '김지연', spots: '빅벤·런던아이', minutes: 50, course: '싱글', headcount: 1, amountGbp: 55, gender: '여', ageBand: '20대 후반', purpose: '홀로 여행', stars: null },
  { date: '2026-05-24', customerName: '민정', spots: '켄싱턴|노팅힐', minutes: 100, course: '더블', headcount: 1, amountGbp: 80, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: null },
  { date: '2026-05-28', customerName: '민정', spots: '빅벤·런던아이|트라팔가 스퀘어', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 45, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: null },
  { date: '2026-06-01', customerName: '윤혜령', spots: '빅벤·런던아이', minutes: null, course: '미분류', headcount: 1, amountGbp: 55, gender: '여', ageBand: '30대 초반', purpose: '홀로 여행', stars: 5 },
  { date: '2026-07-29', customerName: '효원', spots: '빅벤·런던아이', minutes: 50, course: '싱글', headcount: 1, amountGbp: 50, gender: '여', ageBand: '20대 초중반', purpose: '홀로 여행', stars: null },
  { date: '2026-08-15', customerName: '주세연', spots: '빅벤·런던아이|타워브릿지', minutes: 90, course: '더블', headcount: 1, amountGbp: 80, gender: null, ageBand: null, purpose: '홀로 여행', stars: null },
  { date: '2026-08-23', customerName: '성해원', spots: '빅벤·런던아이', minutes: 50, course: '싱글', headcount: 1, amountGbp: 55, gender: '여', ageBand: null, purpose: '홀로 여행', stars: null },
  { date: '2026-08-26', customerName: '윤소정', spots: '켄싱턴|노팅힐', minutes: 50, course: '싱글', headcount: 1, amountGbp: 50, gender: '여', ageBand: '20대 후반', purpose: '홀로 여행', stars: null },
  { date: '2026-08-26', customerName: '안지애', spots: '타워브릿지', minutes: 30, course: '쇼트', headcount: 1, amountGbp: 40, gender: '여', ageBand: '30대 초반', purpose: null, stars: null },
]

function splitSpots(raw: string): string[] {
  return raw.split('|').map((s) => s.trim()).filter(Boolean)
}

/** UUID v5-style id from SHA-256 so Notion seed rows upsert idempotently per user. */
export async function snapSeedId(
  userId: string,
  date: string,
  customerName: string,
  amountGbp: number,
): Promise<string> {
  const key = `notion_import|${userId}|${date}|${customerName}|${amountGbp}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const bytes = new Uint8Array(digest).slice(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function seedContentKey(date: string, customerName: string, amountGbp: number | null): string {
  return `${date}|${customerName}|${amountGbp ?? ''}`
}

export async function buildSnapSeedBookings(userId: string): Promise<SnapBooking[]> {
  return Promise.all(
    RAW.map(async (row) => {
      const id = await snapSeedId(userId, row.date, row.customerName, row.amountGbp)
      return {
        id,
        date: row.date,
        customerName: row.customerName,
        spots: splitSpots(row.spots),
        minutes: row.minutes,
        course: row.course,
        headcount: row.headcount,
        listPriceGbp: row.amountGbp,
        paymentMethod: null,
        amountGbp: row.amountGbp,
        amountKrw: null,
        fxRate: null,
        status: '입금완료',
        gender: row.gender,
        ageBand: row.ageBand,
        purpose: row.purpose,
        stars: row.stars,
        photosUrl: null,
        note: null,
        source: 'notion_import' as const,
        createdAt: `${row.date}T12:00:00.000Z`,
      }
    }),
  )
}
