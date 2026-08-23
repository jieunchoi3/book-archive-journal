import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { DayKey, WeekTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import type { ItemsActions } from '../hooks/useItems'
import {
  parseBlockDragId,
  type BlockDropData,
  type TaskDragData,
} from '../lib/taskDnd'
import {
  formatWeekRange,
  getDayKeyFromDate,
  getWeekStartDate,
  parseDateKey,
  shiftWeekStart,
} from '../lib/weekUtils'
import { PlannerSidebar } from './PlannerSidebar'
import { DayColumn } from './DayColumn'
import { DayFocusView } from './DayFocusView'
import { WeekSummary } from './WeekSummary'
import { MonthCalendarTrigger } from './MonthCalendarPopover'
import { OverdueEventsSection } from './OverdueEventsSection'
import { CompassDueSection } from './CompassDueSection'
import { PageSearch, type SearchSuggestion } from './PageSearch'
import type { LinkedAppsActions } from '../hooks/useLinkedApps'
import type { CompassActions } from '../hooks/useCompass'

interface WeekViewProps {
  template: WeekTemplate
  weekStart: string
  planner: PlannerActions
  items: ItemsActions
  linkedApps: LinkedAppsActions
  compass?: CompassActions
  onOpenCompassAsk?: (questionId?: string) => void
}

export function WeekView({
  template,
  weekStart,
  planner,
  items,
  linkedApps,
  compass,
  onOpenCompassAsk,
}: WeekViewProps) {
  const [activeTaskDrag, setActiveTaskDrag] = useState<TaskDragData | null>(null)
  const [focusedDayKey, setFocusedDayKey] = useState<DayKey | null>(null)

  const focusedDay = focusedDayKey
    ? template.days.find((d) => d.key === focusedDayKey)
    : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'task') {
      setActiveTaskDrag(data as TaskDragData)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTaskDrag(null)
      const { active, over } = event
      if (!over) return

      const activeData = active.data.current
      const overData = over.data.current
      if (!activeData) return

      if (activeData.type === 'task') {
        const taskData = activeData as TaskDragData
        if (overData?.type !== 'block-drop') return
        const dropData = overData as BlockDropData
        if (
          taskData.dayKey === dropData.dayKey &&
          taskData.blockId === dropData.blockId
        ) {
          return
        }
        planner.moveTask(
          taskData.dayKey,
          taskData.blockId,
          dropData.dayKey,
          dropData.blockId,
          taskData.taskId,
          taskData.kind,
        )
        return
      }

      if (activeData.type === 'block') {
        const activeBlock = parseBlockDragId(String(active.id))
        const overBlock = parseBlockDragId(String(over.id))
        if (!activeBlock || !overBlock || activeBlock.dayKey !== overBlock.dayKey) return
        if (activeBlock.blockId === overBlock.blockId) return

        const day = template.days.find((d) => d.key === activeBlock.dayKey)
        if (!day) return

        const sortedBlocks = [...day.blocks].sort((a, b) => a.order - b.order)
        const activeBlocks = sortedBlocks.filter(
          (b) => !planner.isBlockCompleteForDay(activeBlock.dayKey, b),
        )
        const completedBlocks = sortedBlocks.filter((b) =>
          planner.isBlockCompleteForDay(activeBlock.dayKey, b),
        )

        const activeIds = activeBlocks.map((b) => b.id)
        const oldIndex = activeIds.indexOf(activeBlock.blockId)
        const newIndex = activeIds.indexOf(overBlock.blockId)
        if (oldIndex === -1 || newIndex === -1) return

        const next = [...activeIds]
        const [moved] = next.splice(oldIndex, 1)
        next.splice(newIndex, 0, moved)
        planner.reorderBlocks(activeBlock.dayKey, [
          ...next,
          ...completedBlocks.map((b) => b.id),
        ])
      }
    },
    [planner, template.days],
  )

  const goPrev = () => {
    setFocusedDayKey(null)
    void planner.goToWeek(shiftWeekStart(weekStart, -1))
  }

  const goNext = () => {
    setFocusedDayKey(null)
    void planner.goToWeek(shiftWeekStart(weekStart, 1))
  }

  const goToday = () => {
    setFocusedDayKey(null)
    void planner.goToWeek(getWeekStartDate())
  }

  const isCurrentWeek = weekStart === getWeekStartDate()
  const loadingWeek = planner.loadingWeek

  const searchSuggestions = useMemo((): SearchSuggestion[] => {
    const out: SearchSuggestion[] = []
    for (const day of template.days) {
      for (const block of day.blocks) {
        out.push({
          id: `block:${day.key}:${block.id}`,
          title: block.title,
          subtitle: [day.dayName, block.timeRangeLabel].filter(Boolean).join(' · '),
          meta: 'Block',
          haystack: [
            block.description,
            block.timeRangeLabel,
            day.tag,
            day.dayName,
            ...(block.badges ?? []),
          ],
        })
        for (const task of block.tasks) {
          out.push({
            id: `task:${day.key}:${block.id}:${task.id}`,
            title: task.label,
            subtitle: `${day.dayName} · ${block.title}`,
            meta: 'Task',
            haystack: [block.title, day.dayName],
          })
        }
        const note = planner.getBlockLog(day.key, block.id).flexibleNote?.trim()
        if (note) {
          out.push({
            id: `note:${day.key}:${block.id}`,
            title: note.length > 64 ? `${note.slice(0, 64)}…` : note,
            subtitle: `${day.dayName} · ${block.title}`,
            meta: 'Note',
            haystack: [note, block.title],
          })
        }
      }
      for (const occ of items.getItemsForDay(day.key)) {
        const cat = items.getCategory(occ.item.categoryId)
        out.push({
          id: `item:${day.key}:${occ.item.id}`,
          title: occ.item.title,
          subtitle: [day.dayName, cat?.name, occ.item.time].filter(Boolean).join(' · '),
          meta: 'Event',
          haystack: [cat?.name, occ.item.time, day.dayName].filter(
            (v): v is string => Boolean(v),
          ),
        })
      }
    }
    return out
  }, [template.days, planner, items])

  return (
    <div className="flex min-h-screen gap-6 p-6 pb-24">
      <PlannerSidebar linkedApps={linkedApps} />

      <div className="min-w-0 flex-1">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
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

        <div className="mb-4">
          <PageSearch
            placeholder="Search blocks, tasks, events…"
            suggestions={searchSuggestions}
            onSelect={(s) => {
              const dayKey = s.id.split(':')[1] as DayKey | undefined
              if (dayKey) setFocusedDayKey(dayKey)
            }}
          />
        </div>

        <OverdueEventsSection
          items={items}
          onSelectDate={(dateKey) => {
            const d = parseDateKey(dateKey)
            void planner.goToWeek(getWeekStartDate(d)).then(() => {
              setFocusedDayKey(getDayKeyFromDate(d))
            })
          }}
        />

        {compass && onOpenCompassAsk && (
          <CompassDueSection
            compass={compass}
            onOpenCompassAsk={onOpenCompassAsk}
          />
        )}

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
              weekStart={weekStart}
              days={template.days.map((d) => ({ key: d.key, dayName: d.dayName }))}
              onDayClick={(dayKey) => setFocusedDayKey(dayKey)}
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {focusedDay ? (
                <DayFocusView
                  day={focusedDay}
                  weekStart={weekStart}
                  allDays={template.days}
                  planner={planner}
                  items={items}
                  onClose={() => setFocusedDayKey(null)}
                  onNavigateDay={setFocusedDayKey}
                />
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-4">
                  {template.days.map((day) => (
                    <DayColumn
                      key={`${weekStart}-${day.key}`}
                      day={day}
                      weekStart={weekStart}
                      planner={planner}
                      items={items}
                      onFocusDay={() => setFocusedDayKey(day.key)}
                    />
                  ))}
                </div>
              )}

              <DragOverlay dropAnimation={null}>
                {activeTaskDrag ? (
                  <div className="rounded-lg bg-white px-3 py-2 text-[13px] shadow-lg ring-1 ring-[#007AFF]/30">
                    {activeTaskDrag.label}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
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
