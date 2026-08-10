import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ExpenseCategory, ExpenseStore, MoneyFlow, MoneyTransaction } from '../types/expense'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_SOURCES,
  emptyExpenseStore,
} from '../types/expense'
import { getMissingExpenseLogDays } from '../lib/expenseMissingDays'
import { ensureExpenseStore, loadExpenseStore, saveExpenseStore } from '../lib/expenseStorage'
import { generateId, getTodayKey } from '../lib/weekUtils'
import { useAuth } from './useAuth'

function seedCategories(): ExpenseCategory[] {
  return [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_SOURCES].map((c) => ({
    ...c,
    id: generateId(),
  }))
}

export interface ExpenseActions {
  loading: boolean
  categories: ExpenseCategory[]
  transactions: MoneyTransaction[]
  expenseCategories: ExpenseCategory[]
  incomeCategories: ExpenseCategory[]
  addTransaction: (input: {
    amount: number
    flow: MoneyFlow
    categoryId: string
    dateKey: string
    note?: string
  }) => void
  deleteTransaction: (id: string) => void
  /** Mark a day as intentionally empty (no spending to record). */
  markDayNoSpend: (dateKey: string) => void
  clearDayMark: (dateKey: string) => void
  markDaysNoSpend: (dateKeys: string[]) => void
  /** Unglogged days this month through yesterday (newest first). */
  missingLogDays: string[]
  setCategoryBudget: (categoryId: string, budget: number | null) => void
  addCategory: (input: { name: string; color: string; kind: MoneyFlow }) => string
  renameCategory: (categoryId: string, name: string) => void
  deleteCategory: (categoryId: string) => void
  monthKey: string
  setMonthKey: (year: number, month: number) => void
  monthTransactions: MoneyTransaction[]
  spentByCategory: Record<string, number>
  incomeByCategory: Record<string, number>
  spentByDate: Record<string, number>
  monthOutTotal: number
  monthInTotal: number
}

