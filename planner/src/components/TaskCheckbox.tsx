import { useEffect, useState } from 'react'
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'

interface TaskCheckboxProps {
  label: string
  checked: boolean
  onChange: () => void
  oneOff?: boolean
  onHide?: () => void
  hidden?: boolean
  onRename?: (label: string) => void
  onDelete?: () => void
}

export function TaskCheckbox({
  label,
  checked,
  onChange,
  oneOff,
  onHide,
  hidden,
  onRename,
  onDelete,
}: TaskCheckboxProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)

  useEffect(() => {
    setDraft(label)
  }, [label])

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== label && onRename) {
      onRename(trimmed)
    } else {
      setDraft(label)
    }
    setEditing(false)
  }

  const cancelRename = () => {
    setDraft(label)
    setEditing(false)
  }

  return (
    <div className="group/task flex items-start gap-1 py-0.5">
      {!hidden && (
        <>
          {!editing && (
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
              <span
                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 ${
                  checked
                    ? 'border-transparent bg-[#007AFF] text-white check-pop'
                    : oneOff
                      ? 'border-dashed border-[#AEAEB2] bg-white/50 group-hover/task:border-[#8E8E93]'
                      : 'border-[#C7C7CC] bg-white group-hover/task:border-[#AEAEB2]'
                }`}
                onClick={(e) => {
                  e.preventDefault()
                  onChange()
                }}
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    onChange()
                  }
                }}
              >
                {checked && (
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
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className={`text-[13px] leading-snug transition-colors duration-150 ${
                    checked ? 'text-muted line-through opacity-50' : 'text-[#1C1C1E]'
                  }`}
                  onDoubleClick={(e) => {
                    if (!onRename) return
                    e.preventDefault()
                    e.stopPropagation()
                    setEditing(true)
                  }}
                >
                  {label}
                </span>
                {oneOff && (
                  <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium text-[#8E8E93] ring-1 ring-[#D1D1D6]">
                    오늘만
                  </span>
                )}
              </span>
            </label>
          )}

          {editing && onRename && (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-[#007AFF]/30 bg-white px-1.5 py-0.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelRename()
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </>
      )}

      {hidden && (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 pl-0.5">
          <span className="text-[13px] leading-snug text-muted line-through opacity-60">
            {label}
          </span>
          {oneOff && (
            <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium text-[#8E8E93] ring-1 ring-[#D1D1D6]">
              오늘만
            </span>
          )}
        </span>
      )}

      <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
        {onRename && !hidden && !editing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-[#48484A] group-hover/task:opacity-100"
            aria-label="Rename task"
            title="이름 변경"
          >
            <Pencil size={13} />
          </button>
        )}

        {onDelete && !hidden && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-red-500 group-hover/task:opacity-100"
            aria-label="Delete task"
            title="삭제"
          >
            <Trash2 size={13} />
          </button>
        )}

        {onHide && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onHide()
            }}
            className={`rounded p-0.5 text-muted transition-opacity hover:text-[#48484A] ${
              hidden ? 'opacity-100' : 'opacity-0 group-hover/task:opacity-100'
            }`}
            aria-label={hidden ? 'Show task' : 'Hide task for today'}
            title={hidden ? '다시 표시' : '오늘만 숨기기'}
          >
            {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}
