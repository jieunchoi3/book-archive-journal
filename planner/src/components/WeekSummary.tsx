import type { DayKey } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import { formatShortDateForDay, isToday } from '../lib/weekUtils'

interface WeekSummaryProps {
  dayCompletion: PlannerActions['dayCompletion']
  weekCompletionPercent: number
  weekStart: string
  days: { key: DayKey; dayName: string }[]
  compact?: boolean
  onDayClick?: (dayKey: DayKey) => void
}

export function WeekSummary({
  dayCompletion,
  weekCompletionPercent,
  weekStart,
  days,
  compact = false,
  onDayClick,
}: WeekSummaryProps) {
  return (
    <div className="mb-4 rounded-xl border border-hairline bg-white px-3 py-3 shadow-sm sm:mb-6 sm:px-5 sm:py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-[#1C1C1E]">This Week</h2>
        <span className="text-[12px] text-muted sm:text-[13px]">
          {weekCompletionPercent}% complete
        </span>
      </div>
      <div className={`flex gap-1.5 sm:gap-2 ${compact ? 'overflow-x-auto pb-1' : ''}`}>
        {days.map((day) => {
          const stats = dayCompletion[day.key]
          const pct =
            stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)
          const today = isToday(day.key, weekStart)
          const shortName = day.dayName.slice(0, 3)
          const inner = (
            <>
              <div
                className={`mb-1 text-[10px] font-medium sm:text-[11px] ${today ? 'font-semibold text-[#007AFF]' : 'text-muted'}`}
              >
                <span className={compact ? 'inline sm:hidden' : 'hidden'}>{shortName}</span>
                <span className={compact ? 'hidden sm:inline' : 'inline'}>{day.dayName}</span>{' '}
                <span className={today ? 'text-[#007AFF]/75' : ''}>
                  {formatShortDateForDay(weekStart, day.key)}
                </span>
              </div>
              <div className="mx-auto h-1.5 w-full max-w-[48px] overflow-hidden rounded-full bg-[#F2F2F7]">
                <div
                  className="h-full rounded-full bg-[#007AFF] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {stats.total > 0 && (
                <div className="mt-1 text-[10px] text-muted">
                  {stats.done}/{stats.total}
                </div>
              )}
            </>
          )

          const className = `${compact ? 'min-w-[52px] shrink-0' : 'flex-1'} rounded-lg px-1 py-1 text-center ${
            today ? 'bg-[#007AFF]/10 ring-1 ring-[#007AFF]/30' : ''
          } ${onDayClick ? 'cursor-pointer transition-colors hover:bg-[#007AFF]/5' : ''}`

          return onDayClick ? (
            <button
              key={day.key}
              type="button"
              onClick={() => onDayClick(day.key)}
              className={className}
            >
              {inner}
            </button>
          ) : (
            <div key={day.key} className={className}>
              {inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}
