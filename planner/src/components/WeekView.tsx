import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { WeekTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import type { ItemsActions } from '../hooks/useItems'
import {
  formatWeekRange,
  getWeekStartDate,
  shiftWeekStart,
} from '../lib/weekUtils'
import { PlannerSidebar } from './PlannerSidebar'
import { DayColumn } from './DayColumn'
import { WeekSummary } from './WeekSummary'
import { MonthCalendarTrigger } from './MonthCalendarPopover'
import type { LinkedAppsActions } from '../hooks/useLinkedApps'

interface WeekViewProps {
  template: WeekTemplate
  weekStart: string
  planner: PlannerActions
  items: ItemsActions
  linkedApps: LinkedAppsActions
}

export function WeekView({ template, weekStart, planner, items, linkedApps }: WeekViewProps) {
  const goPrev = () => {
    void planner.goToWeek(shiftWeekStart(weekStart, -1))
  }

  const goNext = () => {
    void planner.goToWeek(shiftWeekStart(weekStart, 1))
  }

  const goToday = () => {
    void planner.goToWeek(getWeekStartDate())
  }

  const isCurrentWeek = weekStart === getWeekStartDate()
  const loadingWeek = planner.loadingWeek

  return (
    <div className="flex min-h-screen gap-6 p-6 pb-24">
      <PlannerSidebar linkedApps={linkedApps} />

      <div className="min-w-0 flex-1">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">
              Weekly Planner
            </h1>
            <MonthCalendarTrigger
              weekStart={weekStart}
              label={formatWeekRange(weekStart)}
              onSelectWeek={(targetWeek) => {
                void planner.goToWeek(targetWeek)
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="rounded-lg p-2 text-muted hover:bg-white hover:shadow-sm"
              aria-label="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#007AFF] hover:bg-white"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg p-2 text-muted hover:bg-white hover:shadow-sm"
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        <div className="relative min-h-[320px]">
          <div
            className={`transition-all duration-200 ${
              loadingWeek ? 'pointer-events-none opacity-50 blur-[2px]' : ''
            }`}
            aria-busy={loadingWeek}
          >
            <WeekSummary
              dayCompletion={planner.dayCompletion}
              weekCompletionPercent={planner.weekCompletionPercent}
              days={template.days.map((d) => ({ key: d.key, dayName: d.dayName }))}
            />

            <div className="flex gap-2 overflow-x-auto pb-4">
              {template.days.map((day) => (
                <DayColumn
                  key={`${weekStart}-${day.key}`}
                  day={day}
                  weekStart={weekStart}
                  planner={planner}
                  items={items}
                />
              ))}
            </div>
          </div>

          {loadingWeek && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              aria-live="polite"
              aria-label="주간 데이터 불러오는 중"
            >
              <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-md ring-1 ring-black/5 backdrop-blur-sm">
                <Loader2 size={16} className="animate-spin text-[#007AFF]" aria-hidden />
                <span className="text-[12px] font-medium text-[#636366]">불러오는 중…</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
