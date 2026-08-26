import type { SnapBooking } from '../types/snap'

/** Canonical GBP revenue for a booking — single source of truth for all stats. */
export function revenueGbp(booking: SnapBooking): number {
  if (
    booking.paymentMethod === 'krw_transfer' &&
    booking.amountKrw != null &&
    booking.fxRate != null &&
    booking.fxRate > 0
  ) {
    return booking.amountKrw / booking.fxRate
  }
  if (booking.paymentMethod === 'cash_gbp' && booking.amountGbp != null) {
    return booking.amountGbp
  }
  if (booking.paymentMethod === 'unpaid') return 0
  if (booking.amountGbp != null) return booking.amountGbp
  return 0
}

export function discountGbp(booking: SnapBooking): number | null {
  if (booking.paymentMethod !== 'cash_gbp') return null
  return booking.listPriceGbp - revenueGbp(booking)
}

export function fxDeltaGbp(booking: SnapBooking): number | null {
  if (booking.paymentMethod !== 'krw_transfer') return null
  return revenueGbp(booking) - booking.listPriceGbp
}

/** Match repeat customers: trim name and strip trailing 님. */
export function normalizeCustomerName(name: string): string {
  return name.trim().replace(/님$/, '').trim()
}

export function isUnpaidBooking(booking: SnapBooking): boolean {
  return booking.status !== '입금완료' || booking.paymentMethod === 'unpaid'
}

export function bookingInPeriod(
  booking: SnapBooking,
  period: 'month' | 'year' | 'all',
  refDate = new Date(),
): boolean {
  if (period === 'all') return true
  const d = booking.date.slice(0, 10)
  const y = refDate.getFullYear()
  const m = String(refDate.getMonth() + 1).padStart(2, '0')
  if (period === 'year') return d.startsWith(String(y))
  return d.startsWith(`${y}-${m}`)
}

export function monthKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 7)
}
