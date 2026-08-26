import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  COMPASS,
  ODYSSEY_GAUGE_META,
  ODYSSEY_PLAN_KEYS,
  ODYSSEY_PLAN_META,
  ODYSSEY_YEAR_KEYS,
  countEojeol,
  emptyOdysseyData,
  mindmapRoleIdeasFromData,
  normalizeCoherenceData,
  normalizeMindmapData,
  normalizeOdysseyData,
  odysseyChipCount,
  odysseyLifeChipCount,
  odysseyYearLabel,
  type MindmapRoleIdea,
  type OdysseyData,
  type OdysseyPlan,
  type OdysseyStep,
  type OdysseyYearKey,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  cardShadow,
  useDebouncedDraftSave,
  useExerciseSnapshot,
} from './CompassExerciseShell'
import { NapkinSketch } from './NapkinSketch'
import { odysseyGuideStep } from '../compass/guides'

interface CompassOdysseyProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
  onOpenCoherence?: () => void
  onOpenMindmap?: () => void
}

const HELP = `앞으로 5년을 세 가지 버전으로 그리는 거야.

① 지금 가는 길 — 지금 삶이 이어지거나, 오래 품고만 있던 그 아이디어
② 그게 사라지면 — ①이 갑자기 불가능해지면
③ 돈도 남 눈도 상관없다면

셋 다 진짜 괜찮은 삶이어야 해. 하나를 고르는 연습이 아니야.
5년 뒤를 맞히는 것도 아니고. 세 개를 그려봐야 지금 안 보이던 게 보여.

각 플랜에 일 쪽 일정이랑 삶 쪽 일정(결혼, 이사, 여행, 배우고 싶은 거)을 같이 넣고,
6어절 제목을 붙이고, 이렇게 살면 뭘 알게 될지 2~3개 적고, 게이지 4개를 매겨.

다 하면 누군가한테 소리 내서 말해봐. 말하다 보면 어느 게 진짜 끌리는지 티가 나.
보통 6개월~1년마다 다시 해.`

const WORRY_RE = /할까\s*봐|못하면|부족|리스크|위험|걱정|불안/

const STEP_RAIL: { step: OdysseyStep; label: string }[] = [
  { step: 'plan0', label: '① 지금 길' },
  { step: 'plan1', label: '② 사라지면' },
  { step: 'plan2', label: '③ 상관없다면' },
  { step: 'side', label: '④ 나란히' },
  { step: 'present', label: '⑤ 말해보기' },
]

function planIndexFromStep(step: OdysseyStep): 0 | 1 | 2 | null {
  if (step === 'plan0') return 0
  if (step === 'plan1') return 1
  if (step === 'plan2') return 2
  return null
}

function cellId(row: 'work' | 'life', year: OdysseyYearKey) {
  return `${row}:${year}`
}

function parseCellId(id: string): { row: 'work' | 'life'; year: OdysseyYearKey } | null {
  const [row, year] = id.split(':')
  if ((row === 'work' || row === 'life') && ODYSSEY_YEAR_KEYS.includes(year as OdysseyYearKey)) {
    return { row, year: year as OdysseyYearKey }
  }
  return null
}

