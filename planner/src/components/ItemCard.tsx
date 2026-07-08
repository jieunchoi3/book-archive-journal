import type { Item } from '../types/item'
import { formatDueDateLong, getItemDone, isRecurringItem } from '../types/item'

interface ItemCardProps {
  item: Item
  onToggle: () => void
  onClick: () => void
}

export function ItemCard({ item, onToggle, onClick }: ItemCardProps) {
  const done = isRecurringItem(item)
    ? getItemDone(item, item.dueDate ?? undefined)
    : item.done === true

  return (
    <div
      className={`rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md ${
        done ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
            done
              ? 'border-transparent bg-[#007AFF] text-white'
              : 'border-[#C7C7CC] bg-white hover:border-[#AEAEB2]'
          }`}
        >
          {done && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <p className={`text-[13px] font-medium leading-snug text-[#1C1C1E] ${done ? 'line-through' : ''}`}>
            {item.title}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {formatDueDateLong(item.dueDate)}
          </p>
        </button>
      </div>
    </div>
  )
}
