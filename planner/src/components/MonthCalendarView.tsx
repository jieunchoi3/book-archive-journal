import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { ItemsActions } from '../hooks/useItems'
import type { PlannerActions } from '../hooks/usePlanner'
import type { ItemOccurrence } from '../types/item'
import { NO_CATEGORY_ID } from '../types/item'
import { expandItemsForMonth, normalizeRecurrenceForDate, dateKeyToRRuleDay } from '../lib/itemRecurrence'
import {
  formatMonthYear,
  getMonthGrid,
  getTodayKey,
  parseDateKey,
  weekStartFromDateKey,
} from '../lib/weekUtils'
import { EventQuickAddForm, type EventAddPayload } from './EventQuickAddForm'
import { ItemChip } from './ItemChip'
import { EditItemModal } from './ItemModals'
import { PlannerSidebar } from './PlannerSidebar'
import type { LinkedAppsActions } from '../hooks/useLinkedApps'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE_EVENTS = 3

type CategoryFilter = 'all' | typeof NO_CATEGORY_ID | string

function filterOccurrences(
  occurrences: ItemOccurrence[],
  categoryFilter: CategoryFilter,
): ItemOccurrence[] {
  if (categoryFilter === 'all') return occurrences
  if (categoryFilter === NO_CATEGORY_ID) {
    return occurrences.filter((occ) => occ.item.categoryId === null)
  }
  return occurrences.filter((occ) => occ.item.categoryId === categoryFilter)
}

function filterEventsByDate(
  eventsByDate: Record<string, ItemOccurrence[]>,
  categoryFilter: CategoryFilter,
): Record<string, ItemOccurrence[]> {
  if (categoryFilter === 'all') return eventsByDate
  const filtered: Record<string, ItemOccurrence[]> = {}
  for (const [dateKey, occurrences] of Object.entries(eventsByDate)) {
    const matching = filterOccurrences(occurrences, categoryFilter)
    if (matching.length > 0) filtered[dateKey] = matching
  }
  return filtered
}

interface MonthCalendarViewProps {
  items: ItemsActions
  planner: PlannerActions
  linkedApps: LinkedAppsActions
  onOpenWeekly: () => void
}

