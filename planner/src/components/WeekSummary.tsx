import type { DayKey } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import { formatShortDateForDay, isToday } from '../lib/weekUtils'

interface WeekSummaryProps {
  dayCompletion: PlannerActions['dayCompletion']
  weekCompletionPercent: number
  weekStart: string
  days: { key: DayKey; dayName: string }[]
}

export function WeekSummary({
  dayCompletion,
  weekCompletionPercent,
  weekStart,
  days,
}: WeekSummaryProps) {
  return (
    <div className="mb-6 rounded-xl border border-hairline bg-white px-5 py-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-[#1C1C1E]">This Week</h2>
        <span className="text-[13px] text-muted">
          {weekCompletionPercent}% complete
        </span>
      </div>
      <div className="flex gap-2">
        {days.map((day) => {
          const stats = dayCompletion[day.key]
          const pct =
            stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)
          const today = isToday(day.key, weekStart)
          return (
            <div
              key={day.key}
              className={`flex-1 rounded-lg px-1 py-1 text-center ${
                today ? 'bg-[#007AFF]/10 ring-1 ring-[#007AFF]/30' : ''
              }`}
            >
              <div
                className={`mb-1 text-[11px] font-medium ${today ? 'font-semibold text-[#007AFF]' : 'text-muted'}`}
              >
                {day.dayName}{' '}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