export function CompassOdyssey({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
  onOpenCoherence,
}: CompassOdysseyProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'odyssey',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<OdysseyData>(emptyOdysseyData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [fillPresentAfterSkip, setFillPresentAfterSkip] = useState(false)
  const [roleModal, setRoleModal] = useState(false)
  const [compassOpen, setCompassOpen] = useState(false)
  const [adding, setAdding] = useState<{
    row: 'work' | 'life'
    year: OdysseyYearKey
  } | null>(null)
  const [addText, setAddText] = useState('')

  const mindmapIdeas = useMemo(() => {
    const mm = compass.completeSnapshotsFor('mindmap').at(-1)
    if (!mm) return [] as MindmapRoleIdea[]
    const d = normalizeMindmapData(mm.data)
    return d.roleIdeas.length ? d.roleIdeas : mindmapRoleIdeasFromData(d)
  }, [compass])

  const coherenceSnap = compass.completeSnapshotsFor('coherence').at(-1)
  const coherence = coherenceSnap
    ? normalizeCoherenceData(coherenceSnap.data)
    : null

  const teamNames = useMemo(() => {
    const team = compass.completeSnapshotsFor('team').at(-1)
    const people =
      (team?.data as { people?: { name?: string }[] } | undefined)?.people ?? []
    return people.map((p) => p.name?.trim()).filter(Boolean) as string[]
  }, [compass])

  useEffect(() => {
    if (!active) {
      setData(emptyOdysseyData())
      return
    }
    let next = normalizeOdysseyData(
      compass.getDraftData(active, emptyOdysseyData()),
    )
    if (!next.compass_ref && coherenceSnap) {
      next = { ...next, compass_ref: coherenceSnap.id }
    }
    if (readonly && next.presented.skipped) {
      next = { ...next, step: 'present' }
      setFillPresentAfterSkip(true)
    } else if (readonly && next.step === 'prep') {
      next = { ...next, step: 'side' }
      setFillPresentAfterSkip(false)
    } else {
      setFillPresentAfterSkip(false)
    }
    setData(next)
    setLockedMsg(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot switch only
  }, [active?.id, readonly])

  const presentOnlyEdit = Boolean(
    active && active.status === 'complete' && fillPresentAfterSkip,
  )
  const editLocked = readonly && !presentOnlyEdit

  const save = useCallback(
    async (id: string, next: OdysseyData) => {
      if (active?.status === 'complete') {
        await compass.updateSnapshotData(
          id,
          next as unknown as Record<string, unknown>,
        )
      } else {
        await compass.updateDraftData(
          id,
          next as unknown as Record<string, unknown>,
        )
      }
    },
    [compass, active?.status],
  )
  const { savedAt, error } = useDebouncedDraftSave(
    active,
    data,
    save,
    Boolean(active && (!readonly || presentOnlyEdit)),
  )

  const patch = (p: Partial<OdysseyData>) => {
    if (editLocked) {
      setLockedMsg(true)
      return
    }
    if (presentOnlyEdit) {
      const allowed: Partial<OdysseyData> = {}
      if ('presented' in p) allowed.presented = p.presented
      if ('step' in p) allowed.step = p.step
      setData((d) => ({ ...d, ...allowed }))
      return
    }
    setData((d) => ({ ...d, ...p }))
  }

  const updatePlan = (index: number, updater: (p: OdysseyPlan) => OdysseyPlan) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => {
      const plans = [...d.plans] as OdysseyData['plans']
      plans[index] = updater(plans[index])
      return { ...d, plans }
    })
  }

  const planIdx = planIndexFromStep(data.step)
  const currentPlan = planIdx !== null ? data.plans[planIdx] : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    if (planIdx === null || readonly) return
    const from = String(e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (!over) return
    // chip id: work:1:0
    const parts = from.split(':')
    if (parts.length < 3) return
    const fromRow = parts[0] as 'work' | 'life'
    const fromYear = parts[1] as OdysseyYearKey
    const fromIndex = Number(parts[2])
    const to = parseCellId(over)
    if (!to) return
    updatePlan(planIdx, (p) => {
      const chip = p.timeline[fromRow][fromYear][fromIndex]
      if (!chip) return p
      const nextWork = { ...p.timeline.work }
      const nextLife = { ...p.timeline.life }
      const src = [...(fromRow === 'work' ? nextWork : nextLife)[fromYear]]
      src.splice(fromIndex, 1)
      ;(fromRow === 'work' ? nextWork : nextLife)[fromYear] = src
      const dest = [
        ...((to.row === 'work' ? nextWork : nextLife)[to.year]),
        chip,
      ]
      ;(to.row === 'work' ? nextWork : nextLife)[to.year] = dest
      return { ...p, timeline: { work: nextWork, life: nextLife } }
    })
  }

  const addChip = (row: 'work' | 'life', year: OdysseyYearKey, label: string) => {
    if (planIdx === null) return
    const t = label.trim()
    if (!t) return
    updatePlan(planIdx, (p) => ({
      ...p,
      timeline: {
        ...p.timeline,
        [row]: {
          ...p.timeline[row],
          [year]: [...p.timeline[row][year], t],
        },
      },
    }))
    setAdding(null)
    setAddText('')
  }

  const removeChip = (
    row: 'work' | 'life',
    year: OdysseyYearKey,
    index: number,
  ) => {
    if (planIdx === null) return
    updatePlan(planIdx, (p) => {
      const list = [...p.timeline[row][year]]
      list.splice(index, 1)
      return {
        ...p,
        timeline: {
          ...p.timeline,
          [row]: { ...p.timeline[row], [year]: list },
        },
      }
    })
  }

  const applyRole = (idea: MindmapRoleIdea) => {
    if (planIdx === null) return
    updatePlan(planIdx, (p) => ({
      ...p,
      title: p.title.trim() ? p.title : idea.title,
      from_role: idea.title,
      timeline: {
        ...p.timeline,
        work: {
          ...p.timeline.work,
          '1': idea.daySketch.trim()
            ? [...p.timeline.work['1'], idea.daySketch.trim()]
            : p.timeline.work['1'],
        },
      },
    }))
    setRoleModal(false)
  }

  const gaugesReady = (p: OdysseyPlan) =>
    ODYSSEY_GAUGE_META.every((g) => p.gauges[g.key] !== null)

  const planReady = (p: OdysseyPlan) =>
    odysseyChipCount(p) >= 4 &&
    p.title.trim().length > 0 &&
    p.questions[0].trim().length > 0 &&
    p.questions[1].trim().length > 0 &&
    gaugesReady(p)

  const goNextFromPlan = () => {
    if (planIdx === null || !currentPlan || !planReady(currentPlan)) return
    if (planIdx < 2) patch({ step: (`plan${planIdx + 1}` as OdysseyStep) })
    else patch({ step: 'side' })
  }

  const softHint =
    !mindmapIdeas.length && !coherence
      ? '마인드맵이랑 두 관점을 먼저 하면 재료가 생겨서 훨씬 쉬워. 그냥 해도 되고.'
      : null

  return (
    <ExerciseChrome
      exerciseKey="odyssey"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help={HELP}
      helpCadence="보통 6개월~1년마다 다시 해"
      guideStep={odysseyGuideStep(data.step)}
      lockedMsg={lockedMsg}
      onDismissLock={() => setLockedMsg(false)}
      hideComplete={data.step !== 'present'}
      completeDisabled={false}
      onComplete={() => {
        if (!active) return
        void (async () => {
          await compass.updateDraftData(
            active.id,
            data as unknown as Record<string, unknown>,
          )
          await compass.completeSnapshot(active.id)
        })()
      }}
      completeLabel="완료하기"
    >
      {data.step !== 'prep' && (
        <StepRail
          step={data.step}
          onJump={(s) => {
            if (readonly) patch({ step: s })
            else patch({ step: s })
          }}
        />
      )}

      {softHint && data.step === 'prep' && (
        <p className="mb-4 text-[13px] text-[#8A847E]">{softHint}</p>
      )}

      {data.step === 'prep' && (
        <PrepPanel
          ideas={mindmapIdeas}
          onStart={() => patch({ step: 'plan0' })}
          readonly={readonly}
        />
      )}

      {planIdx !== null && currentPlan && (
        <PlanEditor
          index={planIdx}
          plan={currentPlan}
          readonly={readonly}
          sensors={sensors}
          onDragEnd={onDragEnd}
          adding={adding}
          setAdding={setAdding}
          addText={addText}
          setAddText={setAddText}
          addChip={addChip}
          removeChip={removeChip}
          updatePlan={(u) => updatePlan(planIdx, u)}
          coherence={coherence}
          compassOpen={compassOpen}
          setCompassOpen={setCompassOpen}
          onOpenCoherence={onOpenCoherence}
          mindmapIdeas={mindmapIdeas}
          roleModal={roleModal}
          setRoleModal={setRoleModal}
          applyRole={applyRole}
          canNext={planReady(currentPlan)}
          onNext={goNextFromPlan}
        />
      )}

      {data.step === 'side' && (
        <SideBySide
          data={data}
          readonly={readonly}
          onDifferent={(v) => patch({ different_enough: v })}
          onRedo={() => patch({ step: 'plan2' })}
          onNext={() => patch({ step: 'present' })}
        />
      )}

      {data.step === 'present' && (
        <PresentPanel
          data={data}
          readonly={editLocked}
          teamNames={teamNames}
          onChange={(presented) => patch({ presented })}
          onSkip={() =>
            patch({
              presented: { ...data.presented, skipped: true },
            })
          }
        />
      )}
    </ExerciseChrome>
  )
}

