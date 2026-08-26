import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  SnapBooking,
  SnapCourse,
  SnapPaymentMethod,
  SnapPeriod,
  SnapStatus,
} from '../types/snap'
import {
  bookingInPeriod,
  discountGbp,
  fxDeltaGbp,
  isUnpaidBooking,
  monthKeyFromDate,
  normalizeCustomerName,
  revenueGbp,
} from '../lib/snapRevenue'
import {
  loadSnapBookings,
  persistSnapBookingDelete,
  persistSnapBookingUpsert,
  persistSnapBookings,
} from '../lib/snapStorage'
import { generateId, getTodayKey } from '../lib/weekUtils'
import { useAuth } from './useAuth'

export type SnapBookingInput = Omit<SnapBooking, 'id' | 'createdAt'>

export interface SnapActions {
  loading: boolean
  bookings: SnapBooking[]
  period: SnapPeriod
  setPeriod: (p: SnapPeriod) => void
  monthFilter: string | null
  setMonthFilter: (key: string | null) => void
  selectMonth: (key: string | null) => void
  filteredBookings: SnapBooking[]
  periodBookings: SnapBooking[]
  addBooking: (input: SnapBookingInput) => void
  updateBooking: (id: string, input: SnapBookingInput) => void
  deleteBooking: (id: string) => void
  unpaidBookings: SnapBooking[]
  unpaidCount: number
  stats: {
    totalRevenue: number
    shootCount: number
    totalHeadcount: number
    avgRevenuePerShoot: number
    effectiveHourlyRate: number
    repeatCustomerRate: number
  }
  monthlyRevenue: Array<{ monthKey: string; label: string; revenue: number; count: number }>
  courseBreakdown: Array<{
    course: string
    count: number
    revenue: number
    avgRevenue: number
  }>
  spotPopularity: Array<{ spot: string; count: number }>
  paymentMix: Array<{
    method: SnapPaymentMethod | null
    label: string
    count: number
    revenue: number
  }>
  totalCashDiscount: number
  totalFxDelta: number
  repeatCustomers: Array<{ name: string; count: number; revenue: number }>
}

