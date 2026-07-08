import type { ItemOccurrence } from '../types/item'

interface ItemChipProps {
  occurrence: ItemOccurrence
  onToggleDone?: () => void
  onClick?: () => void
}

export function ItemChip({ occurrence, onToggleDone, onClick }: ItemChipProps) {
  const { item, done } = occurrence

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full bg-[#F2F2F7] px-2.5 py-1 ring-1 ring-[#E5E5EA]/80 transition-colors hover:bg-[#EBEBEF] ${
        done && item.checkable ? 'opacity-55' : ''
      }`}
    >
      {item.checkable && onToggleDone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone()
          }}
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            done
              ? 'border-transparent bg-[#8E8E93] text-white'
              : 'border-[#C7C7CC] bg-white hover:border-[#AEAEB2]'
          }`}
          aria-label={done ? 'Mark incomplete' : 'Mark done'}
        >
          {done && (
            <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
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
      )}

      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-1 text-left">
        <span className="min-w-0 truncate text-[11px] font-medium text-[#48484A]">
          <span className={done && item.checkable ? 'line-through' : ''}>{item.title}</span>
          {item.time && (
            <span className="ml-1 font-normal text-muted">{item.time}</span>
          )}
        </span>
      </button>
    </div>
  )
}
