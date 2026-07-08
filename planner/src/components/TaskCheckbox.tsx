import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface TaskEditPopoverProps {
  label: string
  oneOff?: boolean
  onRename: (label: string) => void
  onDelete: () => void
  onClose: () => void
}

function TaskEditPopover({ label, oneOff, onRename, onDelete, onClose }: TaskEditPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(label)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setDraft(label)
  }, [label])

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

  const handleSave = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== label) onRename(trimmed)
    onClose()
  }

  const handleDelete = () => {
    if (!oneOff && !confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete()
    onClose()
  }

  return (
    <div
      ref={panelRef}
      className="absolute left-6 top-full z-50 mt-1 w-[min(240px,calc(100vw-2rem))] rounded-xl border border-hairline bg-white p-2.5 shadow-lg"
      role="dialog"
      aria-label="Edit task"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        className="mb-2 w-full rounded-lg border border-hairline px-2.5 py-1.5 text-[13px] focus:border-[#007AFF]/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
          }
        }}
      />
      {confirmDelete && !oneOff && (
        <p className="mb-2 text-[11px] leading-snug text-red-600">
          매주 반복 목록에서 삭제됩니다. 계속할까요?
        </p>
      )}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2.5 py-1 text-[11px] text-muted hover:bg-[#F2F2F7]"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
        >
          {confirmDelete && !oneOff ? '삭제 확인' : '삭제'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-[#007AFF] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#0066DD]"
        >
          저장
        </button>
      </div>
    </div>
  )
}

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
  const [popoverOpen, setPopoverOpen] = useState(false)
  const editable = Boolean(onRename && onDelete && !hidden)

  return (
    <div className="group/task relative flex items-start gap-1 py-0.5">
      {!hidden && (
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span
            className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 ${
              checked
                ? 'border-transparent bg-[#007AFF] text-white check-pop'
                : oneOff
                  ? 'border-dashed border-[#AEAEB2] bg-white/50 group-hover/task:border-[#8E8E93]'
                  : 'border-[#C7C7CC] bg-white group-hover/task:border-[#AEAEB2]'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              onChange()
            }}
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
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

          {editable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPopoverOpen((v) => !v)
              }}
              className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${
                popoverOpen ? 'rounded-md ring-1 ring-[#007AFF]/25' : ''
              }`}
            >
              <span
                className={`text-[13px] leading-snug transition-colors duration-150 ${
                  checked ? 'text-muted line-through opacity-50' : 'text-[#1C1C1E]'
                }`}
              >
                {label}
              </span>
              {oneOff && (
                <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium text-[#8E8E93] ring-1 ring-[#D1D1D6]">
                  오늘만
                </span>
              )}
            </button>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className={`text-[13px] leading-snug transition-colors duration-150 ${
                  checked ? 'text-muted line-through opacity-50' : 'text-[#1C1C1E]'
                }`}
              >
                {label}
              </span>
              {oneOff && (
                <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium text-[#8E8E93] ring-1 ring-[#D1D1D6]">
                  오늘만
                </span>
              )}
            </span>
          )}
        </div>
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

      {popoverOpen && editable && onRename && onDelete && (
        <TaskEditPopover
          label={label}
          oneOff={oneOff}
          onRename={onRename}
          onDelete={onDelete}
          onClose={() => setPopoverOpen(false)}
        />
      )}

      {onHide && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onHide()
          }}
          className={`mt-0.5 shrink-0 rounded p-0.5 text-muted transition-opacity hover:text-[#48484A] ${
            hidden ? 'opacity-100' : 'opacity-0 group-hover/task:opacity-100'
          }`}
          aria-label={hidden ? 'Show task' : 'Hide task for today'}
          title={hidden ? '다시 표시' : '오늘만 숨기기'}
        >
          {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      )}
    </div>
  )
}
