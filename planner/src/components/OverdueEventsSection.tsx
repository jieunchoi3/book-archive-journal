import { useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import type { ItemsActions } from '../hooks/useItems'
import { getOverdueOccurrences } from '../lib/itemRecurrence'
import { formatDueDateLong } from '../types/item'
import { parseDateKey } from '../lib/weekUtils'
import { ItemChip } from './ItemChip'
import { MyNoteColumns } from './MyNoteColumns'

interface OverdueEventsSectionProps {
  items: ItemsActions
  /** Optional: jump to the overdue day when a chip is clicked. */
  onSelectDate?: (dateKey: string) => void
}

function formatOverdueLabel(dateKey: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = parseDateKey(dateKey)
  due.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return formatDueDateLong(dateKey)
  if (days === 1) return '어제'
  if (days < 14) return `${days}일 전`
  return formatDueDateLong(dateKey)
}

export function OverdueEventsSection({ items, onSelectDate }: OverdueEventsSectionProps) {
  const overdue = useMemo(() => getOverdueOccurrences(items.items), [items.items])
  const [overdueExpanded, setOverdueExpanded] = useState(false)

  return (
    <div className="mb-4 space-y-2">
      {overdue.length > 0 && (
        <section
          className="overflow-hidden rounded-xl border border-[#FF3B30]/22 bg-[#FFF5F5]/95 shadow-sm backdrop-blur-md"
          aria-label="밀린 일정"
        >
          <button
            type="button"
            onClick={() => setOverdueExpanded((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#FF3B30]/5"
            aria-expanded={overdueExpanded}
          >
            {overdueExpanded ? (
              <ChevronDown size={14} className="shrink-0 text-[#FF3B30]" aria-hidden />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-[#FF3B30]" aria-hidden />
            )}
            <AlertCircle size={14} className="shrink-0 text-[#FF3B30]" aria-hidden />
            <h2 className="text-[12px] font-semibold tracking-wide text-[#FF3B30]">
              밀린 일정
            </h2>
            <span className="rounded-full bg-[#FF3B30]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF3B30]">
              {overdue.length}
            </span>
            {!overdueExpanded && (
              <span className="ml-auto text-[10px] font-medium text-[#FF3B30]/70">
                펼치기
              </span>
            )}
          </button>

          {overdueExpanded && (
            <ul className="flex max-h-52 flex-col gap-1.5 overflow-y-auto border-t border-[#FF3B30]/12 px-3 py-2.5">
              {overdue.map((occ) => {
                const cat = items.getCategory(occ.item.categoryId)
                return (
                  <li
                    key={`${occ.item.id}:${occ.dateKey}`}
                    className="flex items-start gap-2"
                  >
                    <span className="mt-1.5 w-[4.5rem] shrink-0 text-[10px] font-medium leading-tight text-[#FF3B30]/90">
                      {formatOverdueLabel(occ.dateKey)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <ItemChip
                        occurrence={occ}
                        categoryColor={cat?.color}
                        onToggleDone={
                          occ.item.checkable
                            ? () => items.toggleItemDone(occ.item.id, occ.dateKey)
                            : undefined
                        }
                        onClick={
                          onSelectDate ? () => onSelectDate(occ.dateKey) : undefined
                        }
                        onDelete={() => items.deleteItem(occ.item.id)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <MyNoteColumns variant="card" />
    </div>
  )
}
