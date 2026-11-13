import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { ChevronLeft, ChevronRight, Loader2, PanelLeftOpen } from 'lucide-react'
import type { DayKey, WeekTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import type { ItemsActions } from '../hooks/useItems'
import {
  parseBlockDragId,
  type BlockDropData,
  type CommitmentPlacementDragData,
  type CommitmentSlotDragData,
  type DayCommitmentDropData,
  type TaskDragData,
} from '../lib/taskDnd'
import { useWeekCommitments } from '../context/WeekCommitmentContext'
import { usePlannerData } from '../context/PlannerDataContext'
import {
  formatWeekRange,
  getDayKeyFromDate,
  getWeekStartDate,
  isToday,
  orderedDayKeys,
  parseDateKey,
  shiftWeekStart,
} from '../lib/weekUtils'
import { readAppVersionMeta } from '../lib/appVersion'
import { useMobileLayout } from '../hooks/useMobileLayout'
import { usePlannerSidebarCollapsed } from '../hooks/usePlannerSidebarCollapsed'
import { useWeekStartsOn } from '../hooks/useWeekStartsOn'
import { DAY_KEYS } from '../types/planner'
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
  const isMobileLayout = useMobileLayout()
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } =
    usePlannerSidebarCollapsed()
  const { weekStartsOn, setWeekStartsOn, labels: weekStartLabels } = useWeekStartsOn()
  const { cloudSyncing, cloudSyncError, refreshFromCloud, uploadThisDeviceToCloud } =
    usePlannerData()
  const weekCommitments = useWeekCommitments()
  const orderedDays = useMemo(() => {
    const byKey = new Map(template.days.map((d) => [d.key, d]))
    return orderedDayKeys(weekStartsOn)
      .map((key) => byKey.get(key))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
  }, [template.days, weekStartsOn])
  const [activeTaskDrag, setActiveTaskDrag] = useState<TaskDragData | null>(null)
  const [activeCommitmentDrag, setActiveCommitmentDrag] = useState<{
    title: string
    color: string
  } | null>(null)
  const [focusedDayKey, setFocusedDayKey] = useState<DayKey | null>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
      ? getDayKeyFromDate(new Date())
      : null,
  )

  useEffect(() => {
    if (!isMobileLayout) return
    setFocusedDayKey((current) => {
      if (current) return current
      const todayKey = getDayKeyFromDate(new Date())
      return isToday(todayKey, weekStart) ? todayKey : (template.days[0]?.key ?? null)
    })
  }, [isMobileLayout, weekStart, template.days])

  const focusedDay = focusedDayKey
    ? template.days.find((d) => d.key === focusedDayKey)
    : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const resolveDropDayKey = (overData: unknown, overId: string): DayKey | null => {
    if (overData && typeof overData === 'object' && 'type' in overData) {
      const typed = overData as DayCommitmentDropData | BlockDropData | CommitmentPlacementDragData
      if (typed.type === 'day-commitment-drop') return typed.dayKey
      if (typed.type === 'block-drop') return typed.dayKey
      if (typed.type === 'commitment-placement') return typed.dayKey
    }
    const dayMatch = String(overId).match(/^cday:([a-z]+)$/)
    if (dayMatch) return dayMatch[1] as DayKey
    const blockMatch = parseBlockDragId(String(overId))
    if (blockMatch) return blockMatch.dayKey
    return null
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'task') {
      setActiveTaskDrag(data as TaskDragData)
      setActiveCommitmentDrag(null)
      return
    }
    if (data?.type === 'commitment-slot') {
      const slot = data as CommitmentSlotDragData
      setActiveCommitmentDrag({ title: slot.title, color: slot.color })
      setActiveTaskDrag(null)
      return
    }
    if (data?.type === 'commitment-placement') {
      const placement = data as CommitmentPlacementDragData
      setActiveCommitmentDrag({ title: placement.title, color: placement.color })
      setActiveTaskDrag(null)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTaskDrag(null)
      setActiveCommitmentDrag(null)
      const { active, over } = event
      if (!over) return

      const activeData = active.data.current
      const overData = over.data.current
      if (!activeData) return

      if (activeData.type === 'commitment-slot') {
        const slot = activeData as CommitmentSlotDragData
        const dayKey = resolveDropDayKey(overData, String(over.id))
        if (!dayKey) return
        weekCommitments.placeCommitment(slot.commitmentId, dayKey)
        return
      }

      if (activeData.type === 'commitment-placement') {
        const placement = activeData as CommitmentPlacementDragData
        const dayKey = resolveDropDayKey(overData, String(over.id))
        if (!dayKey || dayKey === placement.dayKey) return
        weekCommitments.movePlacement(placement.placementId, dayKey)
        return
      }

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
    [planner, template.days, weekCommitments],
  )

  const goPrev = () => {
    if (!isMobileLayout) setFocusedDayKey(null)
    void planner.goToWeek(shiftWeekStart(weekStart, -1))
  }

  const goNext = () => {
    if (!isMobileLayout) setFocusedDayKey(null)
    void planner.goToWeek(shiftWeekStart(weekStart, 1))
  }

  const goToday = () => {
    if (isMobileLayout) {
      setFocusedDayKey(getDayKeyFromDate(new Date()))
    } else {
      setFocusedDayKey(null)
    }
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-screen gap-4 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:gap-6 sm:p-6 sm:pb-24">
        {!sidebarCollapsed && (
          <aside className="hidden shrink-0 lg:block">
            <PlannerSidebar linkedApps={linkedApps} />
          </aside>
        )}

        <div className="min-w-0 flex-1">
          <header className="mb-4 space-y-2 sm:mb-5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="hidden shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-white hover:text-[#1C1C1E] hover:shadow-sm lg:inline-flex"
                  aria-label="Show sidebar"
                  title="Show sidebar"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <h1 className="shrink-0 text-[20px] font-semibold leading-none tracking-tight text-[#1C1C1E] sm:text-[22px]">
                Weekly Planner
              </h1>

              <div className="min-w-[10rem] flex-1 self-center">
                <PageSearch
                  placeholder="Search blocks, tasks, events…"
                  suggestions={searchSuggestions}
                  onSelect={(s) => {
                    const dayKey = s.id.split(':')[1] as DayKey | undefined
                    if (dayKey) setFocusedDayKey(dayKey)
                  }}
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
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
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <MonthCalendarTrigger
                weekStart={weekStart}
                label={formatWeekRange(weekStart)}
                onSelectWeek={(targetWeek) => {
                  void planner.goToWeek(targetWeek)
                }}
              />
              <p className="text-[10px] text-muted/80" title="Build stamp for cache debugging">
                build {readAppVersionMeta() ?? 'unknown'}
              </p>
              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label="주 시작 요일"
              >
                <span className="mr-0.5 text-[11px] text-muted">주 시작</span>
                {DAY_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWeekStartsOn(key)}
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                      weekStartsOn === key
                        ? 'bg-[#007AFF] text-white'
                        : 'text-muted hover:bg-[#F2F2F7] hover:text-[#1C1C1E]'
                    }`}
                    aria-pressed={weekStartsOn === key}
                    title={`${weekStartLabels[key]}요일부터 한 주`}
                  >
                    {weekStartLabels[key]}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={cloudSyncing}
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Upload THIS browser’s weekly planner (events, routines, My Note) to Supabase?\n\nDo this on the Mac/browser that still shows your full schedule, then refresh 8l2v elsewhere.',
                      )
                    ) {
                      return
                    }
                    void uploadThisDeviceToCloud()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF] px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-[#0066DD] disabled:opacity-50"
                  title="Push this device’s planner data to Supabase"
                >
                  {cloudSyncing ? <Loader2 size={12} className="animate-spin" /> : null}
                  이 기기 → 클라우드
                </button>
                <button
                  type="button"
                  disabled={cloudSyncing}
                  onClick={() => void refreshFromCloud()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 text-[11px] font-medium text-[#007AFF] shadow-sm hover:bg-[#F2F2F7] disabled:opacity-50"
                  title="Reload weekly template, tasks, and events from Supabase"
                >
                  {cloudSyncing ? <Loader2 size={12} className="animate-spin" /> : null}
                  클라우드에서 불러오기
                </button>
              </div>
            </div>
          </header>

          {cloudSyncError && (
            <p className="mb-3 rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-[12px] text-[#FF3B30]">
              {cloudSyncError}
            </p>
          )}

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
                days={orderedDays.map((d) => ({ key: d.key, dayName: d.dayName }))}
                compact={isMobileLayout}
                onDayClick={(dayKey) => setFocusedDayKey(dayKey)}
              />

              {focusedDay ? (
                <DayFocusView
                  day={focusedDay}
                  weekStart={weekStart}
                  allDays={orderedDays}
                  planner={planner}
                  items={items}
                  showWeekOverviewBack={!isMobileLayout}
                  onClose={() => setFocusedDayKey(null)}
                  onNavigateDay={setFocusedDayKey}
                />
              ) : (
                <div className="hidden gap-2 overflow-x-auto pb-4 lg:flex">
                  {orderedDays.map((day) => (
                    <DayColumn
                      key={`${weekStart}-${weekStartsOn}-${day.key}`}
                      day={day}
                      weekStart={weekStart}
                      planner={planner}
                      items={items}
                      onFocusDay={() => setFocusedDayKey(day.key)}
                    />
                  ))}
                </div>
              )}
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

      <DragOverlay dropAnimation={null}>
        {activeTaskDrag ? (
          <div className="rounded-lg bg-white px-3 py-2 text-[13px] shadow-lg ring-1 ring-[#007AFF]/30">
            {activeTaskDrag.label}
          </div>
        ) : activeCommitmentDrag ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium shadow-lg"
            style={{
              borderColor: `${activeCommitmentDrag.color}55`,
              backgroundColor: `${activeCommitmentDrag.color}18`,
              color: activeCommitmentDrag.color,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: activeCommitmentDrag.color }}
            />
            {activeCommitmentDrag.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
