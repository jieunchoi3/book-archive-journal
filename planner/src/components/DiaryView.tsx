import { useEffect, useMemo, useState } from 'react'
import { BookHeart, ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { useDiary } from '../hooks/useDiary'
import { useExpenses } from '../hooks/useExpenses'
import {
  formatMonthYear,
  getMonthGrid,
  getTodayKey,
  parseDateKey,
} from '../lib/weekUtils'
import { isDiaryEntryEmpty } from '../types/diary'
import { formatMoney, spendHeatColor } from '../types/expense'
import { DiaryDayEditor } from './DiaryDayEditor'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SPEND_TOGGLE_KEY = 'planner:diaryShowSpending'

export function DiaryView() {
  const diary = useDiary()
  const {
    year,
    month,
    setViewMonth,
    entriesByDate,
    getEntry,
    ensureHydrated,
    upsertEntry,
    loading,
  } = diary
  const expenses = useExpenses()
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [showSpending, setShowSpending] = useState(() => {
    try {
      return localStorage.getItem(SPEND_TOGGLE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    expenses.setMonthKey(year, month)
  }, [year, month, expenses.setMonthKey])

  useEffect(() => {
    try {
      localStorage.setItem(SPEND_TOGGLE_KEY, showSpending ? '1' : '0')
    } catch {
      // ignore
    }
  }, [showSpending])

  useEffect(() => {
    if (!selectedDateKey) return
    void ensureHydrated(selectedDateKey)
  }, [selectedDateKey, ensureHydrated])

  const weeks = useMemo(() => getMonthGrid(year, month), [year, month])
  const todayKey = getTodayKey()
  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth()

  const maxSpend = useMemo(() => {
    const values = Object.values(expenses.spentByDate)
    return values.length ? Math.max(...values) : 0
  }, [expenses.spentByDate])

  const goPrevMonth = () => {
    if (month === 0) setViewMonth(year - 1, 11)
    else setViewMonth(year, month - 1)
  }

  const goNextMonth = () => {
    if (month === 11) setViewMonth(year + 1, 0)
    else setViewMonth(year, month + 1)
  }

  const goToday = () => {
    const now = new Date()
    setViewMonth(now.getFullYear(), now.getMonth())
    setSelectedDateKey(getTodayKey())
  }

  const selectedEntry = selectedDateKey ? getEntry(selectedDateKey) : null

  return (
    <div className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF2D55]/12 text-[#FF2D55]">
              <BookHeart size={20} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">Diary</h1>
              <p className="text-[13px] text-muted">
                Your photo diary — one square for each day
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSpending((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                showSpending
                  ? 'bg-[#8B5A2B] text-white shadow-sm'
                  : 'bg-[#F3E5D8] text-[#5C4033] hover:bg-[#EAD7C4]'
              }`}
              aria-pressed={showSpending}
            >
              <Wallet size={14} />
              Show spending
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrevMonth}
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
                onClick={goNextMonth}
                className="rounded-lg p-2 text-muted hover:bg-white hover:shadow-sm"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={goToday}
                  className="ml-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#007AFF] hover:bg-white"
                >
                  Today
                </button>
              )}
            </div>
          </div>
        </header>

        {showSpending && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span>Spend heat</span>
            <span
              className="h-2.5 w-20 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${spendHeatColor(0.08)}, ${spendHeatColor(1)})`,
              }}
            />
            <span>darker = spent more that day</span>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-hairline bg-[#FAFAFA]">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="divide-y divide-hairline">
            {weeks.map((week) => (
              <div key={week[0].dateKey} className="grid grid-cols-7 divide-x divide-hairline">
                {week.map(({ dateKey, inMonth }) => {
                  const entry = entriesByDate[dateKey]
                  const hasContent = entry && !isDiaryEntryEmpty(entry)
                  const isToday = dateKey === todayKey
                  const dayNum = parseDateKey(dateKey).getDate()
                  const spent = expenses.spentByDate[dateKey] ?? 0
                  const intensity =
                    showSpending && maxSpend > 0 && spent > 0 ? spent / maxSpend : 0
                  const hasPhoto = Boolean(entry?.coverDataUrl)

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(dateKey)}
                      className={`group relative flex aspect-square flex-col overflow-hidden text-left transition-colors ${
                        !inMonth ? 'bg-[#FAFAFA]/70' : 'bg-white hover:bg-[#FAFAFA]'
                      } ${selectedDateKey === dateKey ? 'ring-2 ring-inset ring-[#FF2D55]/45' : ''}`}
                      style={
                        showSpending && inMonth && !hasPhoto && spent > 0
                          ? { backgroundColor: spendHeatColor(0.12 + intensity * 0.88) }
                          : undefined
                      }
                    >
                      {hasPhoto ? (
                        <img
                          src={entry!.coverDataUrl!}
                          alt=""
                          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
                            inMonth ? 'opacity-100' : 'opacity-40'
                          }`}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/[0.02]" />
                      )}

                      {showSpending && inMonth && hasPhoto && spent > 0 && (
                        <div
                          className="absolute inset-0 mix-blend-multiply"
                          style={{
                            backgroundColor: spendHeatColor(0.25 + intensity * 0.75),
                            opacity: 0.35 + intensity * 0.35,
                          }}
                        />
                      )}

                      <div
                        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t px-1.5 pb-1.5 pt-8 ${
                          hasPhoto
                            ? 'from-black/55 via-black/20 to-transparent'
                            : showSpending && spent > 0
                              ? 'from-black/25 to-transparent'
                              : 'from-black/[0.04] to-transparent'
                        }`}
                      >
                        {showSpending && inMonth && spent > 0 && (
                          <p
                            className={`mb-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px] ${
                              hasPhoto || intensity > 0.55
                                ? 'text-white'
                                : 'text-[#5C4033]'
                            }`}
                          >
                            {formatMoney(spent)}
                          </p>
                        )}
                        {entry?.title && (
                          <p
                            className={`line-clamp-2 text-[10px] font-semibold leading-tight sm:text-[11px] ${
                              hasPhoto || (showSpending && intensity > 0.55)
                                ? 'text-white'
                                : 'text-[#1C1C1E]'
                            }`}
                          >
                            {entry.title}
                          </p>
                        )}
                      </div>

                      <span
                        className={`relative z-10 m-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums sm:text-[12px] ${
                          isToday
                            ? 'bg-[#FF2D55] text-white'
                            : hasPhoto
                              ? 'bg-black/35 text-white backdrop-blur-sm'
                              : showSpending && intensity > 0.55
                                ? 'bg-black/25 text-white'
                                : inMonth
                                  ? 'text-[#1C1C1E]'
                                  : 'text-[#C7C7CC]'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {hasContent && !hasPhoto && !(showSpending && spent > 0) && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FF2D55]" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {loading && (
          <p className="mt-3 text-center text-[12px] text-muted">Loading diary…</p>
        )}
      </div>

      {selectedDateKey && selectedEntry && (
        <DiaryDayEditor
          dateKey={selectedDateKey}
          entry={selectedEntry}
          onChange={(patch) => {
            void upsertEntry(selectedDateKey, patch)
          }}
          onClose={() => setSelectedDateKey(null)}
        />
      )}
    </div>
  )
}