function StepRail({
  step,
  onJump,
}: {
  step: OdysseyStep
  onJump: (s: OdysseyStep) => void
}) {
  const order = STEP_RAIL.map((s) => s.step)
  const cur = order.indexOf(step)
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1 overflow-x-auto text-[12px]">
      {STEP_RAIL.map((s, i) => {
        const done = cur > i || (step === 'present' && i <= 4)
        const current = s.step === step
        return (
          <div key={s.step} className="flex items-center gap-1">
            {i > 0 && <span className="text-[#ECE7E2]">──</span>}
            <button
              type="button"
              onClick={() => onJump(s.step)}
              className="whitespace-nowrap rounded-full px-2 py-1 font-medium"
              style={{
                color: current || done ? COMPASS.ink : '#B5AFA8',
                background: current ? COMPASS.soft : 'transparent',
              }}
            >
              {s.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function PrepPanel({
  ideas,
  onStart,
  readonly,
}: {
  ideas: MindmapRoleIdea[]
  onStart: () => void
  readonly: boolean
}) {
  return (
    <div
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 sm:p-8"
      style={{ boxShadow: cardShadow }}
    >
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1C1B1A]">
        {`앞으로 5년을 세 가지 버전으로 그려볼 거야.
셋 다 진짜 괜찮은 삶이어야 해. 하나를 고르는 게 아니라, 셋 다 만들어보는 거야.

① 지금 가는 길
   지금 삶이 그대로 이어지면. 아니면 계속 마음에 품고만 있던 그 아이디어.

② 그게 사라지면
   ①이 갑자기 불가능해지면. 회사가 없어지거나, 그 길이 막히거나.
   그럼 뭘 할 거야?

③ 돈도 남 눈도 상관없다면
   돈이 문제가 안 되고, 아무도 뭐라고 안 하면.

지금 정하는 거 아니야. 5년 뒤를 맞히는 것도 아니고.
세 개를 그려보면 지금 안 보이던 게 보여.`}
      </p>
      {ideas.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[13px] text-[#8A847E]">
            마인드맵에서 나온 것:
          </p>
          <div className="flex flex-wrap gap-2">
            {ideas.map((idea) => (
              <span
                key={idea.id}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium"
                style={{ background: COMPASS.soft, color: COMPASS.ink }}
              >
                {idea.title}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[#B5AFA8]">
            플랜 만들 때 여기서 가져다 쓸 수 있어.
          </p>
        </div>
      )}
      {!readonly && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onStart}
            className="h-12 rounded-full px-7 text-[14px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
          >
            시작하기
          </button>
        </div>
      )}
    </div>
  )
}

function PlanEditor({
  index,
  plan,
  readonly,
  sensors,
  onDragEnd,
  adding,
  setAdding,
  addText,
  setAddText,
  addChip,
  removeChip,
  updatePlan,
  coherence,
  compassOpen,
  setCompassOpen,
  onOpenCoherence,
  mindmapIdeas,
  roleModal,
  setRoleModal,
  applyRole,
  canNext,
  onNext,
}: {
  index: number
  plan: OdysseyPlan
  readonly: boolean
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (e: DragEndEvent) => void
  adding: { row: 'work' | 'life'; year: OdysseyYearKey } | null
  setAdding: (v: { row: 'work' | 'life'; year: OdysseyYearKey } | null) => void
  addText: string
  setAddText: (v: string) => void
  addChip: (row: 'work' | 'life', year: OdysseyYearKey, label: string) => void
  removeChip: (row: 'work' | 'life', year: OdysseyYearKey, index: number) => void
  updatePlan: (u: (p: OdysseyPlan) => OdysseyPlan) => void
  coherence: ReturnType<typeof normalizeCoherenceData> | null
  compassOpen: boolean
  setCompassOpen: (v: boolean) => void
  onOpenCoherence?: () => void
  mindmapIdeas: MindmapRoleIdea[]
  roleModal: boolean
  setRoleModal: (v: boolean) => void
  applyRole: (idea: MindmapRoleIdea) => void
  canNext: boolean
  onNext: () => void
}) {
  const key = ODYSSEY_PLAN_KEYS[index]
  const meta = ODYSSEY_PLAN_META[key]
  const chips = odysseyChipCount(plan)
  const lifeChips = odysseyLifeChipCount(plan)
  const titleUnlocked = chips >= 4
  const eojeol = countEojeol(plan.title)

  return (
    <div
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-5 sm:p-7"
      style={{ boxShadow: cardShadow }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-[#8A847E]">
            플랜 {index + 1} / 3
          </p>
          <h2 className="text-[20px] font-bold text-[#1C1B1A]">{meta.label}</h2>
          <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-[#8A847E]">
            {meta.blurb}
          </p>
        </div>
        {mindmapIdeas.length > 0 && !readonly && (
          <button
            type="button"
            className="text-[13px] font-semibold"
            style={{ color: COMPASS.accent }}
            onClick={() => setRoleModal(true)}
          >
            마인드맵에서 가져오기
          </button>
        )}
      </div>

      {/* Timeline */}
      <section className="mb-8">
        <h3 className="mb-3 text-[14px] font-semibold text-[#1C1B1A]">
          5년 타임라인
        </h3>
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="w-12 p-2" />
                  {ODYSSEY_YEAR_KEYS.map((y, i) => (
                    <th
                      key={y}
                      className="border border-[#ECE7E2] p-2 text-center font-semibold text-[#8A847E]"
                    >
                      {odysseyYearLabel(i + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['work', 'life'] as const).map((row) => (
                  <tr key={row}>
                    <td className="border border-[#ECE7E2] p-2 text-center font-semibold text-[#8A847E]">
                      {row === 'work' ? '일' : '삶'}
                    </td>
                    {ODYSSEY_YEAR_KEYS.map((year) => (
                      <TimelineCell
                        key={year}
                        row={row}
                        year={year}
                        chips={plan.timeline[row][year]}
                        readonly={readonly}
                        adding={
                          adding?.row === row && adding.year === year
                        }
                        addText={addText}
                        setAddText={setAddText}
                        onStartAdd={() => {
                          setAdding({ row, year })
                          setAddText('')
                        }}
                        onCommitAdd={() => addChip(row, year, addText)}
                        onRemove={(i) => removeChip(row, year, i)}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DndContext>
        <p className="mt-2 text-[12px] text-[#B5AFA8]">
          일 쪽만 채우지 마. 결혼, 이사, 여행, 배우고 싶은 것도.
        </p>
        {lifeChips === 0 && chips > 0 && (
          <p className="mt-1 text-[13px] text-[#8A847E]">
            삶 쪽도 한두 개는 있어야 진짜 5년이 돼.
          </p>
        )}
      </section>

      {/* Title */}
      <section className="mb-8">
        <h3 className="mb-2 text-[14px] font-semibold text-[#1C1B1A]">
          이 플랜에 6어절 제목을 붙이면?
        </h3>
        <div className="flex items-center gap-2">
          <input
            disabled={readonly || !titleUnlocked}
            value={plan.title}
            onChange={(e) =>
              updatePlan((p) => ({ ...p, title: e.target.value }))
            }
            placeholder="한 줄로 말하면 이건 어떤 삶이야?"
            className="min-w-0 flex-1 rounded-xl border border-[#ECE7E2] px-3 py-2.5 text-[15px] disabled:bg-[#FAF8F6] disabled:text-[#B5AFA8]"
          />
          <span
            className="shrink-0 tabular-nums text-[13px]"
            style={{ color: eojeol > 6 ? '#C08A4A' : '#8A847E' }}
          >
            {eojeol}/6
          </span>
        </div>
        {!titleUnlocked && (
          <p className="mt-1 text-[12px] text-[#B5AFA8]">
            타임라인 다 채운 뒤에 활성화 (칩 4개 이상)
          </p>
        )}
      </section>

      {/* Questions */}
      <section className="mb-8">
        <h3 className="mb-2 text-[14px] font-semibold text-[#1C1B1A]">
          이렇게 5년 살면 뭘 알게 될까? (2~3개)
        </h3>
        {[0, 1, 2].map((i) => (
          <QuestionField
            key={i}
            index={i}
            value={plan.questions[i]}
            disabled={readonly}
            onChange={(v) =>
              updatePlan((p) => {
                const q = [...p.questions] as [string, string, string]
                q[i] = v
                return { ...p, questions: q }
              })
            }
          />
        ))}
        <p className="mt-2 text-[13px] leading-relaxed text-[#8A847E]">
          플랜의 문제점이나 걱정을 적는 칸이 아니야. 이렇게 살아봐야만 답이
          나오는 궁금증을 적어.
        </p>
      </section>

      {/* Gauges */}
      <section className="mb-8">
        <h3 className="mb-3 text-[14px] font-semibold text-[#1C1B1A]">게이지</h3>
        <div className="space-y-4">
          {ODYSSEY_GAUGE_META.map((g) => (
            <GaugeBar
              key={g.key}
              label={g.label}
              def={g.def}
              note={g.note}
              value={plan.gauges[g.key]}
              disabled={readonly}
              onChange={(v) =>
                updatePlan((p) => ({
                  ...p,
                  gauges: { ...p.gauges, [g.key]: v },
                }))
              }
            />
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-[#FAF8F6] px-3 py-2">
          <button
            type="button"
            className="text-[13px] font-semibold"
            style={{ color: COMPASS.accent }}
            onClick={() => setCompassOpen(!compassOpen)}
          >
            {coherence ? `내 나침반 보기 ${compassOpen ? '▾' : '▸'}` : null}
          </button>
          {!coherence && (
            <p className="text-[13px] text-[#8A847E]">
              두 관점 맞춰보기를 하면 여기서 바로 볼 수 있어.{' '}
              {onOpenCoherence && (
                <button
                  type="button"
                  className="font-semibold"
                  style={{ color: COMPASS.accent }}
                  onClick={onOpenCoherence}
                >
                  맞춰보기
                </button>
              )}
            </p>
          )}
          {coherence && compassOpen && (
            <div className="mt-2 space-y-2 text-[13px] text-[#1C1B1A]">
              <p>
                <span className="text-[#8A847E]">일 </span>
                {coherence.values_snapshot.work.join(' · ') || '—'}
              </p>
              <p>
                <span className="text-[#8A847E]">삶 </span>
                {coherence.values_snapshot.life.join(' · ') || '—'}
              </p>
              <p className="text-[#8A847E]">
                보완 · {coherence.answers.complement.slice(0, 80) || '—'}
              </p>
              <p className="text-[#8A847E]">
                충돌 · {coherence.answers.clash.slice(0, 80) || '—'}
              </p>
              <p className="text-[#8A847E]">
                이끌 · {coherence.answers.drives.slice(0, 80) || '—'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Sketch */}
      <section className="mb-6">
        <h3 className="mb-1 text-[14px] font-semibold text-[#1C1B1A]">
          그림 (선택)
        </h3>
        <p className="mb-2 text-[13px] text-[#8A847E]">
          이 삶의 한 장면을 그려봐. 그리면 다른 게 떠올라.
        </p>
        <NapkinSketch
          url={plan.sketch_url}
          kind={plan.sketch_kind}
          readonly={readonly}
          laterLabel="나중에"
          onChange={(sketch_url, sketch_kind) =>
            updatePlan((p) => ({ ...p, sketch_url, sketch_kind }))
          }
        />
      </section>

      {!readonly && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canNext}
            onClick={onNext}
            className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            {index < 2 ? '다음 플랜 →' : '나란히 보기 →'}
          </button>
        </div>
      )}

      {roleModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => setRoleModal(false)}
        >
          <div
            className="w-full max-w-md rounded-[18px] bg-white p-5"
            style={{ boxShadow: cardShadow }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-[16px] font-semibold">마인드맵 역할</h3>
            <ul className="space-y-2">
              {mindmapIdeas.map((idea) => (
                <li key={idea.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-[#ECE7E2] px-3 py-2.5 text-left"
                    onClick={() => applyRole(idea)}
                  >
                    <p className="font-semibold text-[#1C1B1A]">{idea.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-[#8A847E]">
                      {idea.daySketch}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineCell({
  row,
  year,
  chips,
  readonly,
  adding,
  addText,
  setAddText,
  onStartAdd,
  onCommitAdd,
  onRemove,
}: {
  row: 'work' | 'life'
  year: OdysseyYearKey
  chips: string[]
  readonly: boolean
  adding: boolean
  addText: string
  setAddText: (v: string) => void
  onStartAdd: () => void
  onCommitAdd: () => void
  onRemove: (i: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId(row, year) })
  const bg = row === 'work' ? COMPASS.soft : '#F4EFE7'
  return (
    <td
      ref={setNodeRef}
      className="border border-[#ECE7E2] p-2 align-top"
      style={{
        background: isOver ? `${COMPASS.accent}22` : undefined,
        minHeight: 72,
      }}
    >
      <div className="flex min-h-[64px] flex-col gap-1.5">
        {chips.map((c, i) => (
          <Chip
            key={`${c}-${i}`}
            id={`${row}:${year}:${i}`}
            label={c}
            bg={bg}
            readonly={readonly}
            onRemove={() => onRemove(i)}
          />
        ))}
        {adding && !readonly ? (
          <input
            autoFocus
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onBlur={onCommitAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onCommitAdd()
              }
            }}
            className="rounded-[10px] border border-[#ECE7E2] px-2 py-1.5 text-[13px]"
            placeholder="추가"
          />
        ) : (
          !readonly && (
            <button
              type="button"
              onClick={onStartAdd}
              className="rounded-[10px] px-2 py-1 text-left text-[12px] text-[#B5AFA8]"
            >
              +
            </button>
          )
        )}
      </div>
    </td>
  )
}

function Chip({
  id,
  label,
  bg,
  readonly,
  onRemove,
}: {
  id: string
  label: string
  bg: string
  readonly: boolean
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled: readonly })
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.7 : 1,
      }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: bg }}
      className="group flex items-start gap-1 rounded-[10px] px-3 py-2 text-[14px] text-[#1C1B1A]"
      {...listeners}
      {...attributes}
    >
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
      {!readonly && (
        <button
          type="button"
          className="hidden text-[11px] text-[#B5AFA8] group-hover:inline"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

function QuestionField({
  index,
  value,
  disabled,
  onChange,
}: {
  index: number
  value: string
  disabled?: boolean
  onChange: (v: string) => void
}) {
  const placeholders = [
    '"이렇게 살면 내가 ___인지 알게 될까?"',
    '"___가 진짜 나한테 맞는지 확인될까?"',
    '(하나 더 있으면)',
  ]
  const worry =
    value.trim() &&
    (WORRY_RE.test(value) || (!value.includes('?') && /할까|되면|안 되면/.test(value)))
  return (
    <div className="mb-2">
      <div className="flex items-start gap-2">
        <span className="mt-2.5 text-[13px] text-[#8A847E]">{index + 1}.</span>
        <input
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholders[index]}
          className="min-w-0 flex-1 rounded-xl border border-[#ECE7E2] px-3 py-2.5 text-[14px]"
        />
      </div>
      {worry && (
        <p className="ml-5 mt-1 text-[12px] text-[#8A847E]">
          이거 걱정에 가까운데, 궁금증으로 바꿔볼래?
        </p>
      )}
    </div>
  )
}

function GaugeBar({
  label,
  def,
  note,
  value,
  disabled,
  onChange,
}: {
  label: string
  def: string
  note?: string
  value: number | null
  disabled?: boolean
  onChange: (v: number) => void
}) {
  const pct = value ?? 0
  const setFromClientX = (
    el: HTMLDivElement,
    clientX: number,
  ) => {
    const r = el.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    onChange(Math.round(t * 100))
  }
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <span className="w-12 text-[13px] font-semibold text-[#1C1B1A]">
          {label}
        </span>
        <span className="w-8 text-[13px] tabular-nums text-[#8A847E]">
          {value === null ? '?' : value}
        </span>
        <span className="text-[13px] text-[#8A847E]">{def}</span>
      </div>
      {note && (
        <p className="mb-1 ml-[5.5rem] text-[12px] text-[#B5AFA8]">{note}</p>
      )}
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
        tabIndex={disabled ? -1 : 0}
        className="relative h-3 w-full max-w-md cursor-pointer rounded-md bg-[#FAF8F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        onPointerDown={(e) => {
          if (disabled) return
          setFromClientX(e.currentTarget, e.clientX)
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (disabled || !e.buttons) return
          setFromClientX(e.currentTarget, e.clientX)
        }}
        onKeyDown={(e) => {
          if (disabled) return
          const cur = value ?? 0
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault()
            onChange(Math.min(100, cur + (e.shiftKey ? 10 : 2)))
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(Math.max(0, cur - (e.shiftKey ? 10 : 2)))
          }
        }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-md"
          style={{
            width: value === null ? 0 : `${pct}%`,
            background: COMPASS.accent,
          }}
        />
      </div>
    </div>
  )
}

function SideBySide({
  data,
  readonly,
  onDifferent,
  onRedo,
  onNext,
}: {
  data: OdysseyData
  readonly: boolean
  onDifferent: (v: boolean) => void
  onRedo: () => void
  onNext: () => void
}) {
  return (
    <div>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
        {data.plans.map((p, i) => (
          <div
            key={p.key}
            className="w-[88vw] shrink-0 snap-center rounded-[18px] border border-[#ECE7E2] bg-white p-4 sm:w-auto lg:w-auto"
            style={{ boxShadow: cardShadow }}
          >
            {p.sketch_url ? (
              <img
                src={p.sketch_url}
                alt=""
                className="mb-3 h-28 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-[#FAF8F6] text-[12px] text-[#B5AFA8]">
                그림 없음
              </div>
            )}
            <p className="text-[12px] text-[#8A847E]">
              {['① 지금 길', '② 사라지면', '③ 상관없다면'][i]}
            </p>
            <p className="mt-1 text-[16px] font-bold text-[#1C1B1A]">
              {p.title || '—'}
            </p>
            <div className="mt-3 space-y-1.5">
              {ODYSSEY_GAUGE_META.map((g) => (
                <div key={g.key} className="flex items-center gap-2 text-[12px]">
                  <span className="w-10 text-[#8A847E]">{g.label}</span>
                  <div className="h-2 flex-1 rounded bg-[#FAF8F6]">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${p.gauges[g.key] ?? 0}%`,
                        background: COMPASS.accent,
                      }}
                    />
                  </div>
                  <span className="w-6 tabular-nums text-[#8A847E]">
                    {p.gauges[g.key] ?? '?'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] font-semibold text-[#8A847E]">
              알고 싶은 것
            </p>
            <ul className="mt-1 space-y-0.5 text-[13px] text-[#1C1B1A]">
              {p.questions.filter((q) => q.trim()).map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5 lg:hidden">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#D4CFC9]" />
        ))}
      </div>

      <GaugeGroupChart plans={data.plans} />

      <div className="mt-8">
        <p className="text-[15px] font-semibold text-[#1C1B1A]">
          세 개가 서로 충분히 달라?
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-[14px]">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="od-diff"
              disabled={readonly}
              checked={data.different_enough === true}
              onChange={() => onDifferent(true)}
            />
            응, 다른 삶이야
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="od-diff"
              disabled={readonly}
              checked={data.different_enough === false}
              onChange={() => onDifferent(false)}
            />
            비슷비슷해
          </label>
        </div>
        {data.different_enough === false && !readonly && (
          <div className="mt-3 rounded-xl bg-[#FAF8F6] px-4 py-3 text-[14px] text-[#8A847E]">
            <p>
              ② 아니면 ③이 아직 ①의 변형일 수 있어. 하나만 다시 해볼래?
            </p>
            <button
              type="button"
              className="mt-2 text-[13px] font-semibold"
              style={{ color: COMPASS.accent }}
              onClick={onRedo}
            >
              플랜 3 다시 하기
            </button>
          </div>
        )}
      </div>

      {!readonly && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={data.different_enough === null}
            onClick={onNext}
            className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            말해보기 →
          </button>
        </div>
      )}
    </div>
  )
}

function GaugeGroupChart({ plans }: { plans: OdysseyData['plans'] }) {
  const colors = [COMPASS.accent, '#C08A4A', '#5B4E73']
  return (
    <div
      className="mt-6 overflow-x-auto rounded-[18px] border border-[#ECE7E2] bg-white p-4"
      style={{ boxShadow: cardShadow }}
    >
      <p className="mb-3 text-[12px] font-semibold text-[#8A847E]">
        게이지 비교
      </p>
      <svg viewBox="0 0 420 160" className="h-40 w-full min-w-[320px]">
        {ODYSSEY_GAUGE_META.map((g, gi) => {
          const x0 = 40 + gi * 95
          return (
            <g key={g.key}>
              <text x={x0 + 30} y={150} textAnchor="middle" fontSize={11} fill="#8A847E">
                {g.label}
              </text>
              {plans.map((p, pi) => {
                const v = p.gauges[g.key] ?? 0
                const h = (v / 100) * 110
                const x = x0 + pi * 22
                return (
                  <rect
                    key={p.key}
                    x={x}
                    y={130 - h}
                    width={18}
                    height={h}
                    rx={3}
                    fill={colors[pi]}
                    opacity={0.85}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function PresentPanel({
  data,
  readonly,
  teamNames,
  onChange,
  onSkip,
}: {
  data: OdysseyData
  readonly: boolean
  teamNames: string[]
  onChange: (p: OdysseyData['presented']) => void
  onSkip: () => void
}) {
  const p = data.presented
  return (
    <div
      className="mx-auto max-w-xl rounded-[18px] border border-[#ECE7E2] bg-white p-6"
      style={{ boxShadow: cardShadow }}
    >
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1C1B1A]">
        {`세 개를 누군가한테 소리 내서 말해봐.
조언하거나 평가하는 사람 말고, 질문 잘하는 사람으로.

말하고 나서 적어줘:`}
      </p>

      <label className="mt-5 block text-[13px] font-semibold text-[#8A847E]">
        누구한테 말했어?
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          list="od-team-names"
          disabled={readonly}
          value={p.to}
          onChange={(e) => onChange({ ...p, to: e.target.value, skipped: false })}
          className="min-w-0 flex-1 rounded-xl border border-[#ECE7E2] px-3 py-2 text-[14px]"
        />
        <datalist id="od-team-names">
          {teamNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {!readonly && (
          <button
            type="button"
            className="text-[13px] text-[#8A847E]"
            onClick={onSkip}
          >
            아직 안 했어
          </button>
        )}
      </div>
      {p.skipped && (
        <p className="mt-1 text-[12px] text-[#B5AFA8]">건너뛴 상태로 완료할 수 있어.</p>
      )}

      <p className="mt-5 text-[13px] font-semibold text-[#8A847E]">
        말하면서 어느 게 제일 신났어?
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-[14px]">
        {(
          [
            ['plan1', '①'],
            ['plan2', '②'],
            ['plan3', '③'],
            ['unsure', '잘 모르겠어'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="alive"
              disabled={readonly}
              checked={p.most_alive === k}
              onChange={() =>
                onChange({ ...p, most_alive: k, skipped: false })
              }
            />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-5 block text-[13px] font-semibold text-[#8A847E]">
        그 사람이 뭘 물어봤어?
      </label>
      <textarea
        disabled={readonly}
        value={p.their_questions}
        onChange={(e) =>
          onChange({ ...p, their_questions: e.target.value, skipped: false })
        }
        className="mt-1 min-h-[80px] w-full resize-none rounded-xl border border-[#ECE7E2] px-3 py-2 text-[14px]"
      />

      <label className="mt-4 block text-[13px] font-semibold text-[#8A847E]">
        말하다가 네가 새로 알아챈 거 있어?
      </label>
      <textarea
        disabled={readonly}
        value={p.my_notice}
        onChange={(e) =>
          onChange({ ...p, my_notice: e.target.value, skipped: false })
        }
        className="mt-1 min-h-[80px] w-full resize-none rounded-xl border border-[#ECE7E2] px-3 py-2 text-[14px]"
      />
    </div>
  )
}
