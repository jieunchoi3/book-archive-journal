import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { COMPASS, formatYm, type LdSnapshot } from '../types/compass'

interface CompassTimelineSpineProps {
  snapshots: LdSnapshot[]
  activeId?: string | null
  onSelect: (snapshotId: string) => void
  onCompare?: (ids: [string, string]) => void
  onCreateNew: () => void
  /** Show "지금" empty slot for starting a new run */
  showNowSlot?: boolean
}

export function CompassTimelineSpine({
  snapshots,
  activeId,
  onSelect,
  onCompare,
  onCreateNew,
  showNowSlot = true,
}: CompassTimelineSpineProps) {
  const [shiftAnchor, setShiftAnchor] = useState<string | null>(null)
  const dragStart = useRef<string | null>(null)

  const ordered = useMemo(
    () =>
      [...snapshots].sort(
        (a, b) => a.takenAt.localeCompare(b.takenAt) || a.createdAt.localeCompare(b.createdAt),
      ),
    [snapshots],
  )

  const completes = ordered.filter((s) => s.status === 'complete')
  const drafts = ordered.filter((s) => s.status === 'draft')

  if (completes.length <= 1 && drafts.length === 0 && completes.length < 2) {
    const only = completes[0]
    return (
      <div
        className="mb-5 rounded-[18px] border border-[#ECE7E2] bg-white px-5 py-4"
        style={{ boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)' }}
      >
        <div className="flex items-center gap-3">
          {only ? (
            <button
              type="button"
              onClick={() => onSelect(only.id)}
              className={`flex h-3.5 w-3.5 shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[${COMPASS.accent}] focus:ring-offset-2`}
              style={{
                background: activeId === only.id ? COMPASS.accent : COMPASS.line,
              }}
              aria-label={`${formatYm(only.takenAt)} ${only.label ?? ''}`}
            />
          ) : (
            <span
              className="flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-dashed"
              style={{ borderColor: COMPASS.line }}
            />
          )}
          <p className="flex-1 text-[13px] text-[#8A847E]">
            다음에 다시 하면 여기서 비교할 수 있어요
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
          >
            <Plus size={14} />
            새로 하기
          </button>
        </div>
      </div>
    )
  }

  const dates = completes.map((s) => Date.parse(s.takenAt))
  const min = dates.length ? Math.min(...dates) : Date.now()
  const max = Math.max(Date.now(), ...(dates.length ? dates : [Date.now()]))
  const span = Math.max(max - min, 1)

  const positions = completes.map((s) => {
    const t = Date.parse(s.takenAt)
    return { snap: s, pct: ((t - min) / span) * 100 }
  })

  const handlePointClick = (id: string, e: MouseEvent) => {
    if (e.shiftKey && shiftAnchor && shiftAnchor !== id && onCompare) {
      onCompare([shiftAnchor, id])
      setShiftAnchor(null)
      return
    }
    setShiftAnchor(id)
    onSelect(id)
  }

  return (
    <div
      className="mb-5 rounded-[18px] border border-[#ECE7E2] bg-white px-5 py-4"
      style={{ boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)' }}
    >
      <div className="relative mb-6 h-10">
        <div
          className="absolute left-0 right-12 top-[7px] h-[2px]"
          style={{ background: COMPASS.line }}
        />
        {positions.map(({ snap, pct }, i) => {
          const active = activeId === snap.id
          const label = snap.label ?? `${i + 1}차`
          return (
            <button
              key={snap.id}
              type="button"
              className="absolute top-0 -translate-x-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
              style={{ left: `calc(${pct}% * 0.88)` }}
              onClick={(e) => handlePointClick(snap.id, e)}
              onMouseDown={() => {
                dragStart.current = snap.id
              }}
              onMouseUp={() => {
                if (
                  dragStart.current &&
                  dragStart.current !== snap.id &&
                  onCompare
                ) {
                  onCompare([dragStart.current, snap.id])
                }
                dragStart.current = null
              }}
              aria-label={`${formatYm(snap.takenAt)} ${label}`}
            >
              <span
                className="mx-auto block h-3.5 w-3.5 rounded-full"
                style={{
                  background: active ? COMPASS.accent : COMPASS.ink,
                  boxShadow: active ? `0 0 0 4px ${COMPASS.soft}` : undefined,
                }}
              />
              <span className="mt-1.5 block whitespace-nowrap text-[11px] font-medium text-[#1C1B1A]">
                {formatYm(snap.takenAt)}
              </span>
              <span
                className="block text-[10px]"
                style={{ color: active ? COMPASS.accent : '#8A847E' }}
              >
                {label}
                {active ? ' · 보고 있음' : ''}
              </span>
            </button>
          )
        })}

        {drafts.map((d) => (
          <button
            key={d.id}
            type="button"
            className="absolute top-0 right-14 -translate-x-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
            onClick={() => onSelect(d.id)}
            aria-label="작성 중"
          >
            <span
              className="mx-auto block h-3.5 w-3.5 rounded-full border-2 border-dashed bg-white"
              style={{ borderColor: COMPASS.accent }}
            />
            <span className="mt-1.5 block text-[10px] text-[#8A847E]">작성 중</span>
          </button>
        ))}

        {showNowSlot && (
          <button
            type="button"
            className="absolute right-0 top-0 flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
            onClick={onCreateNew}
            aria-label="새로 하기"
          >
            <span
              className="h-3.5 w-3.5 rounded-full border-2 bg-white"
              style={{ borderColor: COMPASS.line }}
            />
            <span className="mt-1.5 text-[10px] text-[#8A847E]">지금</span>
          </button>
        )}

        <button
          type="button"
          onClick={onCreateNew}
          className="absolute -right-1 top-8 inline-flex items-center gap-0.5 text-[12px] font-semibold"
          style={{ color: COMPASS.accent }}
        >
          <Plus size={14} />
          새로 하기
        </button>
      </div>
    </div>
  )
}
