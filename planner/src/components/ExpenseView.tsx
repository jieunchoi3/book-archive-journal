import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, Wallet, X } from 'lucide-react'
import { useExpenses } from '../hooks/useExpenses'
import { formatMoney } from '../types/expense'
import { formatMonthYear, getTodayKey, parseDateKey } from '../lib/weekUtils'
import { ExpenseQuickAdd } from './ExpenseQuickAdd'
import { ExpensePieChart } from './ExpensePieChart'
import { ExpenseReport } from './ExpenseReport'
import { PageSearch, type SearchSuggestion } from './PageSearch'

export function ExpenseView() {
  const expenses = useExpenses()
  const {
    loading,
    expenseCategories,
    incomeCategories,
    transactions,
    addTransaction,
    deleteTransaction,
    setCategoryBudget,
    addCategory,
    renameCategory,
    deleteCategory,
    setMonthKey,
    monthTransactions,
    spentByCategory,
    monthOutTotal,
    monthInTotal,
  } = expenses

  const [year, month] = useMemo(() => {
    const [y, m] = expenses.monthKey.split('-').map(Number)
    return [y, m - 1] as const
  }, [expenses.monthKey])

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(getTodayKey())
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({})
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const pieSlices = useMemo(
    () =>
      expenseCategories
        .map((cat) => ({
          id: cat.id,
          label: cat.name,
          value: spentByCategory[cat.id] ?? 0,
          color: cat.color,
        }))
        .filter((s) => s.value > 0)
        .sort((a, b) => b.value - a.value),
    [expenseCategories, spentByCategory],
  )

  const goPrev = () => {
    if (month === 0) setMonthKey(year - 1, 11)
    else setMonthKey(year, month - 1)
  }
  const goNext = () => {
    if (month === 11) setMonthKey(year + 1, 0)
    else setMonthKey(year, month + 1)
  }
  const goToday = () => {
    const now = new Date()
    setMonthKey(now.getFullYear(), now.getMonth())
    setSelectedDateKey(getTodayKey())
  }

  const recent = monthTransactions.slice(0, 12)
  const catById = useMemo(() => {
    const map = new Map(
      [...expenseCategories, ...incomeCategories].map((c) => [c.id, c] as const),
    )
    return map
  }, [expenseCategories, incomeCategories])

  const searchSuggestions = useMemo((): SearchSuggestion[] => {
    const txnSuggestions = transactions.map((t) => {
      const cat = catById.get(t.categoryId)
      const label = parseDateKey(t.dateKey).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      return {
        id: `txn:${t.id}`,
        title: t.note.trim() || cat?.name || (t.flow === 'in' ? 'Income' : 'Expense'),
        subtitle: `${t.flow === 'in' ? 'In' : 'Out'} · ${cat?.name ?? 'Uncategorised'}`,
        meta: `${formatMoney(t.amount)} · ${label}`,
        haystack: [
          t.note,
          cat?.name,
          t.flow,
          t.flow === 'in' ? 'income' : 'expense',
          String(t.amount),
          t.dateKey,
        ],
      }
    })
    const catSuggestions = [...expenseCategories, ...incomeCategories].map((c) => ({
      id: `cat:${c.id}`,
      title: c.name,
      subtitle: c.kind === 'in' ? 'Income source' : 'Expense category',
      meta: c.budget != null ? `Budget ${formatMoney(c.budget)}` : undefined,
      haystack: [c.kind, c.kind === 'in' ? 'income' : 'expense', 'budget'],
    }))
    return [...txnSuggestions, ...catSuggestions]
  }, [transactions, catById, expenseCategories, incomeCategories])

  return (
    <div className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#8B5A2B]/12 text-[#8B5A2B]">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">
                Expenses
              </h1>
              <p className="text-[13px] text-muted">
                Log in & out · budgets · see where money goes
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PageSearch
              placeholder="Search notes, categories, amounts…"
              suggestions={searchSuggestions}
              accentClassName="text-[#8B5A2B]"
              onSelect={(s) => {
                if (s.id.startsWith('txn:')) {
                  const id = s.id.slice(4)
                  const txn = transactions.find((t) => t.id === id)
                  if (!txn) return
                  const d = parseDateKey(txn.dateKey)
                  setMonthKey(d.getFullYear(), d.getMonth())
                  setSelectedDateKey(txn.dateKey)
                  return
                }
                if (s.id.startsWith('cat:')) {
                  const id = s.id.slice(4)
                  const cat = catById.get(id)
                  if (!cat) return
                  const hit = [...transactions]
                    .filter((t) => t.categoryId === id)
                    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0]
                  if (hit) {
                    const d = parseDateKey(hit.dateKey)
                    setMonthKey(d.getFullYear(), d.getMonth())
                    setSelectedDateKey(hit.dateKey)
                  }
                }
              }}
            />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="rounded-lg p-2 text-muted hover:bg-white hover:shadow-sm"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[140px] text-center text-[15px] font-semibold text-[#1C1C1E]">
              {formatMonthYear(year, month)}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg p-2 text-muted hover:bg-white hover:shadow-sm"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="ml-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#8B5A2B] hover:bg-white"
            >
              Today
            </button>
          </div>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Spent" value={formatMoney(monthOutTotal)} tone="out" />
          <StatCard label="Income" value={formatMoney(monthInTotal)} tone="in" />
          <StatCard
            label="Net"
            value={formatMoney(monthInTotal - monthOutTotal)}
            tone={monthInTotal - monthOutTotal >= 0 ? 'in' : 'out'}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <ExpenseQuickAdd
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            defaultDateKey={selectedDateKey ?? getTodayKey()}
            onAdd={addTransaction}
            onAddCategory={addCategory}
            onRenameCategory={renameCategory}
            onDeleteCategory={deleteCategory}
          />

          <div className="space-y-4">
            <div className="rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-1 text-[16px] font-semibold text-[#1C1C1E]">
                Spending by category
              </h2>
              <p className="mb-4 text-[12px] text-muted">
                This month’s expenses — set a budget to spot overspend
              </p>

              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                <ExpensePieChart slices={pieSlices} size={200} />
                <div className="min-w-0 flex-1 space-y-2">
                  {expenseCategories.map((cat) => {
                    const spent = spentByCategory[cat.id] ?? 0
                    const budget = cat.budget
                    const over = budget != null && budget > 0 && spent > budget
                    const pct =
                      budget != null && budget > 0
                        ? Math.min(100, Math.round((spent / budget) * 100))
                        : null
                    const draft =
                      budgetDrafts[cat.id] ??
                      (budget != null ? String(budget) : '')

                    return (
                      <div
                        key={cat.id}
                        className={`rounded-xl px-3 py-2.5 ${
                          over ? 'bg-[#FFF1F0] ring-1 ring-[#FF3B30]/20' : 'bg-[#FAFAFA]'
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {editingCatId === cat.id ? (
                              <div className="flex min-w-0 flex-1 items-center gap-1">
                                <input
                                  type="text"
                                  value={editingName}
                                  autoFocus
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      renameCategory(cat.id, editingName)
                                      setEditingCatId(null)
                                    }
                                    if (e.key === 'Escape') setEditingCatId(null)
                                  }}
                                  className="min-w-0 flex-1 rounded-md border border-hairline bg-white px-2 py-1 text-[13px] font-medium outline-none focus:border-[#8B5A2B]/40"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    renameCategory(cat.id, editingName)
                                    setEditingCatId(null)
                                  }}
                                  className="rounded-md p-1 text-[#3D7A5A] hover:bg-white"
                                  aria-label="Save name"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCatId(null)}
                                  className="rounded-md p-1 text-muted hover:bg-white"
                                  aria-label="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="min-w-0 truncate text-[13px] font-medium text-[#1C1C1E]">
                                  {cat.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCatId(cat.id)
                                    setEditingName(cat.name)
                                  }}
                                  className="rounded-md p-1 text-muted hover:bg-white hover:text-[#8B5A2B]"
                                  aria-label={`Rename ${cat.name}`}
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Delete category “${cat.name}”? Past logs keep their amounts but lose this label.`,
                                      )
                                    ) {
                                      deleteCategory(cat.id)
                                    }
                                  }}
                                  className="rounded-md p-1 text-muted hover:bg-white hover:text-[#FF3B30]"
                                  aria-label={`Delete ${cat.name}`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#1C1C1E]">
                            {formatMoney(spent)}
                            {over && (
                              <span className="ml-1 text-[11px] font-medium text-[#FF3B30]">
                                over
                              </span>
                            )}
                          </span>
                        </div>
                        {pct != null && (
                          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white">
                            <div
                              className={`h-full rounded-full ${
                                over ? 'bg-[#FF3B30]' : 'bg-[#8B5A2B]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-[11px] text-muted">
                          Budget
                          <span>£</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={draft}
                            placeholder="—"
                            onChange={(e) =>
                              setBudgetDrafts((prev) => ({
                                ...prev,
                                [cat.id]: e.target.value.replace(/[^0-9.]/g, ''),
                              }))
                            }
                            onBlur={() => {
                              const raw = budgetDrafts[cat.id]
                              if (raw === undefined) return
                              const n = Number(raw)
                              setCategoryBudget(
                                cat.id,
                                raw === '' || !(n > 0) ? null : n,
                              )
                            }}
                            className="w-20 rounded-md border border-hairline bg-white px-2 py-1 text-[12px] tabular-nums text-[#1C1C1E] outline-none focus:border-[#8B5A2B]/40"
                          />
                          {budget != null && budget > 0 && (
                            <span className="tabular-nums">
                              / {formatMoney(budget)}
                            </span>
                          )}
                        </label>
                      </div>
                    )
                  })}
                  {expenseCategories.length === 0 && (
                    <p className="text-[12px] text-muted">No expense categories yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#EAD7C4] bg-[#FBF7F2] px-4 py-3 text-[12px] text-[#5C4033]">
              <span className="font-semibold">Spending calendar</span>
              {' — '}
              open <span className="font-semibold">Diary</span> and turn on{' '}
              <span className="font-semibold">Show spending</span> to see brown heat on your days
              (with photos).
            </div>

            <ExpenseReport
              year={year}
              month={month}
              expenseCategories={expenseCategories}
              transactions={transactions}
              monthOutTotal={monthOutTotal}
            />

            <div className="rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-[16px] font-semibold text-[#1C1C1E]">
                This month’s log
              </h2>
              {loading && (
                <p className="text-[12px] text-muted">Loading…</p>
              )}
              {!loading && recent.length === 0 && (
                <p className="text-[12px] text-muted">No transactions this month yet.</p>
              )}
              <ul className="divide-y divide-hairline">
                {recent.map((t) => {
                  const cat = catById.get(t.categoryId)
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cat?.color ?? '#8E8E93' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[#1C1C1E]">
                          {cat?.name ?? 'Unknown'}
                          {t.note ? (
                            <span className="font-normal text-muted"> · {t.note}</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-muted">{t.dateKey}</p>
                      </div>
                      <span
                        className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                          t.flow === 'in' ? 'text-[#3D7A5A]' : 'text-[#8B5A2B]'
                        }`}
                      >
                        {t.flow === 'in' ? '+' : '−'}
                        {formatMoney(t.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTransaction(t.id)}
                        className="rounded-md p-1.5 text-muted hover:bg-[#F2F2F7] hover:text-[#FF3B30]"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
  className = '',
}: {
  label: string
  value: string
  tone: 'in' | 'out'
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-hairline bg-white px-4 py-3 shadow-sm ${className}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-0.5 text-[20px] font-semibold tabular-nums ${
          tone === 'in' ? 'text-[#3D7A5A]' : 'text-[#8B5A2B]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
