import type { ItemOccurrence } from '../types/item'

interface ItemChipProps {
  occurrence: ItemOccurrence
  categoryColor?: string
  onToggleDone?: () => void
  onClick?: () => void
}

export function ItemChip({ occurrence, categoryColor, onToggleDone, onClick }: ItemChipProps) {
  const { item, done } = occurrence
  const color = categoryColor ?? '#8E8E93'

  return (
    <div
      className={`flex items-start gap-1.5 rounded-2xl px-2.5 py-1.5 transition-colors hover:brightness-[0.97] ${
        done && item.checkable ? 'opacity-55' : ''
      }`}
      style={{
        backgroundColor: `${color}22`,
        boxShadow: `inset 0 0 0 1px ${color}44`,
      }}
    >
      <span
        className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {item.checkable && onToggleDone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone()
          }}
          className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
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

      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-1 text-left">
        <span className="min-w-0 whitespace-normal break-words text-[11px] font-medium leading-snug text-[#48484A]">
          <span className={done && item.checkable ? 'line-through' : ''}>{item.title}</span>
          {item.time && (
            <span className="ml-1 font-normal text-muted">{item.time}</span>
          )}
        </span>
      </button>
    </div>
  )
}
