import type { DayKey } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'

interface WeekSummaryProps {
  dayCompletion: PlannerActions['dayCompletion']
  weekCompletionPercent: number
  days: { key: DayKey; dayName: string }[]
}

export function WeekSummary({
  dayCompletion,
  weekCompletionPercent,
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
          return (
            <div key={day.key} className="flex-1 text-center">
              <div className="mb-1 text-[11px] font-medium text-muted">{day.dayName}</div>
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