export function useSnapBookings(): SnapActions {
  const { user } = useAuth()
  const userId = user.id
  const [bookings, setBookings] = useState<SnapBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriodState] = useState<SnapPeriod>('month')
  const [monthFilter, setMonthFilterState] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setPeriod = useCallback((p: SnapPeriod) => {
    setMonthFilterState(null)
    setPeriodState(p)
  }, [])

  const setMonthFilter = useCallback((key: string | null) => {
    setMonthFilterState(key)
  }, [])

  /** Bar tap sets the effective window to that month and clears period fight. */
  const selectMonth = useCallback((key: string | null) => {
    setMonthFilterState(key)
    if (key) setPeriodState('all')
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const loaded = await loadSnapBookings(userId)
        if (!cancelled) setBookings(loaded)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const persist = useCallback(
    (next: SnapBooking[]) => {
      setBookings(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void persistSnapBookings(userId, next).catch(console.error)
      }, 400)
    },
    [userId],
  )

  const periodBookings = useMemo(
    () => bookings.filter((b) => bookingInPeriod(b, period)),
    [bookings, period],
  )

  /** Month bar overrides the period toggle until cleared / period changed. */
  const activeBookings = useMemo(() => {
    if (monthFilter) {
      return bookings.filter((b) => monthKeyFromDate(b.date) === monthFilter)
    }
    return periodBookings
  }, [bookings, periodBookings, monthFilter])

  const filteredBookings = useMemo(
    () =>
      [...activeBookings].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      ),
    [activeBookings],
  )

  const unpaidBookings = useMemo(
    () =>
      [...bookings]
        .filter(isUnpaidBooking)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [bookings],
  )

  const stats = useMemo(() => {
    const rows = activeBookings
    const totalRevenue = rows.reduce((s, b) => s + revenueGbp(b), 0)
    const shootCount = rows.length
    const totalHeadcount = rows.reduce((s, b) => s + b.headcount, 0)
    const totalMinutes = rows.reduce((s, b) => s + (b.minutes ?? 0), 0)
    const avgRevenuePerShoot = shootCount > 0 ? totalRevenue / shootCount : 0
    const effectiveHourlyRate =
      totalMinutes > 0 ? (totalRevenue / totalMinutes) * 60 : 0

    const byCustomer = new Map<string, number>()
    for (const b of rows) {
      const key = normalizeCustomerName(b.customerName)
      byCustomer.set(key, (byCustomer.get(key) ?? 0) + 1)
    }
    const unique = byCustomer.size
    const repeat = [...byCustomer.values()].filter((c) => c >= 2).length
    const repeatCustomerRate = unique > 0 ? repeat / unique : 0

    return {
      totalRevenue,
      shootCount,
      totalHeadcount,
      avgRevenuePerShoot,
      effectiveHourlyRate,
      repeatCustomerRate,
    }
  }, [activeBookings])

  const monthlyRevenue = useMemo(() => {
    const start = new Date(2025, 6, 1)
    const now = new Date()
    const months: Array<{ monthKey: string; label: string; revenue: number; count: number }> = []
    const cursor = new Date(start)
    while (cursor <= now) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth()
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`
      const label = cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      const monthRows = bookings.filter((b) => monthKeyFromDate(b.date) === monthKey)
      months.push({
        monthKey,
        label,
        revenue: monthRows.reduce((s, b) => s + revenueGbp(b), 0),
        count: monthRows.length,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  }, [bookings])

  const courseBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>()
    for (const b of activeBookings) {
      const key = b.course || '미분류'
      const cur = map.get(key) ?? { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += revenueGbp(b)
      map.set(key, cur)
    }
    return [...map.entries()]
      .map(([course, { count, revenue }]) => ({
        course,
        count,
        revenue,
        avgRevenue: count > 0 ? revenue / count : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [activeBookings])

  const spotPopularity = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of activeBookings) {
      for (const spot of b.spots) {
        map.set(spot, (map.get(spot) ?? 0) + 1)
      }
    }
    return [...map.entries()]
      .map(([spot, count]) => ({ spot, count }))
      .sort((a, b) => b.count - a.count)
  }, [activeBookings])

  const { paymentMix, totalCashDiscount, totalFxDelta } = useMemo(() => {
    const groups = new Map<
      SnapPaymentMethod | null,
      { count: number; revenue: number }
    >()
    let totalCashDiscount = 0
    let totalFxDelta = 0

    for (const b of activeBookings) {
      const method = b.paymentMethod
      const cur = groups.get(method) ?? { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += revenueGbp(b)
      groups.set(method, cur)

      const disc = discountGbp(b)
      if (disc != null && disc > 0) totalCashDiscount += disc
      const fx = fxDeltaGbp(b)
      if (fx != null) totalFxDelta += fx
    }

    const labels: Record<string, string> = {
      cash_gbp: '현금 £',
      krw_transfer: '한국 계좌 ₩',
      unpaid: '아직 미입금',
    }

    const paymentMix = [...groups.entries()]
      .map(([method, { count, revenue }]) => ({
        method,
        label: method ? labels[method] : '기록 안 함',
        count,
        revenue,
      }))
      .sort((a, b) => b.count - a.count)

    return { paymentMix, totalCashDiscount, totalFxDelta }
  }, [activeBookings])

  const repeatCustomers = useMemo(() => {
    const map = new Map<string, { displayName: string; count: number; revenue: number }>()
    for (const b of activeBookings) {
      const key = normalizeCustomerName(b.customerName)
      const cur = map.get(key) ?? { displayName: b.customerName, count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += revenueGbp(b)
      map.set(key, cur)
    }
    return [...map.values()]
      .filter((c) => c.count >= 2)
      .map((c) => ({ name: c.displayName, count: c.count, revenue: c.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [activeBookings])

  const addBooking = useCallback(
    (input: SnapBookingInput) => {
      const booking: SnapBooking = {
        ...input,
        source: input.source ?? 'manual',
        id: generateId(),
        createdAt: new Date().toISOString(),
      }
      const next = [booking, ...bookings]
      persist(next)
      void persistSnapBookingUpsert(userId, booking, next)
    },
    [bookings, persist, userId],
  )

  const updateBooking = useCallback(
    (id: string, input: SnapBookingInput) => {
      const next = bookings.map((b) =>
        b.id === id
          ? {
              ...input,
              id,
              createdAt: b.createdAt,
              source: input.source ?? b.source ?? 'manual',
            }
          : b,
      )
      persist(next)
      const updated = next.find((b) => b.id === id)
      if (updated) void persistSnapBookingUpsert(userId, updated, next)
    },
    [bookings, persist, userId],
  )

  const deleteBooking = useCallback(
    (id: string) => {
      const next = bookings.filter((b) => b.id !== id)
      persist(next)
      void persistSnapBookingDelete(userId, id, next)
    },
    [bookings, persist, userId],
  )

  return {
    loading,
    bookings,
    period,
    setPeriod,
    monthFilter,
    setMonthFilter,
    selectMonth,
    filteredBookings,
    periodBookings,
    addBooking,
    updateBooking,
    deleteBooking,
    unpaidBookings,
    unpaidCount: unpaidBookings.length,
    stats,
    monthlyRevenue,
    courseBreakdown,
    spotPopularity,
    paymentMix,
    totalCashDiscount,
    totalFxDelta,
    repeatCustomers,
  }
}

export function defaultSnapBookingInput(): SnapBookingInput {
  return {
    date: getTodayKey(),
    customerName: '',
    spots: [],
    minutes: 50,
    course: '싱글',
    headcount: 1,
    listPriceGbp: 55,
    paymentMethod: 'cash_gbp',
    amountGbp: 50,
    amountKrw: null,
    fxRate: null,
    status: '입금완료',
    gender: null,
    ageBand: null,
    purpose: null,
    stars: null,
    photosUrl: null,
    note: null,
    source: 'manual',
  }
}

export type { SnapCourse, SnapPaymentMethod, SnapStatus }
