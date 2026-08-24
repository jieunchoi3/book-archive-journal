import { useCallback, useEffect, useState } from 'react'
import {
  COMPASS,
  emptyChoosingData,
  newId,
  type ChoosingData,
  type ChoosingOption,
  type MindmapData,
  type OdysseyData,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassChoosingProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
}

const STEPS = ['모으기', '좁히기', '고르기', '놓아주기'] as const

export function CompassChoosing({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
}: CompassChoosingProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'choosing',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<ChoosingData>(emptyChoosingData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [newOpt, setNewOpt] = useState('')

  useEffect(() => {
    if (!active) {
      setData(emptyChoosingData())
      return
    }
    setData(compass.getDraftData(active, emptyChoosingData()))
    setLockedMsg(false)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: ChoosingData) => {
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

  const addOption = (label: string, source?: string) => {
    if (readonly || !label.trim()) return
    const opt: ChoosingOption = { id: newId(), label: label.trim(), source }
    setData((d) => ({ ...d, options: [...d.options, opt] }))
  }

  const importFromOdyssey = () => {
    const od = compass.completeSnapshotsFor('odyssey').at(-1)
    const plans = (od?.data as unknown as OdysseyData | undefined)?.plans
    if (!plans) return
    for (const p of plans) {
      if (p.title.trim()) addOption(p.title, 'odyssey')
    }
  }

  const importRoleIdeas = () => {
    const mm = compass.completeSnapshotsFor('mindmap').at(-1)
    const ideas = (mm?.data as unknown as MindmapData | undefined)?.roleIdeas ?? []
    for (const r of ideas) {
      if (r.title.trim()) addOption(r.title, 'mindmap')
    }
  }

  const toggleNarrow = (id: string) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => {
      const has = d.narrowed.includes(id)
      if (has) return { ...d, narrowed: d.narrowed.filter((x) => x !== id) }
      if (d.narrowed.length >= 5) {
        return { ...d, narrowed: [...d.narrowed.slice(1), id] }
      }
      return { ...d, narrowed: [...d.narrowed, id] }
    })
  }

  const top5 = data.options.filter((o) => data.narrowed.includes(o.id)).slice(0, 5)
  const chosen = data.options.find((o) => o.id === data.chosenId)

  return (
    <ExerciseChrome
      exerciseKey="choosing"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help="옵션을 모으고 좁히고 하나 고른 뒤, 나머지는 놓아줘요."
      lockedMsg={lockedMsg}
      hideComplete={data.step < 3}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
      completeLabel="이 결정 닫기"
    >
      <div className="mb-5 inline-flex rounded-full bg-[#FAF8F6] p-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            disabled={readonly && i !== data.step}
            onClick={() => {
              if (readonly) {
                setLockedMsg(true)
                return
              }
              setData((d) => ({ ...d, step: i as 0 | 1 | 2 | 3 }))
            }}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={
              data.step === i
                ? { background: COMPASS.accent, color: '#fff' }
                : { color: '#8A847E' }
            }
          >
            {s}
          </button>
        ))}
      </div>

      {data.step === 0 && (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importFromOdyssey}
              className="rounded-full border border-[#ECE7E2] px-3 py-1.5 text-[12px]"
            >
              오디세이에서 불러오기
            </button>
            <button
              type="button"
              onClick={importRoleIdeas}
              className="rounded-full border border-[#ECE7E2] px-3 py-1.5 text-[12px]"
            >
              역할 아이디어에서
            </button>
          </div>
          <div className="mb-3 flex gap-2">
            <input
              value={newOpt}
              onChange={(e) => setNewOpt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addOption(newOpt)
                  setNewOpt('')
                }
              }}
              placeholder="옵션 추가"
              className="flex-1 rounded-xl border border-[#ECE7E2] bg-white px-3 py-2 text-[14px]"
            />
            <button
              type="button"
              onClick={() => {
                addOption(newOpt)
                setNewOpt('')
              }}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
            >
              추가
            </button>
          </div>
          <ul className="space-y-2">
            {data.options.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-[14px] border border-[#ECE7E2] bg-white px-3 py-2"
                style={{ boxShadow: cardShadow }}
              >
                <span className="text-[14px]">{o.label}</span>
                {!readonly && (
                  <button
                    type="button"
                    className="text-[12px] text-[#E0574A]"
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        options: d.options.filter((x) => x.id !== o.id),
                      }))
                    }
                  >
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!readonly && data.options.length > 0 && (
            <button
              type="button"
              className="mt-4 text-[13px] font-semibold"
              style={{ color: COMPASS.accent }}
              onClick={() => setData((d) => ({ ...d, step: 1 }))}
            >
              좁히기로 →
            </button>
          )}
        </div>
      )}

      {data.step === 1 && (
        <div>
          <p className="mb-3 text-[13px] text-[#8A847E]">상위 5개만 남기세요. 6개째는 밀려나요.</p>
          <div
            className="mb-4 min-h-[80px] rounded-[18px] border-2 border-dashed p-3"
            style={{ borderColor: COMPASS.line, background: COMPASS.soft }}
          >
            <p className="mb-2 text-[11px] font-semibold" style={{ color: COMPASS.ink }}>
              상위 존 ({data.narrowed.length}/5)
            </p>
            <div className="flex flex-wrap gap-2">
              {top5.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleNarrow(o.id)}
                  className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white"
                  style={{ background: COMPASS.accent }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.options
              .filter((o) => !data.narrowed.includes(o.id))
              .map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleNarrow(o.id)}
                  className="rounded-full border border-[#ECE7E2] bg-white px-3 py-1.5 text-[13px]"
                >
                  {o.label}
                </button>
              ))}
          </div>
          {!readonly && data.narrowed.length > 0 && (
            <button
              type="button"
              className="mt-4 text-[13px] font-semibold"
              style={{ color: COMPASS.accent }}
              onClick={() => setData((d) => ({ ...d, step: 2 }))}
            >
              고르기로 →
            </button>
          )}
        </div>
      )}

      {data.step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {top5.map((o) => (
            <div
              key={o.id}
              className="rounded-[18px] border-2 bg-white p-4"
              style={{
                borderColor: data.chosenId === o.id ? COMPASS.accent : '#ECE7E2',
                boxShadow: cardShadow,
              }}
            >
              <h3 className="text-[16px] font-semibold">{o.label}</h3>
              <input
                disabled={readonly}
                value={o.head ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    options: d.options.map((x) =>
                      x.id === o.id ? { ...x, head: e.target.value } : x,
                    ),
                  }))
                }
                placeholder="머리로는"
                className="mt-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
              />
              <input
                disabled={readonly}
                value={o.body ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    options: d.options.map((x) =>
                      x.id === o.id ? { ...x, body: e.target.value } : x,
                    ),
                  }))
                }
                placeholder="몸으로는"
                className="mt-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
              />
              {!readonly && (
                <button
                  type="button"
                  className="mt-3 text-[13px] font-semibold"
                  style={{ color: COMPASS.accent }}
                  onClick={() =>
                    setData((d) => ({ ...d, chosenId: o.id, step: 3 }))
                  }
                >
                  이것 고르기
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {data.step === 3 && (
        <div className="text-center">
          <p className="text-[22px] font-bold" style={{ color: COMPASS.ink }}>
            {chosen?.label ?? '선택한 것'}
          </p>
          <ul className="mx-auto mt-6 max-w-sm space-y-2 opacity-40 transition-opacity">
            {top5
              .filter((o) => o.id !== data.chosenId)
              .map((o) => (
                <li key={o.id} className="text-[14px] text-[#8A847E] line-through">
                  {o.label}
                </li>
              ))}
          </ul>
          <p className="mt-6 text-[14px] leading-relaxed text-[#8A847E]">
            이건 지금 안 고른 것이지, 영영 못 하는 게 아니에요.
          </p>
        </div>
      )}
    </ExerciseChrome>
  )
}