export function useExpenses(): ExpenseActions {
  const { user } = useAuth()
  const userId = user.id
  const today = new Date()
  const [store, setStore] = useState<ExpenseStore>(emptyExpenseStore)
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const loaded = ensureExpenseStore(await loadExpenseStore(userId))
        if (cancelled) return
        if (loaded.categories.length === 0) {
          const seeded = { ...loaded, categories: seedCategories() }
          setStore(seeded)
          void saveExpenseStore(userId, seeded)
        } else {
          setStore(loaded)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const persist = useCallback(
    (next: ExpenseStore) => {
      setStore(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void saveExpenseStore(userId, next).catch((e) =>
          console.error('[expenses] save failed', e),
        )
      }, 350)
    },
    [userId],
  )

  const monthPrefix = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-`

  const monthTransactions = useMemo(
    () => store.transactions.filter((t) => t.dateKey.startsWith(monthPrefix)),
    [store.transactions, monthPrefix],
  )

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of monthTransactions) {
      if (t.flow !== 'out') continue
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount
    }
    return map
  }, [monthTransactions])

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of monthTransactions) {
      if (t.flow !== 'in') continue
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount
    }
    return map
  }, [monthTransactions])

  const spentByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of monthTransactions) {
      if (t.flow !== 'out') continue
      map[t.dateKey] = (map[t.dateKey] ?? 0) + t.amount
    }
    return map
  }, [monthTransactions])

  const monthOutTotal = useMemo(
    () => Object.values(spentByDate).reduce((a, b) => a + b, 0),
    [spentByDate],
  )
  const monthInTotal = useMemo(
    () =>
      monthTransactions.filter((t) => t.flow === 'in').reduce((a, t) => a + t.amount, 0),
    [monthTransactions],
  )

  const expenseCategories = useMemo(
    () => store.categories.filter((c) => c.kind === 'out'),
    [store.categories],
  )
  const incomeCategories = useMemo(
    () => store.categories.filter((c) => c.kind === 'in'),
    [store.categories],
  )

  const missingLogDays = useMemo(
    () => getMissingExpenseLogDays(store),
    [store],
  )

  const addTransaction: ExpenseActions['addTransaction'] = useCallback(
    ({ amount, flow, categoryId, dateKey, note }) => {
      if (!(amount > 0)) return
      const key = dateKey || getTodayKey()
      const tx: MoneyTransaction = {
        id: generateId(),
        amount,
        flow,
        categoryId,
        dateKey: key,
        note: note?.trim() ?? '',
        createdAt: new Date().toISOString(),
      }
      const dayMarks = { ...(store.dayMarks ?? {}) }
      delete dayMarks[key]
      persist({
        ...store,
        transactions: [tx, ...store.transactions],
        dayMarks,
      })
    },
    [persist, store],
  )

  const deleteTransaction = useCallback(
    (id: string) => {
      persist({
        ...store,
        transactions: store.transactions.filter((t) => t.id !== id),
      })
    },
    [persist, store],
  )

  const markDayNoSpend = useCallback(
    (dateKey: string) => {
      if (!dateKey || dateKey >= getTodayKey()) return
      if (store.transactions.some((t) => t.dateKey === dateKey)) return
      persist({
        ...store,
        dayMarks: { ...(store.dayMarks ?? {}), [dateKey]: 'no_spend' },
      })
    },
    [persist, store],
  )

  const clearDayMark = useCallback(
    (dateKey: string) => {
      const dayMarks = { ...(store.dayMarks ?? {}) }
      if (!(dateKey in dayMarks)) return
      delete dayMarks[dateKey]
      persist({ ...store, dayMarks })
    },
    [persist, store],
  )

  const markDaysNoSpend = useCallback(
    (dateKeys: string[]) => {
      const todayKey = getTodayKey()
      const logged = new Set(store.transactions.map((t) => t.dateKey))
      const dayMarks = { ...(store.dayMarks ?? {}) }
      let changed = false
      for (const key of dateKeys) {
        if (!key || key >= todayKey || logged.has(key)) continue
        if (dayMarks[key] === 'no_spend') continue
        dayMarks[key] = 'no_spend'
        changed = true
      }
      if (changed) persist({ ...store, dayMarks })
    },
    [persist, store],
  )

  const setCategoryBudget = useCallback(
    (categoryId: string, budget: number | null) => {
      persist({
        ...store,
        categories: store.categories.map((c) =>
          c.id === categoryId ? { ...c, budget } : c,
        ),
      })
    },
    [persist, store],
  )

  const addCategory: ExpenseActions['addCategory'] = useCallback(
    ({ name, color, kind }) => {
      const id = generateId()
      persist({
        ...store,
        categories: [
          ...store.categories,
          { id, name: name.trim(), color, kind, budget: null },
        ],
      })
      return id
    },
    [persist, store],
  )

  const renameCategory = useCallback(
    (categoryId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      persist({
        ...store,
        categories: store.categories.map((c) =>
          c.id === categoryId ? { ...c, name: trimmed } : c,
        ),
      })
    },
    [persist, store],
  )

  const deleteCategory = useCallback(
    (categoryId: string) => {
      persist({
        ...store,
        categories: store.categories.filter((c) => c.id !== categoryId),
        // Keep past transactions; they will show as Unknown if category is gone.
      })
    },
    [persist, store],
  )

  const setMonthKey = useCallback((year: number, month: number) => {
    setViewMonth({ year, month })
  }, [])

  return {
    loading,
    categories: store.categories,
    transactions: store.transactions,
    expenseCategories,
    incomeCategories,
    addTransaction,
    deleteTransaction,
    markDayNoSpend,
    clearDayMark,
    markDaysNoSpend,
    missingLogDays,
    setCategoryBudget,
    addCategory,
    renameCategory,
    deleteCategory,
    monthKey: monthPrefix.slice(0, 7),
    setMonthKey,
    monthTransactions,
    spentByCategory,
    incomeByCategory,
    spentByDate,
    monthOutTotal,
    monthInTotal,
  }
}
