import { useEffect, useState } from 'react'
import { Columns2, Lock, Plus, X } from 'lucide-react'
import { usePlannerData } from '../context/PlannerDataContext'
import {
  addSidebarNoteColumn,
  canAddSidebarNoteColumn,
  parseSidebarNote,
  removeSidebarNoteColumn,
  serializeSidebarNote,
  updateSidebarNoteColumn,
  type SidebarNoteColumn,
} from '../lib/sidebarNoteColumns'

type MyNoteColumnsProps = {
  /** Compact header used inside Weekly / Monthly top strip. */
  variant?: 'card' | 'sidebar'
  minHeightClass?: string
  maxHeightClass?: string
}

export function MyNoteColumns({
  variant = 'card',
  minHeightClass = 'min-h-[120px]',
  maxHeightClass = 'max-h-[28vh]',
}: MyNoteColumnsProps) {
  const { sidebarNote, setSidebarNote } = usePlannerData()
  const [columns, setColumns] = useState<SidebarNoteColumn[]>(() =>
    parseSidebarNote(sidebarNote),
  )
  const [savedVisible, setSavedVisible] = useState(false)

  useEffect(() => {
    setColumns(parseSidebarNote(sidebarNote))
  }, [sidebarNote])

  useEffect(() => {
    if (!savedVisible) return
    const timer = setTimeout(() => setSavedVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [savedVisible])

  const persist = (next: SidebarNoteColumn[]) => {
    setColumns(next)
    setSidebarNote(serializeSidebarNote(next))
    setSavedVisible(true)
  }

  const header = (
    <div
      className={`flex items-center gap-2 ${
        variant === 'card'
          ? 'border-b border-hairline px-4 py-2.5'
          : 'mb-2 justify-between px-1'
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Lock
          size={variant === 'card' ? 12 : 11}
          className="shrink-0 text-muted/70"
          aria-hidden
        />
        <h2
          className={
            variant === 'card'
              ? 'text-[12px] font-semibold tracking-wide text-[#3C3C43]'
              : 'text-[11px] font-semibold uppercase tracking-wider text-muted'
          }
        >
          My Note
        </h2>
        {columns.length > 1 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F2F2F7] px-1.5 py-0.5 text-[10px] font-medium text-muted">
            <Columns2 size={10} aria-hidden />
            {columns.length}
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {savedVisible && (
          <span className="text-[10px] text-[#007AFF]/80" aria-live="polite">
            Saved
          </span>
        )}
        <button
          type="button"
          onClick={() => persist(addSidebarNoteColumn(columns))}
          disabled={!canAddSidebarNoteColumn(columns)}
          className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-[#007AFF] hover:bg-[#007AFF]/8 disabled:cursor-not-allowed disabled:opacity-40"
          title="Add column"
          aria-label="Add column"
        >
          <Plus size={12} />
          Column
        </button>
      </div>
    </div>
  )

  const body = (
    <div
      className={`flex gap-2 ${variant === 'card' ? 'px-3 pb-3 pt-2' : ''}`}
    >
      {columns.map((col, index) => (
        <div key={col.id} className="group relative min-w-0 flex-1">
          {columns.length > 1 && (
            <button
              type="button"
              onClick={() => persist(removeSidebarNoteColumn(columns, col.id))}
              className="absolute right-1.5 top-1.5 z-10 rounded-md bg-white/90 p-0.5 text-muted opacity-0 shadow-sm ring-1 ring-hairline transition-opacity hover:text-[#FF3B30] group-hover:opacity-100"
              aria-label={`Remove column ${index + 1}`}
              title="Remove column"
            >
              <X size={12} />
            </button>
          )}
          <textarea
            value={col.text}
            onChange={(e) =>
              persist(updateSidebarNoteColumn(columns, col.id, e.target.value))
            }
            placeholder={
              index === 0
                ? '이번 달 목표, 메모, 생각…'
                : `Column ${index + 1}`
            }
            className={`${minHeightClass} ${maxHeightClass} w-full resize-y overflow-y-auto rounded-xl border border-[#F0E6C8] bg-[#FFFCF0] px-3 py-2.5 text-[12px] leading-relaxed text-[#3C3C43] shadow-sm placeholder:text-[#AEAEB2] focus:border-[#E8D9A8] focus:outline-none focus:ring-2 focus:ring-[#F5E6B8]/80`}
            spellCheck
          />
        </div>
      ))}
    </div>
  )

  if (variant === 'sidebar') {
    return (
      <div className="mt-4 border-t border-hairline pt-4">
        {header}
        {body}
      </div>
    )
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-hairline bg-white/90 shadow-sm backdrop-blur-md"
      aria-label="My Note"
    >
      {header}
      {body}
    </section>
  )
}
