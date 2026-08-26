import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ExpenseCategory,
  ExpensePurpose,
  ExpenseSpendKind,
  ExpenseStore,
  MoneyFlow,
  MoneyTransaction,
} from '../types/expense'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_SOURCES,
  EXPENSE_COLORS,
  emptyExpenseStore,
  isDualAxisTransaction,
  isExpenseHierarchyMonth,
  kindsForPurpose,
  sumKindBudgetsForPurpose,
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
  purposes: ExpensePurpose[]
  spendKinds: ExpenseSpendKind[]
  purposeKindLinks: ExpenseStore['purposeKindLinks']
  kindsForActivePurpose: (purposeId: string) => ExpenseSpendKind[]
  addTransaction: (input: {
    amount: number
    flow: MoneyFlow
    categoryId?: string
    purposeId?: string
    spendKindId?: string
    dateKey: string
    note?: string
  }) => void
  updateTransaction: (
    id: string,
    input: {
      amount: number
      flow: MoneyFlow
      categoryId?: string
      purposeId?: string
      spendKindId?: string
      dateKey: string
      note?: string
    },
  ) => void
  deleteTransaction: (id: string) => void
  /** Mark a day as intentionally empty (no spending to record). */
  markDayNoSpend: (dateKey: string) => void
  clearDayMark: (dateKey: string) => void
  markDaysNoSpend: (dateKeys: string[]) => void
  /** Unglogged days this month through yesterday (newest first). */
  missingLogDays: string[]
  setCategoryBudget: (categoryId: string, budget: number | null) => void
  setPurposeBudget: (purposeId: string, budget: number | null) => void
  setSpendKindBudget: (spendKindId: string, budget: number | null) => void
  addCategory: (input: { name: string; color: string; kind: MoneyFlow }) => string
  renameCategory: (categoryId: string, name: string) => void
  deleteCategory: (categoryId: string) => void
  addSpendKind: (input: {
    name: string
    color?: string
    purposeId: string
  }) => string | null
  renameSpendKind: (spendKindId: string, name: string) => void
  deleteSpendKind: (spendKindId: string) => void
  unlinkSpendKindFromPurpose: (purposeId: string, spendKindId: string) => void
  monthKey: string
  setMonthKey: (year: number, month: number) => void
  /** True when viewing Sep 2026+ (dual-axis month). */
  isHierarchyMonth: boolean
  monthTransactions: MoneyTransaction[]
  spentByCategory: Record<string, number>
  spentByPurpose: Record<string, number>
  spentBySpendKind: Record<string, number>
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
          const seeded = ensureExpenseStore({
            ...loaded,
            categories: seedCategories(),
          })
          setStore(seeded)
          void saveExpenseStore(userId, seeded)
        } else {
          const normalized = ensureExpenseStore(loaded)
          setStore(normalized)
          const linksChanged =
            JSON.stringify(loaded.purposeKindLinks ?? []) !==
            JSON.stringify(normalized.purposeKindLinks ?? [])
          const purposeBudgetsChanged =
            JSON.stringify((loaded.purposes ?? []).map((p) => p.budget)) !==
            JSON.stringify((normalized.purposes ?? []).map((p) => p.budget))
          const needsSave =
            !loaded.purposes?.length ||
            linksChanged ||
            purposeBudgetsChanged ||
            (loaded.transactions?.length ?? 0) !== normalized.transactions.length ||
            loaded.transactions?.some(
              (t) => t.purposeId === undefined || t.spendKindId === undefined,
            )
          if (needsSave) void saveExpenseStore(userId, normalized)
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
  const monthKey = monthPrefix.slice(0, 7)
  const isHierarchyMonth = isExpenseHierarchyMonth(monthKey)

  const purposes = store.purposes ?? []
  const spendKinds = store.spendKinds ?? []
  const purposeKindLinks = store.purposeKindLinks ?? []

  const monthTransactions = useMemo(
    () => store.transactions.filter((t) => t.dateKey.startsWith(monthPrefix)),
    [store.transactions, monthPrefix],
  )

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of monthTransactions) {
      if (t.flow !== 'out') continue
      if (isDualAxisTransaction(t)) continue
      if (!t.categoryId) continue
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount
    }
    return map
  }, [monthTransactions])

  const spentByPurpose = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of monthTransactions) {
      if (!isDualAxisTransaction(t) || !t.purposeId) continue
      map[t.purposeId] = (map[t.purposeId] ?? 0) + t.amount
    }
    return map
  }, [monthTransactions])

  const spentBySpendKind = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of monthTransactions) {
      if (!isDualAxisTransaction(t) || !t.spendKindId) continue
      map[t.spendKindId] = (map[t.spendKindId] ?? 0) + t.amount
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

  const missingLogDays = useMemo(() => getMissingExpenseLogDays(store), [store])

  const kindsForActivePurpose = useCallback(
    (purposeId: string) => kindsForPurpose(purposeId, spendKinds, purposeKindLinks),
    [spendKinds, purposeKindLinks],
  )

  const addTransaction: ExpenseActions['addTransaction'] = useCallback(
    ({ amount, flow, categoryId, purposeId, spendKindId, dateKey, note }) => {
      if (!(amount > 0)) return
      const key = dateKey || getTodayKey()
      const dual =
        flow === 'out' && Boolean(purposeId?.trim()) && Boolean(spendKindId?.trim())
      const tx: MoneyTransaction = {
        id: generateId(),
        amount,
        flow,
        categoryId: dual ? '' : categoryId?.trim() || '',
        purposeId: dual ? purposeId!.trim() : '',
        spendKindId: dual ? spendKindId!.trim() : '',
        dateKey: key,
        note: note?.trim() ?? '',
        createdAt: new Date().toISOString(),
      }
      if (!dual && !tx.categoryId) return
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

  const updateTransaction: ExpenseActions['updateTransaction'] = useCallback(
    (id, { amount, flow, categoryId, purposeId, spendKindId, dateKey, note }) => {
      if (!(amount > 0)) return
      const existing = store.transactions.find((t) => t.id === id)
      if (!existing) return
      const key = dateKey || existing.dateKey
      const dual =
        flow === 'out' && Boolean(purposeId?.trim()) && Boolean(spendKindId?.trim())
      const next: MoneyTransaction = {
        ...existing,
        amount,
        flow,
        categoryId: dual ? '' : categoryId?.trim() || '',
        purposeId: dual ? purposeId!.trim() : '',
        spendKindId: dual ? spendKindId!.trim() : '',
        dateKey: key,
        note: note?.trim() ?? '',
      }
      if (!dual && !next.categoryId) return
      const dayMarks = { ...(store.dayMarks ?? {}) }
      delete dayMarks[key]
      persist({
        ...store,
        transactions: store.transactions.map((t) => (t.id === id ? next : t)),
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

  const setPurposeBudget = useCallback(
    (purposeId: string, budget: number | null) => {
      persist({
        ...store,
        purposes: (store.purposes ?? []).map((p) =>
          p.id === purposeId ? { ...p, budget } : p,
        ),
      })
    },
    [persist, store],
  )

  const setSpendKindBudget = useCallback(
    (spendKindId: string, budget: number | null) => {
      const spendKinds = (store.spendKinds ?? []).map((k) =>
        k.id === spendKindId ? { ...k, budget } : k,
      )
      const links = store.purposeKindLinks ?? []
      const purposes = (store.purposes ?? []).map((p) => ({
        ...p,
        budget: sumKindBudgetsForPurpose(p.id, spendKinds, links),
      }))
      persist({ ...store, spendKinds, purposes })
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
      })
    },
    [persist, store],
  )

  const addSpendKind: ExpenseActions['addSpendKind'] = useCallback(
    ({ name, color, purposeId }) => {
      const trimmed = name.trim()
      if (!trimmed || !purposeId) return null
      const purposesList = store.purposes ?? []
      if (!purposesList.some((p) => p.id === purposeId)) return null
      const kinds = store.spendKinds ?? []
      const links = store.purposeKindLinks ?? []
      const existing = kinds.find((k) => k.name.toLowerCase() === trimmed.toLowerCase())
      let spendKindId = existing?.id
      let nextKinds = kinds
      if (!spendKindId) {
        spendKindId = generateId()
        nextKinds = [
          ...kinds,
          {
            id: spendKindId,
            name: trimmed,
            color: color ?? EXPENSE_COLORS[kinds.length % EXPENSE_COLORS.length]!,
            budget: null,
          },
        ]
      }
      if (links.some((l) => l.purposeId === purposeId && l.spendKindId === spendKindId)) {
        if (nextKinds !== kinds) {
          persist({ ...store, spendKinds: nextKinds })
        }
        return spendKindId
      }
      persist({
        ...store,
        spendKinds: nextKinds,
        purposeKindLinks: [...links, { purposeId, spendKindId }],
      })
      return spendKindId
    },
    [persist, store],
  )

  const renameSpendKind = useCallback(
    (spendKindId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      persist({
        ...store,
        spendKinds: (store.spendKinds ?? []).map((k) =>
          k.id === spendKindId ? { ...k, name: trimmed } : k,
        ),
      })
    },
    [persist, store],
  )

  const deleteSpendKind = useCallback(
    (spendKindId: string) => {
      persist({
        ...store,
        spendKinds: (store.spendKinds ?? []).filter((k) => k.id !== spendKindId),
        purposeKindLinks: (store.purposeKindLinks ?? []).filter(
          (l) => l.spendKindId !== spendKindId,
        ),
      })
    },
    [persist, store],
  )

  const unlinkSpendKindFromPurpose = useCallback(
    (purposeId: string, spendKindId: string) => {
      persist({
        ...store,
        purposeKindLinks: (store.purposeKindLinks ?? []).filter(
          (l) => !(l.purposeId === purposeId && l.spendKindId === spendKindId),
        ),
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
    purposes,
    spendKinds,
    purposeKindLinks,
    kindsForActivePurpose,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    markDayNoSpend,
    clearDayMark,
    markDaysNoSpend,
    missingLogDays,
    setCategoryBudget,
    setPurposeBudget,
    setSpendKindBudget,
    addCategory,
    renameCategory,
    deleteCategory,
    addSpendKind,
    renameSpendKind,
    deleteSpendKind,
    unlinkSpendKindFromPurpose,
    monthKey,
    setMonthKey,
    isHierarchyMonth,
    monthTransactions,
    spentByCategory,
    spentByPurpose,
    spentBySpendKind,
    incomeByCategory,
    spentByDate,
    monthOutTotal,
    monthInTotal,
  }
}
