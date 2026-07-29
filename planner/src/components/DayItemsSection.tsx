import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { DayKey } from '../types/planner'
import type { ItemsActions } from '../hooks/useItems'
import type { ItemOccurrence } from '../types/item'
import { getDateKeyForDay } from '../lib/weekUtils'
import { dayKeyToRRuleDay, normalizeRecurrenceForDate } from '../lib/itemRecurrence'
import { EventQuickAddForm } from './EventQuickAddForm'
import { ItemChip } from './ItemChip'
import { EditItemModal } from './ItemModals'

function isOccurrenceComplete(occ: ItemOccurrence): boolean {
  return occ.item.checkable && occ.done
}

/** Incomplete events first; completed sink below. Stable within each group. */
function sortOccurrencesByCompletion(occurrences: ItemOccurrence[]): ItemOccurrence[] {
  return [...occurrences].sort((a, b) => {
    return Number(isOccurrenceComplete(a)) - Number(isOccurrenceComplete(b))
  })
}

interface DayItemsSectionProps {
  dayKey: DayKey
  weekStart: string
  occurrences: ItemOccurrence[]
  items: ItemsActions
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
  const sortedOccurrences = useMemo(
    () => sortOccurrencesByCompletion(occurrences),
    [occurrences],
  )

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

      {sortedOccurrences.length > 0 && (
        <div className="mb-1.5 flex flex-col gap-1">
          {sortedOccurrences.map((occ) => {
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
      )}

      {showAdd && (
        <EventQuickAddForm
          compact
          items={items}
          defaultWeeklyDay={dayKeyToRRuleDay(dayKey)}
          onAdd={(payload) => {
            items.addItem({
              title: payload.title,
              categoryId: payload.categoryId,
              tagIds: [],
              dueDate,
              recurrence: normalizeRecurrenceForDate(payload.recurrence, dueDate),
              showOnWeeklyView: true,
              time: payload.time,
              checkable: true,
            })
            setShowAdd(false)
          }}
          onCancel={() => setShowAdd(false)}
        />
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
