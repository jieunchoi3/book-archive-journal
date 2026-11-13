import { useDroppable } from '@dnd-kit/core'
import type { DayTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import { dayCommitmentDropId } from '../lib/taskDnd'
import { formatShortDateForDay, isToday } from '../lib/weekUtils'
import { DayItemsSection } from './DayItemsSection'
import { CommitmentPlacementCard } from './CommitmentPlacementCard'
import { useWeekCommitments } from '../context/WeekCommitmentContext'
import type { ItemsActions } from '../hooks/useItems'

interface DayColumnProps {
  day: DayTemplate
  weekStart: string
  planner: PlannerActions
  items: ItemsActions
  onFocusDay?: () => void
}

const DAY_TYPE_COLORS: Record<string, string> = {
  office: '#7B8FA1',
  off: '#9B8EC4',
  wfh: '#5BAFA8',
}

export function DayColumn({ day, weekStart, planner: _planner, items, onFocusDay }: DayColumnProps) {
  const today = isToday(day.key, weekStart)
  const commitments = useWeekCommitments()
  const dayPlacements = commitments.getPlacementsForDay(day.key)

  const { setNodeRef: setDayDropRef, isOver: isCommitmentOver } = useDroppable({
    id: dayCommitmentDropId(day.key),
    data: { type: 'day-commitment-drop', dayKey: day.key },
  })

  return (
    <div
      ref={setDayDropRef}
      className={`relative flex min-w-[168px] flex-1 flex-col overflow-visible rounded-xl border has-[[data-task-popover-open=true]]:z-40 ${
        today
          ? 'border-[#007AFF] bg-gradient-to-b from-[#007AFF]/10 via-[#007AFF]/[0.03] to-white shadow-lg shadow-[#007AFF]/20 ring-2 ring-[#007AFF]/25'
          : 'border-hairline bg-white'
      } ${isCommitmentOver ? 'ring-2 ring-[#34C759]/45' : ''}`}
    >
      {today && (
        <div className="absolute inset-y-0 left-0 w-1 bg-[#007AFF]" aria-hidden />
      )}
      <header
        className={`border-b px-3 py-3 ${today ? 'border-[#007AFF]/25 bg-[#007AFF]/[0.08]' : 'border-hairline'} ${onFocusDay ? 'cursor-pointer transition-colors hover:bg-[#007AFF]/5' : ''}`}
      >
        {onFocusDay ? (
          <button
            type="button"
            onClick={onFocusDay}
            className="w-full text-left"
            aria-label={`${day.dayName} focus view`}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span
                className={`text-[15px] font-semibold ${today ? 'text-[#007AFF]' : 'text-[#1C1C1E]'}`}
              >
                {day.dayName}
                <span
                  className={`ml-1 text-[13px] font-normal ${today ? 'text-[#007AFF]/75' : 'text-muted'}`}
                >
                  {formatShortDateForDay(weekStart, day.key)}
                </span>
              </span>
              {today && (
                <span className="shrink-0 rounded-full bg-[#007AFF] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-md shadow-[#007AFF]/40">
                  Today
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: DAY_TYPE_COLORS[day.dayType] }}
              />
              <span className="text-[11px] text-muted">{day.tag}</span>
            </div>
          </button>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-1">
              <span
                className={`text-[15px] font-semibold ${today ? 'text-[#007AFF]' : 'text-[#1C1C1E]'}`}
              >
                {day.dayName}
                <span
                  className={`ml-1 text-[13px] font-normal ${today ? 'text-[#007AFF]/75' : 'text-muted'}`}
                >
                  {formatShortDateForDay(weekStart, day.key)}
                </span>
              </span>
              {today && (
                <span className="shrink-0 rounded-full bg-[#007AFF] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-md shadow-[#007AFF]/40">
                  Today
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: DAY_TYPE_COLORS[day.dayType] }}
              />
              <span className="text-[11px] text-muted">{day.tag}</span>
            </div>
          </>
        )}
      </header>

      <DayItemsSection
        dayKey={day.key}
        weekStart={weekStart}
        occurrences={items.getItemsForDay(day.key)}
        items={items}
      />

      <div className="flex flex-1 flex-col gap-2 p-2">
        {dayPlacements.length === 0 ? (
          <p className="px-1 py-3 text-center text-[11px] text-muted">
            사이드바에서 블록을 드래그하세요
          </p>
        ) : (
          dayPlacements.map((placement) => {
            const commitment = commitments.getCommitment(placement.commitmentId)
            if (!commitment) return null
            return (
              <CommitmentPlacementCard
                key={placement.id}
                placement={placement}
                commitment={commitment}
                onToggleTask={(taskId) =>
                  commitments.togglePlacementTask(placement.id, taskId)
                }
                onAddTask={(label) => commitments.addPlacementTask(placement.id, label)}
                onDeleteTask={(taskId) =>
                  commitments.deletePlacementTask(placement.id, taskId)
                }
                onRenameTask={(taskId, label) =>
                  commitments.renamePlacementTask(placement.id, taskId, label)
                }
                onRemove={() => commitments.removePlacement(placement.id)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
