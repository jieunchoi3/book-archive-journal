import { useCallback, useEffect, useState } from 'react'
import {
  COMPASS,
  emptyOdysseyData,
  newId,
  ODYSSEY_DEFAULT_BADGES,
  type OdysseyData,
  type OdysseyPlan,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassOdysseyProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onCreatePrototype?: (planId: string, title: string) => void
}

const GAUGE_KEYS = [
  { key: 'resources' as const, label: '자원' },
  { key: 'pull' as const, label: '끌림' },
  { key: 'confidence' as const, label: '자신감' },
  { key: 'coherence' as const, label: '내 관점과 맞나' },
]

export function CompassOdyssey({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onCreatePrototype,
}: CompassOdysseyProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'odyssey',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<OdysseyData>(emptyOdysseyData())
  const [lockedMsg, setLockedMsg] = useState(false)

  useEffect(() => {
    if (!active) {
      setData(emptyOdysseyData())
      return
    }
    const d = compass.getDraftData(active, emptyOdysseyData())
    if (!d.plans || d.plans.length !== 3) setData(emptyOdysseyData())
    else setData(d)
    setLockedMsg(false)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: OdysseyData) => {
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

  const updatePlan = (index: number, patch: Partial<OdysseyPlan>) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => {
      const plans = [...d.plans] as OdysseyData['plans']
      plans[index] = { ...plans[index], ...patch }
      return { plans }
    })
  }

  return (
    <ExerciseChrome
      exerciseKey="odyssey"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help="5년짜리 길 세 갈래를 나란히 그려요. 나중에 시점별로 비교할 수 있어요."
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
    >
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {data.plans.map((plan, pi) => (
          <div
            key={plan.id}
            className="w-[280px] shrink-0 snap-center rounded-[18px] border border-[#ECE7E2] bg-white p-4 sm:w-[300px]"
            style={{ boxShadow: cardShadow }}
          >
            <input
              disabled={readonly}
              value={plan.badge}
              onChange={(e) => updatePlan(pi, { badge: e.target.value })}
              className="mb-2 w-full rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: COMPASS.soft, color: COMPASS.ink }}
              placeholder={ODYSSEY_DEFAULT_BADGES[pi]}
            />
            <input
              disabled={readonly}
              value={plan.title}
              onChange={(e) => updatePlan(pi, { title: e.target.value })}
              placeholder="제목 (6단어 이내)"
              className="mb-4 w-full border-b border-[#ECE7E2] bg-transparent pb-1 text-[17px] font-semibold text-[#1C1B1A] focus:outline-none focus-visible:border-[#3E6B5E]"
            />

            <div className="relative mb-4 pl-4">
              <div
                className="absolute bottom-2 left-1.5 top-2 w-px"
                style={{ background: COMPASS.line }}
              />
              {[0, 1, 2, 3, 4].map((yi) => {
                const yearMs = plan.milestones.filter((m) => m.yearIndex === yi)
                return (
                  <div key={yi} className="relative mb-3">
                    <span
                      className="absolute -left-[11px] top-1 h-2.5 w-2.5 rounded-full"
                      style={{ background: COMPASS.accent }}
                    />
                    <p className="text-[11px] font-semibold text-[#8A847E]">
                      {yi + 1}년
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {yearMs.map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: COMPASS.soft, color: COMPASS.ink }}
                          draggable={!readonly}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/milestone', m.id)
                            e.dataTransfer.setData('text/plan', String(pi))
                          }}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          {m.label}
                          {!readonly && (
                            <button
                              type="button"
                              className="ml-1 opacity-50"
                              onClick={() =>
                                updatePlan(pi, {
                                  milestones: plan.milestones.filter((x) => x.id !== m.id),
                                })
                              }
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {!readonly && (
                        <button
                          type="button"
                          className="rounded-full border border-dashed border-[#ECE7E2] px-2 py-0.5 text-[11px] text-[#8A847E]"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            const mid = e.dataTransfer.getData('text/milestone')
                            const fromPlan = Number(e.dataTransfer.getData('text/plan'))
                            if (!mid || Number.isNaN(fromPlan)) return
                            setData((d) => {
                              const plans = d.plans.map((p) => ({
                                ...p,
                                milestones: [...p.milestones],
                              })) as OdysseyData['plans']
                              const src = plans[fromPlan]
                              const m = src.milestones.find((x) => x.id === mid)
                              if (!m) return d
                              plans[fromPlan] = {
                                ...src,
                                milestones: src.milestones.filter((x) => x.id !== mid),
                              }
                              plans[pi] = {
                                ...plans[pi],
                                milestones: [
                                  ...plans[pi].milestones,
                                  { ...m, yearIndex: yi },
                                ],
                              }
                              return { plans }
                            })
                          }}
                          onClick={() => {
                            const label = window.prompt('마일스톤')
                            if (!label?.trim()) return
                            updatePlan(pi, {
                              milestones: [
                                ...plan.milestones,
                                { id: newId(), yearIndex: yi, label: label.trim() },
                              ],
                            })
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mb-1 text-[11px] font-semibold tracking-wider text-[#8A847E]">
              미해결 질문
            </p>
            {[0, 1, 2].map((qi) => (
              <input
                key={qi}
                disabled={readonly}
                value={plan.questions[qi]}
                onChange={(e) => {
                  const qs = [...plan.questions] as [string, string, string]
                  qs[qi] = e.target.value
                  updatePlan(pi, { questions: qs })
                }}
                placeholder={`질문 ${qi + 1}`}
                className="mb-1.5 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-2.5 py-1.5 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
              />
            ))}

            <div className="mt-3 space-y-2">
              {GAUGE_KEYS.map((g) => (
                <label key={g.key} className="block">
                  <div className="mb-0.5 flex justify-between text-[11px] text-[#8A847E]">
                    <span>{g.label}</span>
                    <span>{plan.gauges[g.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    disabled={readonly}
                    value={plan.gauges[g.key]}
                    onChange={(e) =>
                      updatePlan(pi, {
                        gauges: {
                          ...plan.gauges,
                          [g.key]: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#3E6B5E]"
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              className="mt-4 w-full rounded-full border border-[#ECE7E2] py-2 text-[12px] font-semibold"
              style={{ color: COMPASS.accent }}
              onClick={() =>
                onCreatePrototype?.(
                  plan.id,
                  plan.title || plan.badge,
                )
              }
            >
              이 플랜을 테스트하려면?
            </button>
          </div>
        ))}
      </div>
    </ExerciseChrome>
  )
}
