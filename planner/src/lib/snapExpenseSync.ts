import type { ExpenseCategory } from '../types/expense'
import type { SnapBooking } from '../types/snap'
import { revenueGbp } from './snapRevenue'

export function freelanceIncomeCategoryId(
  incomeCategories: ExpenseCategory[],
): string | null {
  return (
    incomeCategories.find(
      (c) => c.kind === 'in' && c.name.trim().toLowerCase() === 'freelance',
    )?.id ?? null
  )
}

export function snapIncomeAmountGbp(booking: SnapBooking): number {
  return revenueGbp(booking)
}

export function snapIncomeDateKey(booking: SnapBooking): string {
  const raw = booking.date.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  return raw
}

export function snapIncomeNote(booking: SnapBooking): string {
  const name = booking.customerName.trim() || '촬영'
  const course = booking.course ? String(booking.course) : ''
  const spot = booking.spots[0]?.trim()
  const parts = ['Snap', name, course, spot].filter(Boolean)
  return parts.join(' · ')
}
