import { ChevronLeft, ChevronRight } from 'lucide-react'
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
    planner.goToWeek(shiftWeekStart(weekStart, -1))
  }

  const goNext = () => {
    planner.goToWeek(shiftWeekStart(weekStart, 1))
  }

  const goToday = () => {
    planner.goToWeek(getWeekStartDate())
  }

  const isCurrentWeek = weekStart === getWeekStartDate()

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
              onSelectWeek={planner.goToWeek}
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
    </div>
  )
}
