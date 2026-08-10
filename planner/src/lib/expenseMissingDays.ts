import type { ExpenseStore } from '../types/expense'
import { formatDateKey, getTodayKey, parseDateKey } from './weekUtils'

/**
 * Days from the 1st of the current month through yesterday that have
 * neither a transaction nor a "no spending" mark.
 */
export function getMissingExpenseLogDays(
  store: Pick<ExpenseStore, 'transactions' | 'dayMarks'>,
  opts?: { throughDateKey?: string; maxDays?: number },
): string[] {
  const todayKey = opts?.throughDateKey ?? getTodayKey()
  const today = parseDateKey(todayKey)
  const end = new Date(today)
  end.setDate(end.getDate() - 1) // yesterday — today is still in progress

  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  if (end < start) return []

  const logged = new Set(store.transactions.map((t) => t.dateKey))
  const marks = store.dayMarks ?? {}
  const missing: string[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = formatDateKey(d)
    if (logged.has(key)) continue
    if (marks[key] === 'no_spend') continue
    missing.push(key)
  }

  // Newest first so recent gaps are at the top.
  missing.reverse()
  const max = opts?.maxDays ?? 31
  return missing.slice(0, max)
}
