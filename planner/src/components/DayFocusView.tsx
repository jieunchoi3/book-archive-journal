import { useDroppable } from '@dnd-kit/core'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DayKey, DayTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import { dayCommitmentDropId } from '../lib/taskDnd'
import { formatShortDateForDay, isToday } from '../lib/weekUtils'
import { DayItemsSection } from './DayItemsSection'
import { CommitmentPlacementCard } from './CommitmentPlacementCard'
import { useWeekCommitments } from '../context/WeekCommitmentContext'
import type { ItemsActions } from '../hooks/useItems'

const DAY_TYPE_COLORS: Record<string, string> = {
  office: '#7B8FA1',
  off: '#9B8EC4',
  wfh: '#5BAFA8',
}

interface DayFocusViewProps {
  day: DayTemplate
  weekStart: string
  allDays: DayTemplate[]
  planner: PlannerActions
  items: ItemsActions
  showWeekOverviewBack?: boolean
  onClose: () => void
  onNavigateDay: (dayKey: DayKey) => void
}

export function DayFocusView({
  day,
  weekStart,
  allDays,
  planner,
  items,
  showWeekOverviewBack = true,
  onClose,
  onNavigateDay,
}: DayFocusViewProps) {
  const today = isToday(day.key, weekStart)
  const dayIndex = allDays.findIndex((d) => d.key === day.key)
  const weekCommitments = useWeekCommitments()
  const dayPlacements = weekCommitments.getPlacementsForDay(day.key)
  const { setNodeRef: setDayDropRef, isOver: isCommitmentOver } = useDroppable({
    id: dayCommitmentDropId(day.key),
    data: { type: 'day-commitment-drop', dayKey: day.key },
  })

  // Keep planner prop referenced for week navigation consumers / future stats.
  void planner

  return (
    <div
      ref={setDayDropRef}
      className={`rounded-xl border border-hairline bg-white shadow-sm ${
        isCommitmentOver ? 'ring-2 ring-[#34C759]/45' : ''
      }`}
    >
      <header
        className={`border-b px-4 py-4 ${today ? 'border-[#007AFF]/25 bg-gradient-to-r from-[#007AFF]/10 to-white' : 'border-hairline'}`}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {showWeekOverviewBack ? (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10"
            >
              <ArrowLeft size={16} />
              Week
            </button>
          ) : null}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={dayIndex <= 0}
              onClick={() => onNavigateDay(allDays[dayIndex - 1]!.key)}
              className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7] disabled:opacity-30"
              aria-label="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={dayIndex >= allDays.length - 1}
              onClick={() => onNavigateDay(allDays[dayIndex + 1]!.key)}
              className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7] disabled:opacity-30"
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <h2
                className={`text-[22px] font-semibold ${today ? 'text-[#007AFF]' : 'text-[#1C1C1E]'}`}
              >
                {day.dayName}
                <span
                  className={`ml-2 text-[16px] font-normal ${today ? 'text-[#007AFF]/75' : 'text-muted'}`}
                >
                  {formatShortDateForDay(weekStart, day.key)}
                </span>
              </h2>
              {today && (
                <span className="rounded-full bg-[#007AFF] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md shadow-[#007AFF]/30">
                  Today
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: DAY_TYPE_COLORS[day.dayType] }}
              />
              <span className="text-[13px] text-muted">{day.tag}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-hairline">
        <DayItemsSection
          dayKey={day.key}
          weekStart={weekStart}
          occurrences={items.getItemsForDay(day.key)}
          items={items}
        />
      </div>

      <div className="p-4">
        {dayPlacements.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">
            사이드바에서 커밋먼트 블록을 드래그하세요
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {dayPlacements.map((placement) => {
              const commitment = weekCommitments.getCommitment(placement.commitmentId)
              if (!commitment) return null
              return (
                <div key={placement.id} className="w-[min(300px,85vw)] shrink-0">
                  <CommitmentPlacementCard
                    placement={placement}
                    commitment={commitment}
                    onToggleTask={(taskId) =>
                      weekCommitments.togglePlacementTask(placement.id, taskId)
                    }
                    onAddTask={(label) =>
                      weekCommitments.addPlacementTask(placement.id, label)
                    }
                    onDeleteTask={(taskId) =>
                      weekCommitments.deletePlacementTask(placement.id, taskId)
                    }
                    onRenameTask={(taskId, label) =>
                      weekCommitments.renamePlacementTask(placement.id, taskId, label)
                    }
                    onRemove={() => weekCommitments.removePlacement(placement.id)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
