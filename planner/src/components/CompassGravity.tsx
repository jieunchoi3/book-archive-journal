import { useCallback, useEffect, useState } from 'react'
import {
  COMPASS,
  emptyGravityData,
  newId,
  type GravityData,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassGravityProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
}

export function CompassGravity({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
}: CompassGravityProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'gravity',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<GravityData>(emptyGravityData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!active) {
      setData(emptyGravityData())
      return
    }
    setData(compass.getDraftData(active, emptyGravityData()))
    setLockedMsg(false)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: GravityData) => {
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

  const changeable = data.items.filter((i) => i.changeable)
  const gravity = data.items.filter((i) => !i.changeable)

  const updateItem = (id: string, patch: Partial<(typeof data.items)[0]>) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({
      ...d,
      items: d.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }))
  }

  return (
    <ExerciseChrome
      exerciseKey="gravity"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help="바꿀 수 있는 것과 안고 갈 중력 문제를 가려요."
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
    >
      {!readonly && (
        <div className="mb-4 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="문제 서술"
            className="flex-1 rounded-xl border border-[#ECE7E2] bg-white px-3 py-2 text-[14px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                setData((d) => ({
                  ...d,
                  items: [
                    ...d.items,
                    {
                      id: newId(),
                      problem: draft.trim(),
                      changeable: true,
                      note: '',
                    },
                  ],
                }))
                setDraft('')
              }
            }}
          />
          <button
            type="button"
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
            onClick={() => {
              if (!draft.trim()) return
              setData((d) => ({
                ...d,
                items: [
                  ...d.items,
                  {
                    id: newId(),
                    problem: draft.trim(),
                    changeable: true,
                    note: '',
                  },
                ],
              }))
              setDraft('')
            }}
          >
            추가
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-[13px] font-semibold" style={{ color: COMPASS.ink }}>
            바꿀 수 있는 것
          </h3>
          <ul className="space-y-2">
            {changeable.map((item) => (
              <li
                key={item.id}
                className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                style={{ boxShadow: cardShadow }}
              >
                <p className="text-[14px] font-medium">{item.problem}</p>
                <label className="mt-2 flex items-center gap-2 text-[12px] text-[#8A847E]">
                  <input
                    type="checkbox"
                    checked={item.changeable}
                    disabled={readonly}
                    onChange={(e) =>
                      updateItem(item.id, { changeable: e.target.checked })
                    }
                  />
                  이건 내가 바꿀 수 있나?
                </label>
                <input
                  disabled={readonly}
                  value={item.note}
                  onChange={(e) => updateItem(item.id, { note: e.target.value })}
                  placeholder="첫 행동 한 줄"
                  className="mt-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
                />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-[#8A847E]">중력 문제</h3>
          <ul className="space-y-2">
            {gravity.map((item) => (
              <li
                key={item.id}
                className="rounded-[18px] bg-[#FAF8F6] p-4 grayscale"
              >
                <p className="text-[14px] font-medium text-[#5A5550]">{item.problem}</p>
                <label className="mt-2 flex items-center gap-2 text-[12px] text-[#8A847E]">
                  <input
                    type="checkbox"
                    checked={item.changeable}
                    disabled={readonly}
                    onChange={(e) =>
                      updateItem(item.id, { changeable: e.target.checked })
                    }
                  />
                  이건 내가 바꿀 수 있나?
                </label>
                <input
                  disabled={readonly}
                  value={item.note}
                  onChange={(e) => updateItem(item.id, { note: e.target.value })}
                  placeholder="이걸 안고 어떻게 갈까"
                  className="mt-2 w-full rounded-xl border border-[#ECE7E2] bg-white/60 px-3 py-2 text-[13px]"
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ExerciseChrome>
  )
}