function formatSelectedDateLabel(dateKey: string): string {
  const d = parseDateKey(dateKey)
  return d.toLocaleDateString('ko-KR', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function CellAddPopover({
  items,
  dateKey,
  onAdd,
  onClose,
}: {
  items: ItemsActions
  dateKey: string
  onAdd: (payload: EventAddPayload) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-[200] mt-0.5 w-[min(280px,calc(100vw-2rem))]"
      onClick={(e) => e.stopPropagation()}
    >
      <EventQuickAddForm
        compact
        items={items}
        defaultWeeklyDay={dateKeyToRRuleDay(dateKey)}
        onAdd={onAdd}
        onCancel={onClose}
      />
    </div>
  )
}

function MonthEventPill({
  occurrence,
  categoryColor,
  onClick,
}: {
  occurrence: ItemOccurrence
  categoryColor: string
  onClick?: () => void
}) {
  const { item, done } = occurrence
  const content = (
    <>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor }}
      />
      <span className={`truncate font-medium text-[#1C1C1E] ${done && item.checkable ? 'line-through' : ''}`}>
        {item.title}
      </span>
    </>
  )

  const className = `flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight ${
    done && item.checkable ? 'opacity-50' : ''
  } ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-[#007AFF]/25' : ''}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={className}
        style={{ backgroundColor: `${categoryColor}22` }}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={className} style={{ backgroundColor: `${categoryColor}22` }}>
      {content}
    </div>
  )
}

export function MonthCalendarView({
  items,
  planner,
  linkedApps,
  onOpenWeekly,
}: MonthCalendarViewProps) {
  const today = useMemo(() => new Date(), [])
  const [viewMonth, setViewMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }))
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(getTodayKey())
  const [showAdd, setShowAdd] = useState(false)
  const [cellAddDateKey, setCellAddDateKey] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const { year, month } = viewMonth
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month])
  const eventsByDate = useMemo(
    () => expandItemsForMonth(items.items, year, month),
    [items.items, year, month],
  )
  const filteredEventsByDate = useMemo(
    () => filterEventsByDate(eventsByDate, categoryFilter),
    [eventsByDate, categoryFilter],
  )

  const todayKey = getTodayKey()
  const isCurrentMonth =
    viewMonth.year === today.getFullYear() && viewMonth.month === today.getMonth()

  const selectedOccurrences = selectedDateKey
    ? (filteredEventsByDate[selectedDateKey] ?? [])
    : []
  const editingItem = editingId ? items.items.find((i) => i.id === editingId) : null

  const goPrevMonth = () => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const goNextMonth = () => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const goToday = () => {
    const now = new Date()
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() })
    setSelectedDateKey(getTodayKey())
  }

  const handleAddEvent = (dateKey: string, payload: EventAddPayload) => {
    items.addItem({
      title: payload.title,
      categoryId: payload.categoryId,
      tagIds: [],
      dueDate: dateKey,
      recurrence: normalizeRecurrenceForDate(payload.recurrence, dateKey),
      showOnWeeklyView: true,
      time: payload.time,
      checkable: true,
    })
    setShowAdd(false)
    setCellAddDateKey(null)
    setSelectedDateKey(dateKey)
  }

  const openWeeklyForSelected = () => {
    if (!selectedDateKey) return
    void planner.goToWeek(weekStartFromDateKey(selectedDateKey))
    onOpenWeekly()
  }

  return (
    <div className="flex min-h-screen gap-6 p-6 pb-24">
      <aside className="hidden w-52 shrink-0 lg:block">
        <PlannerSidebar linkedApps={linkedApps} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">Events</h1>
            <p className="text-[13px] text-muted">Monthly overview of your events</p>
          </div>
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
        </header>

        {items.categories.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-[#1C1C1E] text-white'
                  : 'bg-[#F2F2F7] text-[#48484A] hover:bg-[#E5E5EA]'
              }`}
            >
              All
            </button>
            {items.categories.map((cat) => {
              const selected = categoryFilter === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(selected ? 'all' : cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    selected
                      ? 'text-white shadow-sm'
                      : 'bg-[#F2F2F7] text-[#48484A] hover:bg-[#E5E5EA]'
                  }`}
                  style={selected ? { backgroundColor: cat.color } : undefined}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: selected ? 'rgba(255,255,255,0.85)' : cat.color,
                    }}
                  />
                  {cat.name}
                </button>
              )
            })}
            {categoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="text-[11px] text-[#007AFF] hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        <div className="overflow-visible rounded-xl border border-hairline bg-white shadow-sm">
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
                  const isToday = dateKey === todayKey
                  const isSelected = dateKey === selectedDateKey
                  const dayEvents = filteredEventsByDate[dateKey] ?? []
                  const visible = dayEvents.slice(0, MAX_VISIBLE_EVENTS)
                  const overflow = dayEvents.length - visible.length
                  const dayNum = parseDateKey(dateKey).getDate()

                  return (
                    <div
                      key={dateKey}
                      className={`group/cell relative flex min-h-[88px] flex-col p-1.5 transition-colors sm:min-h-[104px] ${
                        isSelected
                          ? 'bg-[#007AFF]/8 ring-1 ring-inset ring-[#007AFF]/30'
                          : 'hover:bg-[#FAFAFA]'
                      } ${!inMonth ? 'bg-[#FAFAFA]/50' : ''} ${cellAddDateKey === dateKey ? 'z-40' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDateKey(dateKey)
                          setShowAdd(false)
                          setCellAddDateKey(null)
                        }}
                        className="flex min-h-0 flex-1 flex-col text-left"
                      >
                        <span
                          className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${
                            isToday
                              ? 'bg-[#007AFF] text-white'
                              : inMonth
                                ? 'text-[#1C1C1E]'
                                : 'text-[#C7C7CC]'
                          }`}
                        >
                          {dayNum}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          {visible.map((occ) => {
                            const cat = items.getCategory(occ.item.categoryId)
                            return (
                              <MonthEventPill
                                key={`${occ.item.id}-${occ.dateKey}`}
                                occurrence={occ}
                                categoryColor={cat?.color ?? '#8E8E93'}
                                onClick={() => setEditingId(occ.item.id)}
                              />
                            )
                          })}
                          {overflow > 0 && (
                            <span className="px-0.5 text-[10px] font-medium text-muted">
                              +{overflow} more
                            </span>
                          )}
                        </div>
                      </button>

                      {inMonth && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDateKey(dateKey)
                            setCellAddDateKey((prev) => (prev === dateKey ? null : dateKey))
                            setShowAdd(false)
                          }}
                          className={`absolute right-1 top-1 rounded-md p-0.5 text-muted transition-opacity hover:bg-[#007AFF]/10 hover:text-[#007AFF] ${
                            cellAddDateKey === dateKey
                              ? 'bg-[#007AFF]/10 text-[#007AFF] opacity-100'
                              : 'opacity-0 group-hover/cell:opacity-100'
                          }`}
                          aria-label={`Add event on ${dateKey}`}
                        >
                          <Plus size={13} />
                        </button>
                      )}

                      {cellAddDateKey === dateKey && (
                        <CellAddPopover
                          items={items}
                          dateKey={dateKey}
                          onAdd={(payload) => handleAddEvent(dateKey, payload)}
                          onClose={() => setCellAddDateKey(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {selectedDateKey && (
          <section className="mt-4 rounded-xl border border-hairline bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-[#1C1C1E]">
                {formatSelectedDateLabel(selectedDateKey)}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openWeeklyForSelected}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#007AFF] hover:bg-[#007AFF]/5"
                >
                  Open in Weekly
                </button>
                {!showAdd && (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1 rounded-lg bg-[#007AFF] px-3 py-1.5 text-[12px] font-medium text-white"
                  >
                    <Plus size={14} />
                    Add event
                  </button>
                )}
              </div>
            </div>

            {selectedOccurrences.length > 0 ? (
              <div className="mb-3 flex flex-col gap-1.5">
                {selectedOccurrences.map((occ) => {
                  const cat = items.getCategory(occ.item.categoryId)
                  return (
                    <ItemChip
                      key={`${occ.item.id}-${occ.dateKey}`}
                      occurrence={occ}
                      categoryColor={cat?.color}
                      onToggleDone={
                        occ.item.checkable
                          ? () => items.toggleItemDone(occ.item.id, occ.dateKey)
                          : undefined
                      }
                      onClick={() => setEditingId(occ.item.id)}
                    />
                  )
                })}
              </div>
            ) : (
              !showAdd && (
                <p className="mb-3 text-[13px] text-muted">
                  {categoryFilter !== 'all'
                    ? 'No events in this category on this day.'
                    : 'No events on this day.'}
                </p>
              )
            )}

            {showAdd && selectedDateKey && (
              <EventQuickAddForm
                items={items}
                onAdd={(payload) => handleAddEvent(selectedDateKey, payload)}
                onCancel={() => setShowAdd(false)}
              />
            )}
          </section>
        )}
      </div>

      {editingItem && (
        <EditItemModal item={editingItem} items={items} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}
