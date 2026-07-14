import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import type { ItemsActions } from '../hooks/useItems'
import type { PlannerActions } from '../hooks/usePlanner'
import type { Item, ItemOccurrence, Recurrence } from '../types/item'
import { expandItemsForMonth } from '../lib/itemRecurrence'
import {
  formatMonthYear,
  getMonthGrid,
  getTodayKey,
  parseDateKey,
  weekStartFromDateKey,
} from '../lib/weekUtils'
import { ItemChip } from './ItemChip'
import { RecurrenceFields } from './RecurrenceFields'
import { QuickLaunchPanel } from './QuickLaunchPanel'
import type { LinkedAppsActions } from '../hooks/useLinkedApps'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE_EVENTS = 3

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

function QuickAddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string, recurrence: Recurrence | null, time?: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null)

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-hairline bg-[#FAFAFA] p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="이벤트 제목"
        autoFocus
        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            onAdd(title.trim(), recurrence, time.trim() || undefined)
          }
          if (e.key === 'Escape') onCancel()
        }}
      />
      <input
        type="text"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        placeholder="시간 (선택) 16:30–18:30"
        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] focus:outline-none"
      />
      <RecurrenceFields recurrence={recurrence} onRecurrenceChange={setRecurrence} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => onAdd(title.trim(), recurrence, time.trim() || undefined)}
          className="rounded-lg bg-[#007AFF] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          추가
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-[12px] text-muted">
          취소
        </button>
      </div>
    </div>
  )
}

function EditItemModal({
  item,
  items,
  onClose,
}: {
  item: Item
  items: ItemsActions
  onClose: () => void
}) {
  const [draft, setDraft] = useState({ ...item })
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-hairline bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="text-[14px] font-semibold">Edit Event</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none"
          />
          <input
            type="date"
            value={draft.dueDate ?? ''}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
            className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none"
          />
          <input
            type="text"
            value={draft.time ?? ''}
            onChange={(e) => setDraft({ ...draft, time: e.target.value || undefined })}
            placeholder="시간 (선택)"
            className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:outline-none"
          />
          <RecurrenceFields
            recurrence={draft.recurrence}
            onRecurrenceChange={(r) => setDraft({ ...draft, recurrence: r })}
          />
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={draft.showOnWeeklyView}
              onChange={(e) => setDraft({ ...draft, showOnWeeklyView: e.target.checked })}
            />
            Weekly view에 표시
          </label>
        </div>
        <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  items.deleteItem(item.id)
                  onClose()
                }}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] text-white"
              >
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px] text-muted">
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-[11px] text-red-500">
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              items.updateItem(item.id, draft)
              onClose()
            }}
            className="rounded-lg bg-[#007AFF] px-4 py-1.5 text-[12px] font-medium text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function MonthEventPill({
  occurrence,
  categoryColor,
}: {
  occurrence: ItemOccurrence
  categoryColor: string
}) {
  const { item, done } = occurrence
  return (
    <div
      className={`flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight ${
        done && item.checkable ? 'opacity-50' : ''
      }`}
      style={{ backgroundColor: `${categoryColor}22` }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor }}
      />
      <span className={`truncate font-medium text-[#1C1C1E] ${done && item.checkable ? 'line-through' : ''}`}>
        {item.title}
      </span>
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
  const [editingId, setEditingId] = useState<string | null>(null)

  const { year, month } = viewMonth
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month])
  const eventsByDate = useMemo(
    () => expandItemsForMonth(items.items, year, month),
    [items.items, year, month],
  )

  const todayKey = getTodayKey()
  const isCurrentMonth =
    viewMonth.year === today.getFullYear() && viewMonth.month === today.getMonth()

  const selectedOccurrences = selectedDateKey ? (eventsByDate[selectedDateKey] ?? []) : []
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

  const handleAddEvent = (title: string, recurrence: Recurrence | null, time?: string) => {
    if (!selectedDateKey) return
    items.addItem({
      title,
      categoryId: null,
      tagIds: [],
      dueDate: selectedDateKey,
      recurrence,
      showOnWeeklyView: true,
      time,
      checkable: true,
    })
    setShowAdd(false)
  }

  const openWeeklyForSelected = () => {
    if (!selectedDateKey) return
    void planner.goToWeek(weekStartFromDateKey(selectedDateKey))
    onOpenWeekly()
  }

  return (
    <div className="flex min-h-screen gap-6 p-6 pb-24">
      <aside className="hidden w-52 shrink-0 lg:block">
        <QuickLaunchPanel linkedApps={linkedApps} />
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

        <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-sm">
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
                  const dayEvents = eventsByDate[dateKey] ?? []
                  const visible = dayEvents.slice(0, MAX_VISIBLE_EVENTS)
                  const overflow = dayEvents.length - visible.length
                  const dayNum = parseDateKey(dateKey).getDate()

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(dateKey)
                        setShowAdd(false)
                      }}
                      className={`flex min-h-[88px] flex-col p-1.5 text-left transition-colors sm:min-h-[104px] ${
                        isSelected
                          ? 'bg-[#007AFF]/8 ring-1 ring-inset ring-[#007AFF]/30'
                          : 'hover:bg-[#FAFAFA]'
                      } ${!inMonth ? 'bg-[#FAFAFA]/50' : ''}`}
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
                {selectedOccurrences.map((occ) => (
                  <ItemChip
                    key={`${occ.item.id}-${occ.dateKey}`}
                    occurrence={occ}
                    onToggleDone={
                      occ.item.checkable
                        ? () => items.toggleItemDone(occ.item.id, occ.dateKey)
                        : undefined
                    }
                    onClick={() => setEditingId(occ.item.id)}
                  />
                ))}
              </div>
            ) : (
              !showAdd && <p className="mb-3 text-[13px] text-muted">No events on this day.</p>
            )}

            {showAdd && (
              <QuickAddForm onAdd={handleAddEvent} onCancel={() => setShowAdd(false)} />
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
