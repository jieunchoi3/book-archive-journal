import { useMemo, useState } from 'react'
import type {
  ExpenseCategory,
  ExpensePurpose,
  ExpenseSpendKind,
  MoneyTransaction,
} from '../types/expense'
import { formatMoney, isDualAxisTransaction } from '../types/expense'
import { formatDateKey, parseDateKey } from '../lib/weekUtils'

interface ExpenseReportProps {
  year: number
  month: number
  expenseCategories: ExpenseCategory[]
  purposes?: ExpensePurpose[]
  spendKinds?: ExpenseSpendKind[]
  /** When true, filter dual-axis Sep+ transactions by purpose / kind. */
  isHierarchyMonth?: boolean
  transactions: MoneyTransaction[]
  monthOutTotal: number
}

function monthPrefix(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function prevYearMonth(year: number, month: number) {
  if (month === 0) return { year: year - 1, month: 11 }
  return { year, month: month - 1 }
}

export function ExpenseReport({
  year,
  month,
  expenseCategories,
  purposes = [],
  spendKinds = [],
  isHierarchyMonth = false,
  transactions,
  monthOutTotal,
}: ExpenseReportProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)
  const [purposeFilter, setPurposeFilter] = useState<string | 'all'>('all')
  const [kindFilter, setKindFilter] = useState<string | 'all'>('all')

  const activeIds = useMemo(() => {
    if (selectedIds === null) return new Set(expenseCategories.map((c) => c.id))
    return selectedIds
  }, [selectedIds, expenseCategories])

  const allSelected =
    selectedIds === null ||
    (expenseCategories.length > 0 &&
      expenseCategories.every((c) => activeIds.has(c.id)))

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) => {
      const base =
        prev === null
          ? new Set(expenseCategories.map((c) => c.id))
          : new Set(prev)
      if (base.has(id)) base.delete(id)
      else base.add(id)
      if (base.size === 0) return new Set()
      if (
        expenseCategories.length > 0 &&
        expenseCategories.every((c) => base.has(c.id))
      ) {
        return null
      }
      return base
    })
  }

  const selectAll = () => setSelectedIds(null)
  const clearAll = () => setSelectedIds(new Set())

  const prefix = monthPrefix(year, month)
  const prev = prevYearMonth(year, month)
  const prevPrefix = monthPrefix(prev.year, prev.month)
  const dayCount = daysInMonth(year, month)

  const matchesDual = (t: MoneyTransaction) => {
    if (t.flow !== 'out' || !isDualAxisTransaction(t)) return false
    if (purposeFilter !== 'all' && t.purposeId !== purposeFilter) return false
    if (kindFilter !== 'all' && t.spendKindId !== kindFilter) return false
    return true
  }

  const filteredOut = useMemo(
    () =>
      transactions.filter((t) => {
        if (!t.dateKey.startsWith(prefix) || t.flow !== 'out') return false
        if (isHierarchyMonth) return matchesDual(t)
        return activeIds.has(t.categoryId)
      }),
    // matchesDual closes over filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      transactions,
      prefix,
      isHierarchyMonth,
      activeIds,
      purposeFilter,
      kindFilter,
    ],
  )

  const prevFilteredOut = useMemo(
    () =>
      transactions.filter((t) => {
        if (!t.dateKey.startsWith(prevPrefix) || t.flow !== 'out') return false
        if (isHierarchyMonth) {
          if (!isDualAxisTransaction(t)) return false
          if (purposeFilter !== 'all' && t.purposeId !== purposeFilter) return false
          if (kindFilter !== 'all' && t.spendKindId !== kindFilter) return false
          return true
        }
        return activeIds.has(t.categoryId)
      }),
    [
      transactions,
      prevPrefix,
      isHierarchyMonth,
      activeIds,
      purposeFilter,
      kindFilter,
    ],
  )

  const filteredTotal = useMemo(
    () => filteredOut.reduce((a, t) => a + t.amount, 0),
    [filteredOut],
  )
  const prevTotal = useMemo(
    () => prevFilteredOut.reduce((a, t) => a + t.amount, 0),
    [prevFilteredOut],
  )

  const daily = useMemo(() => {
    const map: Record<string, number> = {}
    for (let d = 1; d <= dayCount; d++) {
      const key = `${prefix}${String(d).padStart(2, '0')}`
      map[key] = 0
    }
    for (const t of filteredOut) {
      map[t.dateKey] = (map[t.dateKey] ?? 0) + t.amount
    }
    return Array.from({ length: dayCount }, (_, i) => {
      const day = i + 1
      const dateKey = `${prefix}${String(day).padStart(2, '0')}`
      return { day, dateKey, amount: map[dateKey] ?? 0 }
    })
  }, [filteredOut, dayCount, prefix])

  const maxDay = useMemo(
    () => Math.max(1, ...daily.map((d) => d.amount)),
    [daily],
  )

  const byCategory = useMemo(() => {
    if (isHierarchyMonth) {
      // Prefer kind breakdown when a purpose is selected; else purpose rollup.
      // When only kind selected (purpose=all), single kind row is enough via kinds.
      if (purposeFilter !== 'all' || kindFilter === 'all') {
        if (purposeFilter !== 'all' && kindFilter === 'all') {
          const map: Record<string, number> = {}
          for (const t of filteredOut) {
            if (!t.spendKindId) continue
            map[t.spendKindId] = (map[t.spendKindId] ?? 0) + t.amount
          }
          return spendKinds
            .map((k) => ({
              id: k.id,
              name: k.name,
              color: k.color,
              amount: map[k.id] ?? 0,
              share: filteredTotal > 0 ? (map[k.id] ?? 0) / filteredTotal : 0,
            }))
            .sort((a, b) => b.amount - a.amount)
        }
        if (purposeFilter === 'all' && kindFilter === 'all') {
          const map: Record<string, number> = {}
          for (const t of filteredOut) {
            if (!t.purposeId) continue
            map[t.purposeId] = (map[t.purposeId] ?? 0) + t.amount
          }
          return purposes
            .map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              amount: map[p.id] ?? 0,
              share: filteredTotal > 0 ? (map[p.id] ?? 0) / filteredTotal : 0,
            }))
            .sort((a, b) => b.amount - a.amount)
        }
      }
      // kind-only or purpose+kind: show matching kinds
      const map: Record<string, number> = {}
      for (const t of filteredOut) {
        if (!t.spendKindId) continue
        map[t.spendKindId] = (map[t.spendKindId] ?? 0) + t.amount
      }
      return spendKinds
        .filter((k) => kindFilter === 'all' || k.id === kindFilter)
        .map((k) => ({
          id: k.id,
          name: k.name,
          color: k.color,
          amount: map[k.id] ?? 0,
          share: filteredTotal > 0 ? (map[k.id] ?? 0) / filteredTotal : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
    }

    const map: Record<string, number> = {}
    for (const t of filteredOut) {
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount
    }
    return expenseCategories
      .filter((c) => activeIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        amount: map[c.id] ?? 0,
        share: filteredTotal > 0 ? (map[c.id] ?? 0) / filteredTotal : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [
    filteredOut,
    expenseCategories,
    activeIds,
    filteredTotal,
    isHierarchyMonth,
    purposes,
    spendKinds,
    purposeFilter,
    kindFilter,
  ])

  const today = formatDateKey(new Date())
  const daysElapsed =
    year === new Date().getFullYear() && month === new Date().getMonth()
      ? Math.max(1, parseDateKey(today).getDate())
      : dayCount

  const dailyAvg = filteredTotal / daysElapsed
  const delta = filteredTotal - prevTotal
  const deltaPct = prevTotal > 0 ? (delta / prevTotal) * 100 : null
  const shareOfMonth =
    monthOutTotal > 0 ? (filteredTotal / monthOutTotal) * 100 : null

  const weekBuckets = useMemo(() => {
    const buckets: { label: string; amount: number }[] = []
    for (let start = 1; start <= dayCount; start += 7) {
      const end = Math.min(start + 6, dayCount)
      let amount = 0
      for (let d = start; d <= end; d++) {
        amount += daily[d - 1]?.amount ?? 0
      }
      buckets.push({
        label: start === end ? `${start}` : `${start}–${end}`,
        amount,
      })
    }
    return buckets
  }, [daily, dayCount])

  const maxWeek = Math.max(1, ...weekBuckets.map((w) => w.amount))

  const filterHint = isHierarchyMonth
    ? [
        purposeFilter === 'all'
          ? 'All purposes'
          : purposes.find((p) => p.id === purposeFilter)?.name,
        kindFilter === 'all'
          ? 'All types'
          : spendKinds.find((k) => k.id === kindFilter)?.name,
      ]
        .filter(Boolean)
        .join(' · ')
    : allSelected
      ? 'All categories'
      : `${activeIds.size} categor${activeIds.size === 1 ? 'y' : 'ies'}`

  return (
    <>
      {isHierarchyMonth ? (
        <div className="mb-4 space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Purpose
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={purposeFilter === 'all'}
                color="#8B5A2B"
                onClick={() => setPurposeFilter('all')}
              />
              {purposes.map((p) => (
                <FilterChip
                  key={p.id}
                  label={p.name}
                  active={purposeFilter === p.id}
                  color={p.color}
                  onClick={() => setPurposeFilter(p.id)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Spend type
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={kindFilter === 'all'}
                color="#8B5A2B"
                onClick={() => setKindFilter('all')}
              />
              {spendKinds.map((k) => (
                <FilterChip
                  key={k.id}
                  label={k.name}
                  active={kindFilter === k.id}
                  color={k.color}
                  onClick={() => setKindFilter(k.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-[11px]">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg px-2.5 py-1 font-medium text-[#8B5A2B] hover:bg-[#F3E5D8]"
            >
              All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg px-2.5 py-1 font-medium text-muted hover:bg-[#F2F2F7]"
            >
              Clear
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {expenseCategories.map((cat) => {
              const on = activeIds.has(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    on
                      ? 'text-white shadow-sm'
                      : 'bg-[#F2F2F7] text-[#8E8E93] line-through decoration-[#C7C7CC]'
                  }`}
                  style={on ? { backgroundColor: cat.color } : undefined}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: on ? 'rgba(255,255,255,0.85)' : cat.color,
                    }}
                  />
                  {cat.name}
                </button>
              )
            })}
            {expenseCategories.length === 0 && (
              <p className="text-[12px] text-muted">No categories yet.</p>
            )}
          </div>
        </>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ResultCard label="Filtered total" value={formatMoney(filteredTotal)} hint={filterHint} />
        <ResultCard
          label="Daily average"
          value={formatMoney(dailyAvg)}
          hint={`Over ${daysElapsed} day${daysElapsed === 1 ? '' : 's'}`}
        />
        <ResultCard
          label="vs last month"
          value={
            prevTotal === 0 && filteredTotal === 0
              ? '—'
              : `${delta >= 0 ? '+' : '−'}${formatMoney(Math.abs(delta))}`
          }
          hint={
            deltaPct == null
              ? prevTotal === 0
                ? 'No prior month data'
                : undefined
              : `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}%`
          }
          tone={delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'}
        />
        <ResultCard
          label="Share of month"
          value={shareOfMonth == null ? '—' : `${Math.round(shareOfMonth)}%`}
          hint={`of ${formatMoney(monthOutTotal)} total out`}
        />
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[#1C1C1E]">Daily spending</h3>
          <span className="text-[11px] text-muted">{filteredOut.length} logs</span>
        </div>
        <div className="flex h-28 items-end gap-px overflow-x-auto rounded-xl bg-[#FAFAFA] px-2 pb-2 pt-3 sm:gap-0.5">
          {daily.map(({ day, amount, dateKey }) => {
            const h = amount > 0 ? Math.max(6, (amount / maxDay) * 100) : 2
            const isToday = dateKey === today
            return (
              <div
                key={dateKey}
                className="group relative flex min-w-[8px] flex-1 flex-col items-center justify-end"
                title={`${dateKey}: ${formatMoney(amount)}`}
              >
                <div
                  className={`w-full max-w-[14px] rounded-t-sm transition-colors ${
                    amount > 0 ? 'bg-[#8B5A2B]' : 'bg-[#E8E0D8]'
                  } ${isToday ? 'ring-1 ring-[#8B5A2B]/50' : ''}`}
                  style={{ height: `${h}%` }}
                />
                {(day === 1 || day % 5 === 0 || day === dayCount) && (
                  <span className="mt-1 text-[9px] tabular-nums text-muted">{day}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-5">
        <h3 className="mb-2 text-[13px] font-semibold text-[#1C1C1E]">By week</h3>
        <div className="space-y-2">
          {weekBuckets.map((w) => (
            <div key={w.label} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-[11px] tabular-nums text-muted">
                {w.label}
              </span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#F3E5D8]">
                <div
                  className="h-full rounded-full bg-[#8B5A2B]"
                  style={{ width: `${(w.amount / maxWeek) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[12px] font-medium tabular-nums text-[#1C1C1E]">
                {formatMoney(w.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-[#1C1C1E]">Breakdown</h3>
        {byCategory.every((c) => c.amount === 0) ? (
          <p className="text-[12px] text-muted">No spending in the selected filters.</p>
        ) : (
          <ul className="space-y-2">
            {byCategory
              .filter((c) => c.amount > 0)
              .map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#1C1C1E]">
                    {c.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted">
                    {Math.round(c.share * 100)}%
                  </span>
                  <span className="w-16 text-right text-[13px] font-semibold tabular-nums text-[#1C1C1E]">
                    {formatMoney(c.amount)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  )
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string
  active: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
        active ? 'text-white shadow-sm' : 'bg-[#F5F5F7] text-[#48484A]'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: active ? 'rgba(255,255,255,0.85)' : color }}
      />
      {label}
    </button>
  )
}

function ResultCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="rounded-xl bg-[#FAFAFA] px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-0.5 text-[16px] font-semibold tabular-nums ${
          tone === 'up'
            ? 'text-[#FF3B30]'
            : tone === 'down'
              ? 'text-[#3D7A5A]'
              : 'text-[#1C1C1E]'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-muted">{hint}</p>}
    </div>
  )
}
