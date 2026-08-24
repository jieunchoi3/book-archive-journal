import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  COMPASS,
  emptyFailureData,
  newId,
  type FailureData,
  type FailureKind,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassFailureProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
}

const KINDS: FailureKind[] = ['실수', '약점', '성장통']

export function CompassFailure({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
}: CompassFailureProps) {
  const { all, completes, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'failure',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<FailureData>(emptyFailureData())
  const [lockedMsg, setLockedMsg] = useState(false)

  useEffect(() => {
    if (!active) {
      setData(emptyFailureData())
      return
    }
    setData(compass.getDraftData(active, emptyFailureData()))
    setLockedMsg(false)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: FailureData) => {
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

  const counts = useMemo(() => {
    const c: Record<FailureKind, number> = { 실수: 0, 약점: 0, 성장통: 0 }
    for (const r of data.rows) {
      if (r.kind) c[r.kind]++
    }
    return c
  }, [data.rows])

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  const colors: Record<FailureKind, string> = {
    실수: '#B4635A',
    약점: '#C08A4A',
    성장통: COMPASS.accent,
  }

  const migrationNote = useMemo(() => {
    if (active?.status !== 'complete') return null
    const idx = completes.findIndex((s) => s.id === active.id)
    if (idx <= 0) return null
    const prev = completes[idx - 1].data as unknown as FailureData
    if (!prev?.rows) return null
    const moved: string[] = []
    for (const row of data.rows) {
      const old = prev.rows.find((r) => r.event === row.event)
      if (old?.kind && row.kind && old.kind !== row.kind) {
        moved.push(`「${row.event}」 ${old.kind} → ${row.kind}`)
      }
    }
    return moved.length
      ? `${Math.round((Date.now() - Date.parse(completes[idx - 1].takenAt)) / 86400000 / 30)}개월 전엔 다르게 분류했던 게 있어요: ${moved.join(', ')}`
      : null
  }, [active, completes, data.rows])

  let dash = 0
  const segments = KINDS.map((k) => {
    const pct = (counts[k] / total) * 100
    const start = dash
    dash += pct
    return { k, pct, start }
  })

  return (
    <ExerciseChrome
      exerciseKey="failure"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help="있었던 일을 실수·약점·성장통으로 나눠 정리해요."
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
    >
      {migrationNote && (
        <p className="mb-4 rounded-2xl bg-[#FAF8F6] px-4 py-3 text-[13px] text-[#8A847E]">
          {migrationNote}
        </p>
      )}

      <div
        className="overflow-x-auto rounded-[18px] border border-[#ECE7E2] bg-white"
        style={{ boxShadow: cardShadow }}
      >
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#ECE7E2] text-[11px] text-[#8A847E]">
              <th className="px-3 py-2 font-semibold">있었던 일</th>
              <th className="px-3 py-2 font-semibold">이건 뭐였나</th>
              <th className="px-3 py-2 font-semibold">남은 것</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-b border-[#F0EBE6]">
                <td className="px-3 py-2">
                  <input
                    disabled={readonly}
                    value={r.event}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        rows: d.rows.map((x) =>
                          x.id === r.id ? { ...x, event: e.target.value } : x,
                        ),
                      }))
                    }
                    className="w-full bg-transparent focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        disabled={readonly}
                        onClick={() => {
                          if (readonly) {
                            setLockedMsg(true)
                            return
                          }
                          setData((d) => ({
                            ...d,
                            rows: d.rows.map((x) =>
                              x.id === r.id ? { ...x, kind: k } : x,
                            ),
                          }))
                        }}
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={
                          r.kind === k
                            ? { background: colors[k], color: '#fff' }
                            : { background: '#FAF8F6', color: '#8A847E' }
                        }
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    disabled={readonly}
                    value={r.leftover}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        rows: d.rows.map((x) =>
                          x.id === r.id ? { ...x, leftover: e.target.value } : x,
                        ),
                      }))
                    }
                    className="w-full bg-transparent focus:outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!readonly && (
          <button
            type="button"
            className="w-full py-2 text-[13px] font-semibold"
            style={{ color: COMPASS.accent }}
            onClick={() =>
              setData((d) => ({
                ...d,
                rows: [
                  ...d.rows,
                  { id: newId(), event: '', kind: null, leftover: '' },
                ],
              }))
            }
          >
            + 행 추가
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center gap-6">
        <svg width={120} height={120} viewBox="0 0 42 42" className="-rotate-90">
          <circle cx="21" cy="21" r="15.5" fill="none" stroke="#FAF8F6" strokeWidth="5" />
          {segments.map((s) => (
            <circle
              key={s.k}
              cx="21"
              cy="21"
              r="15.5"
              fill="none"
              stroke={colors[s.k]}
              strokeWidth="5"
              strokeDasharray={`${s.pct} ${100 - s.pct}`}
              strokeDashoffset={-s.start}
            />
          ))}
        </svg>
        <ul className="space-y-1 text-[13px]">
          {KINDS.map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[k] }} />
              {k} {counts[k]}
            </li>
          ))}
        </ul>
      </div>
    </ExerciseChrome>
  )
}
