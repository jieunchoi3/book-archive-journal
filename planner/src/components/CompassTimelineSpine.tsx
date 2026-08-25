import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { COMPASS, formatYm, type LdSnapshot } from '../types/compass'

interface CompassTimelineSpineProps {
  snapshots: LdSnapshot[]
  activeId?: string | null
  onSelect: (snapshotId: string) => void
  onCompare?: (ids: [string, string]) => void
  onCreateNew: () => void
  showNowSlot?: boolean
}

/**
 * Timeline Spine — only complete snapshots.
 * 0 completes → grey hint line (no spine, no drafts, no “새로 하기”).
 */
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

  const completes = useMemo(
    () =>
      [...snapshots]
        .filter((s) => s.status === 'complete')
        .sort(
          (a, b) =>
            a.takenAt.localeCompare(b.takenAt) ||
            a.createdAt.localeCompare(b.createdAt),
        ),
    [snapshots],
  )

  if (completes.length === 0) {
    return (
      <div
        className="mb-5 flex h-11 items-center rounded-xl px-4 text-[13px] text-[#8A847E]"
        style={{ background: '#FAF8F6' }}
      >
        지금 쓰는 게 첫 기록이에요. 다음에 다시 하면 여기서 비교할 수 있어요.
      </div>
    )
  }

  const today = Date.now()
  const dates = completes.map((s) => Date.parse(s.takenAt))
  const min = Math.min(...dates)
  const max = Math.max(today, ...dates)
  const span = Math.max(max - min, 1)

  const positions = completes.map((s, i) => {
    const t = Date.parse(s.takenAt)
    const pct = ((t - min) / span) * 100
    return { snap: s, pct: Math.min(92, Math.max(0, pct)), index: i }
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
    <div className="mb-5">
      <div className="relative w-full px-8" style={{ height: 96 }}>
        <div
          className="absolute left-8 right-8 top-1/2 h-px -translate-y-1/2"
          style={{ background: COMPASS.line }}
        />

        {positions.map(({ snap, pct, index }) => {
          const active = activeId === snap.id
          const label = snap.label ?? `${index + 1}차`
          const showLabel = positions.length <= 4 || index % 2 === 0 || active
          return (
            <button
              key={snap.id}
              type="button"
              title={`${formatYm(snap.takenAt)} ${label}`}
              className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
              style={{ left: `calc(2rem + (100% - 4rem) * ${pct / 100})` }}
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
                className="mx-auto block rounded-full"
                style={{
                  width: 12,
                  height: 12,
                  background: COMPASS.accent,
                  boxShadow: active ? `0 0 0 4px ${COMPASS.soft}` : undefined,
                }}
              />
              {showLabel && (
                <>
                  <span className="mt-2.5 block whitespace-nowrap text-center text-[12px] text-[#8A847E]">
                    {formatYm(snap.takenAt)}
                  </span>
                  <span className="block whitespace-nowrap text-center text-[12px] text-[#B5AFA8]">
                    {label}
                    {active ? ' · 보고 있음' : ''}
                  </span>
                </>
              )}
            </button>
          )
        })}

        {showNowSlot && (
          <button
            type="button"
            className="absolute right-8 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
            onClick={onCreateNew}
            aria-label="지금"
            title="지금"
          >
            <span
              className="rounded-full border-[1.5px] bg-white"
              style={{ width: 14, height: 14, borderColor: COMPASS.line }}
            />
            <span className="mt-2.5 text-[12px] text-[#B5AFA8]">지금</span>
          </button>
        )}
      </div>
    </div>
  )
}
