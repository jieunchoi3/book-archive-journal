import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  COMPASS,
  emptyCoherenceData,
  newId,
  type CoherenceData,
  type CoherenceLink,
  type CoherenceLinkKind,
  type LongformData,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassCoherenceProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onOpenExercise: (key: 'workview' | 'lifeview') => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
}

const KINDS: CoherenceLinkKind[] = ['맞물림', '충돌', '애매']

function kindColor(k: CoherenceLinkKind) {
  if (k === '맞물림') return COMPASS.accent
  if (k === '충돌') return '#E0574A'
  return '#8A847E'
}

export function CompassCoherence({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onOpenExercise,
  onCompare,
  onRequestSnapshotAi,
}: CompassCoherenceProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'coherence',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<CoherenceData>(emptyCoherenceData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [leftSel, setLeftSel] = useState('')
  const [rightSel, setRightSel] = useState('')
  const [pendingKind, setPendingKind] = useState<CoherenceLinkKind | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [overlaySize, setOverlaySize] = useState({ w: 0, h: 0 })

  const work = compass.completeSnapshotsFor('workview').at(-1)
  const life = compass.completeSnapshotsFor('lifeview').at(-1)
  const workBody = (work?.data as unknown as LongformData | undefined)?.body ?? ''
  const lifeBody = (life?.data as unknown as LongformData | undefined)?.body ?? ''

  useEffect(() => {
    if (!active) {
      setData(emptyCoherenceData())
      return
    }
    const d = compass.getDraftData(active, emptyCoherenceData())
    setData({
      ...d,
      workviewSnapshotId: work?.id ?? d.workviewSnapshotId,
      lifeviewSnapshotId: life?.id ?? d.lifeviewSnapshotId,
    })
    setLockedMsg(false)
  }, [active, compass, life?.id, work?.id])

  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setOverlaySize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [work, life, data.links.length])

  const save = useCallback(
    async (id: string, next: CoherenceData) => {
      await compass.updateDraftData(id, next as unknown as Record<string, unknown>)
    },
    [compass],
  )
  const { savedAt, error } = useDebouncedDraftSave(
    active,
    data,
    save,
    Boolean(active && !readonly),
  )

  const tryLink = (kind: CoherenceLinkKind) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    if (!leftSel.trim() || !rightSel.trim()) return
    const link: CoherenceLink = {
      id: newId(),
      leftText: leftSel.trim(),
      rightText: rightSel.trim(),
      kind,
      action: kind === '충돌' ? '' : undefined,
    }
    setData((d) => ({ ...d, links: [...d.links, link] }))
    setLeftSel('')
    setRightSel('')
    setPendingKind(null)
  }

  const conflicts = data.links.filter((l) => l.kind === '충돌')
  const canComplete =
    conflicts.every((l) => (l.action ?? '').trim().length > 0) && data.links.length > 0

  const linkPaths = useMemo(() => {
    const w = overlaySize.w
    const h = Math.max(overlaySize.h, 80)
    const n = Math.max(data.links.length, 1)
    return data.links.map((l, i) => {
      const y = 48 + (i / n) * Math.max(h - 96, 48)
      const x1 = 24
      const x2 = Math.max(w - 24, 80)
      const c1 = w * 0.35
      const c2 = w * 0.65
      return {
        link: l,
        y,
        d: `M ${x1} ${y} C ${c1} ${y}, ${c2} ${y}, ${x2} ${y}`,
        midX: w / 2,
      }
    })
  }, [data.links, overlaySize.h, overlaySize.w])

  if (!work || !life) {
    return (
      <div
        className="rounded-[18px] border border-[#ECE7E2] bg-white p-8 text-center"
        style={{ boxShadow: cardShadow }}
      >
        <p className="text-[15px] text-[#8A847E]">
          일 관점과 삶 관점을 먼저 완료해야 맞춰볼 수 있어요.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {!work && (
            <button
              type="button"
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
              onClick={() => onOpenExercise('workview')}
            >
              일 관점 쓰기
            </button>
          )}
          {!life && (
            <button
              type="button"
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
              onClick={() => onOpenExercise('lifeview')}
            >
              삶 관점 쓰기
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <ExerciseChrome
      exerciseKey="coherence"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help="일과 삶의 관점에서 문장을 골라 맞물림·충돌·애매로 연결해요."
      lockedMsg={lockedMsg}
      onComplete={() => {
        if (!canComplete || !active) return
        void compass.completeSnapshot(active.id)
      }}
      completeLabel={canComplete ? '완료하기' : '충돌마다 할 일을 적어 주세요'}
    >
      <div ref={overlayRef} className="relative grid gap-4 lg:grid-cols-2">
        <Side
          title="일 관점"
          body={workBody}
          selection={leftSel}
          onSelect={setLeftSel}
          readonly={readonly}
        />
        <Side
          title="삶 관점"
          body={lifeBody}
          selection={rightSel}
          onSelect={setRightSel}
          readonly={readonly}
        />
        {overlaySize.w > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            width={overlaySize.w}
            height={overlaySize.h}
            viewBox={`0 0 ${overlaySize.w} ${overlaySize.h}`}
            aria-hidden
          >
            {linkPaths.map(({ link, y, d, midX }) => (
              <g key={link.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={kindColor(link.kind)}
                  strokeWidth={2}
                  opacity={0.7}
                />
                <text
                  x={midX}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={kindColor(link.kind)}
                >
                  {link.kind}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      {!readonly && leftSel && rightSel && (
        <div className="mt-4 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => tryLink(k)}
              className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
              style={{ background: kindColor(k) }}
            >
              {k}으로 연결
            </button>
          ))}
          <button
            type="button"
            className="text-[12px] text-[#8A847E]"
            onClick={() => {
              setLeftSel('')
              setRightSel('')
              setPendingKind(null)
            }}
          >
            선택 취소
          </button>
        </div>
      )}
      {pendingKind && null}

      <ul className="mt-5 space-y-3">
        {data.links.map((l) => (
          <li
            key={l.id}
            className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
            style={{ boxShadow: cardShadow }}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                style={{ background: kindColor(l.kind) }}
              >
                {l.kind}
              </span>
              {!readonly && (
                <button
                  type="button"
                  className="text-[12px] text-[#8A847E]"
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      links: d.links.filter((x) => x.id !== l.id),
                    }))
                  }
                >
                  삭제
                </button>
              )}
            </div>
            <p className="mt-2 text-[13px] text-[#5A5550]">“{l.leftText}”</p>
            <p className="mt-1 text-[13px] text-[#5A5550]">“{l.rightText}”</p>
            {l.kind === '충돌' && (
              <input
                type="text"
                disabled={readonly}
                value={l.action ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setData((d) => ({
                    ...d,
                    links: d.links.map((x) =>
                      x.id === l.id ? { ...x, action: v } : x,
                    ),
                  }))
                }}
                placeholder="그래서 뭘 할 건가"
                className="mt-3 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
              />
            )}
          </li>
        ))}
      </ul>
    </ExerciseChrome>
  )
}

function Side({
  title,
  body,
  selection,
  onSelect,
  readonly,
}: {
  title: string
  body: string
  selection: string
  onSelect: (s: string) => void
  readonly: boolean
}) {
  return (
    <div
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
      style={{ boxShadow: cardShadow }}
    >
      <h3 className="mb-2 text-[13px] font-semibold" style={{ color: COMPASS.ink }}>
        {title}
      </h3>
      <div
        className="max-h-72 overflow-y-auto whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-[#1C1B1A]"
        onMouseUp={() => {
          if (readonly) return
          const sel = window.getSelection()?.toString().trim()
          if (sel) onSelect(sel)
        }}
      >
        {body || '내용 없음'}
      </div>
      {selection && (
        <p className="mt-2 rounded-lg bg-[#FAF8F6] px-2 py-1 text-[12px] text-[#8A847E]">
          선택: “{selection.slice(0, 80)}
          {selection.length > 80 ? '…' : ''}”
        </p>
      )}
    </div>
  )
}
