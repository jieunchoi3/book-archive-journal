import { useMemo, useState } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import type { ItemsActions } from '../hooks/useItems'
import { getOverdueOccurrences } from '../lib/itemRecurrence'
import { formatDueDateLong } from '../types/item'
import { parseDateKey } from '../lib/weekUtils'
import { ItemChip } from './ItemChip'

const OPEN_STORAGE_KEY = 'planner-overdue-section-open'

interface OverdueEventsSectionProps {
  items: ItemsActions
  /** Optional: jump to the overdue day when a chip is clicked. */
  onSelectDate?: (dateKey: string) => void
}

function readInitialOpen(): boolean {
  try {
    const raw = localStorage.getItem(OPEN_STORAGE_KEY)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return true
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
  const [open, setOpen] = useState(readInitialOpen)

  if (overdue.length === 0) return null

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(OPEN_STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <section
      className="sticky top-0 z-20 mb-4 overflow-hidden rounded-xl border border-[#FF3B30]/22 bg-[#FFF5F5]/95 shadow-sm backdrop-blur-md"
      aria-label="밀린 일정"
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-[#FF3B30]/5 ${
          open ? 'border-b border-[#FF3B30]/12' : ''
        }`}
      >
        <AlertCircle size={14} className="shrink-0 text-[#FF3B30]" aria-hidden />
        <h2 className="text-[12px] font-semibold tracking-wide text-[#FF3B30]">
          밀린 일정
        </h2>
        <span className="rounded-full bg-[#FF3B30]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#FF3B30]">
          {overdue.length}
        </span>
        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 text-[#FF3B30]/80 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="flex max-h-52 flex-col gap-1.5 overflow-y-auto px-3 py-2.5">
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
  )
}
