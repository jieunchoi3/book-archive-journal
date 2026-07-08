import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { DayKey } from '../types/planner'
import type { ItemsActions } from '../hooks/useItems'
import type { Item, ItemOccurrence, Recurrence } from '../types/item'
import { getDateKeyForDay } from '../lib/weekUtils'
import { dayKeyToRRuleDay } from '../lib/itemRecurrence'
import { ItemChip } from './ItemChip'
import { RecurrenceFields } from './RecurrenceFields'

interface DayItemsSectionProps {
  dayKey: DayKey
  weekStart: string
  occurrences: ItemOccurrence[]
  items: ItemsActions
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
    <div className="space-y-2 rounded-lg border border-dashed border-hairline bg-[#FAFAFA] p-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        autoFocus
        className="w-full rounded-md border border-hairline bg-white px-2 py-1 text-[11px] focus:outline-none"
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
        className="w-full rounded-md border border-hairline bg-white px-2 py-1 text-[11px] focus:outline-none"
      />
      <RecurrenceFields recurrence={recurrence} onRecurrenceChange={setRecurrence} />
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => onAdd(title.trim(), recurrence, time.trim() || undefined)}
          className="rounded-md bg-[#007AFF] px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-40"
        >
          추가
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-2.5 py-1 text-[10px] text-muted">
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
          <h2 className="text-[14px] font-semibold">Edit Item</h2>
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

export function DayItemsSection({
  dayKey,
  weekStart,
  occurrences,
  items,
}: DayItemsSectionProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const dueDate = getDateKeyForDay(weekStart, dayKey)
  const editingItem = editingId ? items.items.find((i) => i.id === editingId) : null

  const handleAdd = (title: string, recurrence: Recurrence | null, time?: string) => {
    items.addItem({
      title,
      categoryId: null,
      tagIds: [],
      dueDate,
      recurrence: recurrence
        ? {
            ...recurrence,
            byDay:
              recurrence.freq === 'weekly' && !recurrence.byDay?.length
                ? [dayKeyToRRuleDay(dayKey)]
                : recurrence.byDay,
          }
        : null,
      showOnWeeklyView: true,
      time,
      checkable: true,
    })
    setShowAdd(false)
  }

  return (
    <div className="border-b border-hairline px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Events</span>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-md p-0.5 text-muted hover:bg-[#F2F2F7] hover:text-[#007AFF]"
            aria-label="Add item"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {occurrences.length > 0 && (
        <div className="mb-1.5 flex flex-col gap-1">
          {occurrences.map((occ) => (
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
      )}

      {showAdd && (
        <QuickAddForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {occurrences.length === 0 && !showAdd && (
        <p className="px-1 text-[10px] text-muted/70">No items</p>
      )}

      {editingItem && (
        <EditItemModal item={editingItem} items={items} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}
