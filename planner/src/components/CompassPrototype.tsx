import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FlaskConical, MessageCircle, Sparkles, X } from 'lucide-react'
import {
  COMPASS,
  ODYSSEY_PLAN_KEYS,
  ODYSSEY_PLAN_META,
  PROTOTYPE_DURATIONS,
  PROTOTYPE_REFERRAL_QUESTION,
  PROTOTYPE_STARTER_QUESTIONS,
  emptyPrepChecks,
  normalizeTeamData,
  todayKey,
  type LdProtoIdea,
  type LdProtoQuestion,
  type LdPrototype,
  type OdysseyPlanKey,
  type PrototypeAnswered,
  type PrototypeKind,
  type PrototypePrepChecks,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { cardShadow } from './CompassExerciseShell'
import { CompassBipolarSlider } from './CompassBipolarSlider'
import { CompassGuidePanel, GuideInlineHint } from './CompassGuidePanel'
import {
  getGuide,
  guideFoldSummary,
  prototypeGuideStep,
} from '../compass/guides'

const HELP = `머릿속으로 아무리 굴려도 답 안 나오는 건, 작게 해보면 금방 알아.

먼저 오디세이 플랜에서 쓴 질문들을 가져와.
그 질문에 답해줄 만한 걸 두 종류로 만든다:

· 대화 — 그거 하고 있는 사람 만나서 이야기 듣기
· 경험 — 짧게 직접 해보기

대화는 취업 면접이 아니야. 그 사람 이야기를 들으러 가는 거야.
어떻게 그렇게 됐는지, 하루가 실제로 어떤지, 뭐가 좋고 뭐가 싫은지.
내가 상대보다 말을 더 많이 하고 있으면 그건 인터뷰가 아니야.

커리어 얘기만도 아니야. 관계, 건강, 사는 방식 —
네 삶에 넣고 싶은 게 있는 사람이면 누구든 돼.

끝나면 뭘 알게 됐는지랑 새로 생긴 질문을 적어.
새 질문이 다음 프로토타입이 돼. 이건 끝나는 연습이 아니라 계속 도는 거야.`

type Tab = 'questions' | 'todo' | 'learned'
type Screen =
  | { kind: 'main' }
  | { kind: 'brainstorm'; questionId: string }
  | { kind: 'pick'; questionId: string }
  | { kind: 'prep'; prototypeId: string }
  | { kind: 'reflect'; prototypeId: string }

interface CompassPrototypeProps {
  compass: CompassActions
  initialPlanLink?: string | null
}

export function CompassPrototype({ compass }: CompassPrototypeProps) {
  const [tab, setTab] = useState<Tab>('questions')
  const [screen, setScreen] = useState<Screen>({ kind: 'main' })
  const [helpOpen, setHelpOpen] = useState(false)
  const [expandedQ, setExpandedQ] = useState<string | null>(null)
  const [manualDraft, setManualDraft] = useState('')
  const [droppedOpen, setDroppedOpen] = useState(false)
  const [learnedFilter, setLearnedFilter] = useState<
    'all' | 'conversation' | 'experience'
  >('all')
  const [learnedSort, setLearnedSort] = useState<'recent' | 'byQuestion'>(
    'recent',
  )

  const teamPeople = useMemo(() => {
    const snaps = compass.completeSnapshotsFor('team')
    const draft = compass.draftFor('team')
    const source = draft ?? snaps[snaps.length - 1]
    if (!source) return []
    return normalizeTeamData(source.data).people.filter((p) => p.name.trim())
  }, [compass])

  const qById = useMemo(() => {
    const m = new Map<string, LdProtoQuestion>()
    for (const q of compass.protoQuestions) m.set(q.id, q)
    return m
  }, [compass.protoQuestions])

  const protosForQ = useCallbackish(compass.prototypes)

  const openQuestions = compass.protoQuestions.filter((q) => q.isOpen).length
  const planned = compass.prototypes.filter((p) => p.status === 'planned').length
  const quarterStart = useMemo(() => {
    const d = new Date()
    const q = Math.floor(d.getMonth() / 3) * 3
    return new Date(d.getFullYear(), q, 1).getTime()
  }, [])
  const doneThisQuarter = compass.prototypes.filter(
    (p) =>
      p.status === 'done' &&
      Date.parse(p.happenedOn ?? p.createdAt) >= quarterStart,
  ).length

  const odysseyQs = compass.protoQuestions.filter((q) => q.origin === 'odyssey')
  const manualQs = compass.protoQuestions.filter((q) => q.origin !== 'odyssey')

  const odysseyByPlan = useMemo(() => {
    const groups: { key: OdysseyPlanKey; label: string; items: LdProtoQuestion[] }[] =
      ODYSSEY_PLAN_KEYS.map((key) => ({
        key,
        label: ODYSSEY_PLAN_META[key].label,
        items: [],
      }))
    const orphan: LdProtoQuestion[] = []
    for (const q of odysseyQs) {
      const pk = q.originRef?.plan_key as OdysseyPlanKey | undefined
      const g = groups.find((x) => x.key === pk)
      if (g) g.items.push(q)
      else orphan.push(q)
    }
    for (const g of groups) {
      g.items.sort(
        (a, b) => (a.originRef?.index ?? 0) - (b.originRef?.index ?? 0),
      )
    }
    return { groups: groups.filter((g) => g.items.length > 0), orphan }
  }, [odysseyQs])

  const hasOdyssey = odysseyQs.length > 0

  const guideStepKey = prototypeGuideStep({
    tab,
    screen:
      screen.kind === 'main'
        ? 'main'
        : screen.kind === 'brainstorm'
          ? 'brainstorm'
          : screen.kind === 'pick'
            ? 'pick'
            : screen.kind === 'prep'
              ? 'prep'
              : 'reflect',
  })
  const guide = getGuide('prototype')

  if (screen.kind === 'brainstorm' || screen.kind === 'pick') {
    const q = qById.get(screen.questionId)
    if (!q) {
      return (
        <MissingScreen
          onReset={() => setScreen({ kind: 'main' })}
          label="질문을 찾을 수 없어요."
        />
      )
    }
    return (
      <>
        <BrainstormFlow
          compass={compass}
          question={q}
          mode={screen.kind}
          onBack={() =>
            setScreen(
              screen.kind === 'pick'
                ? { kind: 'brainstorm', questionId: q.id }
                : { kind: 'main' },
            )
          }
          onPickMode={() => setScreen({ kind: 'pick', questionId: q.id })}
          onDone={() => {
            setTab('todo')
            setScreen({ kind: 'main' })
          }}
        />
        <CompassGuidePanel exerciseKey="prototype" guideStep={guideStepKey} />
      </>
    )
  }

  if (screen.kind === 'prep') {
    const p = compass.prototypes.find((x) => x.id === screen.prototypeId)
    if (!p) {
      return (
        <MissingScreen
          onReset={() => setScreen({ kind: 'main' })}
          label="프로토타입을 찾을 수 없어요."
        />
      )
    }
    return (
      <>
        <PrepScreen
          compass={compass}
          prototype={p}
          question={qById.get(p.questionId) ?? null}
          teamPeople={teamPeople}
          onBack={() => setScreen({ kind: 'main' })}
          onReflect={() =>
            setScreen({ kind: 'reflect', prototypeId: p.id })
          }
        />
        <CompassGuidePanel exerciseKey="prototype" guideStep={guideStepKey} />
      </>
    )
  }

  if (screen.kind === 'reflect') {
    const p = compass.prototypes.find((x) => x.id === screen.prototypeId)
    if (!p) {
      return (
        <MissingScreen
          onReset={() => setScreen({ kind: 'main' })}
          label="프로토타입을 찾을 수 없어요."
        />
      )
    }
    return (
      <>
        <ReflectScreen
          compass={compass}
          prototype={p}
          question={qById.get(p.questionId) ?? null}
          onBack={() => setScreen({ kind: 'prep', prototypeId: p.id })}
          onSaved={() => {
            setTab('learned')
            setScreen({ kind: 'main' })
          }}
        />
        <CompassGuidePanel exerciseKey="prototype" guideStep={guideStepKey} />
      </>
    )
  }

  return (
    <div className="pb-24">
      <header className="mb-4 flex items-start gap-3">
        <div
          className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[16px]"
          style={{ background: COMPASS.soft }}
        >
          <FlaskConical size={28} style={{ color: COMPASS.accent }} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-[32px] font-bold leading-tight text-[#1C1B1A]">
            프로토타입
          </h1>
          <p className="mt-0.5 text-[15px] text-[#8A847E]">
            작게 물어보고 작게 해보기
          </p>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setHelpOpen((o) => !o)}
        className="mb-3 flex w-full items-center justify-between rounded-xl px-1 py-1 text-left text-[13px] text-[#8A847E]"
      >
        <span>이 연습이 뭐예요?</span>
        <span aria-hidden>{helpOpen ? '▾' : '▸'}</span>
      </button>
      {helpOpen && (
        <div className="mb-4 whitespace-pre-wrap rounded-[18px] border border-[#ECE7E2] bg-[#FAF8F6] p-4 text-[13px] leading-relaxed text-[#8A847E]">
          {guide ? (
            <>
              <p>{guideFoldSummary(guide)}</p>
              <p className="mt-2">
                {guide.duration} · {guide.cadence}
              </p>
            </>
          ) : (
            HELP
          )}
        </div>
      )}

      <GuideInlineHint
        exerciseKey="prototype"
        step={guideStepKey}
        className="mb-4"
      />

      <div
        className="mb-4 rounded-[18px] border border-[#ECE7E2] bg-white px-4 py-3 text-[13px] text-[#8A847E]"
        style={{ boxShadow: cardShadow }}
      >
        열린 질문 {openQuestions} · 예정 {planned} · 이번 분기에 끝낸 것{' '}
        {doneThisQuarter}
      </div>

      <div className="mb-4 inline-flex rounded-full bg-[#FAF8F6] p-1">
        {(
          [
            ['questions', '질문'],
            ['todo', '할 일'],
            ['learned', '배운 것'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold"
            style={
              tab === k
                ? { background: COMPASS.accent, color: '#fff' }
                : { color: '#8A847E' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'questions' && (
        <QuestionsTab
          hasOdyssey={hasOdyssey}
          odysseyByPlan={odysseyByPlan}
          manualQs={manualQs}
          protosForQ={protosForQ}
          expandedQ={expandedQ}
          setExpandedQ={setExpandedQ}
          manualDraft={manualDraft}
          setManualDraft={setManualDraft}
          onAddManual={async () => {
            if (!manualDraft.trim()) return
            await compass.addProtoQuestion({
              body: manualDraft.trim(),
              origin: 'manual',
            })
            setManualDraft('')
          }}
          onBrainstorm={(id) =>
            setScreen({ kind: 'brainstorm', questionId: id })
          }
        />
      )}

      {tab === 'todo' && (
        <TodoTab
          prototypes={compass.prototypes}
          qById={qById}
          droppedOpen={droppedOpen}
          setDroppedOpen={setDroppedOpen}
          onPrep={(id) => setScreen({ kind: 'prep', prototypeId: id })}
          onDrop={async (p) => {
            await compass.upsertPrototype({ ...p, status: 'dropped' })
          }}
        />
      )}

      {tab === 'learned' && (
        <LearnedTab
          prototypes={compass.prototypes}
          protoQuestions={compass.protoQuestions}
          qById={qById}
          filter={learnedFilter}
          setFilter={setLearnedFilter}
          sort={learnedSort}
          setSort={setLearnedSort}
        />
      )}

      <CompassGuidePanel exerciseKey="prototype" guideStep={guideStepKey} />
    </div>
  )
}

function useCallbackish(prototypes: LdPrototype[]) {
  return (qid: string) => prototypes.filter((p) => p.questionId === qid)
}

function MissingScreen({
  onReset,
  label,
}: {
  onReset: () => void
  label: string
}) {
  return (
    <div className="py-8 text-center">
      <p className="mb-3 text-[13px] text-[#8A847E]">{label}</p>
      <button
        type="button"
        onClick={onReset}
        className="text-[13px] font-semibold"
        style={{ color: COMPASS.accent }}
      >
        돌아가기
      </button>
    </div>
  )
}

function QuestionsTab({
  hasOdyssey,
  odysseyByPlan,
  manualQs,
  protosForQ,
  expandedQ,
  setExpandedQ,
  manualDraft,
  setManualDraft,
  onAddManual,
  onBrainstorm,
}: {
  hasOdyssey: boolean
  odysseyByPlan: {
    groups: { key: OdysseyPlanKey; label: string; items: LdProtoQuestion[] }[]
    orphan: LdProtoQuestion[]
  }
  manualQs: LdProtoQuestion[]
  protosForQ: (qid: string) => LdPrototype[]
  expandedQ: string | null
  setExpandedQ: (id: string | null) => void
  manualDraft: string
  setManualDraft: (v: string) => void
  onAddManual: () => void
  onBrainstorm: (id: string) => void
}) {
  const renderQ = (q: LdProtoQuestion, ordinal?: string) => {
    const attached = protosForQ(q.id)
    const conv = attached.filter((p) => p.kind === 'conversation').length
    const exp = attached.filter((p) => p.kind === 'experience').length
    const open = expandedQ === q.id
    return (
      <div key={q.id} className="border-b border-[#ECE7E2] last:border-0">
        <button
          type="button"
          className="flex w-full items-start gap-2 px-4 py-3 text-left"
          onClick={() => setExpandedQ(open ? null : q.id)}
        >
          <span className="mt-0.5 text-[14px]" aria-hidden>
            {attached.length > 0 ? '☑' : '☐'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[#1C1B1A]">
              {ordinal ? `${ordinal} ` : ''}
              {q.body}
            </p>
            <p className="mt-0.5 text-[12px] text-[#B5AFA8]">
              {attached.length === 0
                ? '아직 아무것도 안 붙음'
                : `대화 ${conv} · 경험 ${exp}`}
            </p>
          </div>
        </button>
        {open && (
          <div className="space-y-2 px-4 pb-3">
            {attached.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-[#FAF8F6] px-3 py-2 text-[12px] text-[#8A847E]"
              >
                {p.kind === 'conversation' ? '💬' : '🧪'} {p.title}
                {p.status === 'done'
                  ? ' · 끝남'
                  : p.status === 'dropped'
                    ? ' · 접음'
                    : ' · 예정'}
              </div>
            ))}
            <button
              type="button"
              onClick={() => onBrainstorm(q.id)}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
            >
              프로토타입 만들기
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section
        className="overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
        style={{ boxShadow: cardShadow }}
      >
        <div className="border-b border-[#ECE7E2] px-4 py-3 text-[12px] font-semibold text-[#8A847E]">
          오디세이 플랜에서 가져온 질문
        </div>
        {!hasOdyssey ? (
          <p className="px-4 py-4 text-[13px] text-[#B5AFA8]">
            오디세이 플랜을 하면 질문이 자동으로 여기 들어와.
          </p>
        ) : (
          <div>
            {odysseyByPlan.groups.map((g, gi) => (
              <div key={g.key}>
                <p className="bg-[#FAF8F6] px-4 py-2 text-[12px] font-semibold text-[#8A847E]">
                  {['①', '②', '③'][gi] ?? '·'} {g.label}
                </p>
                {g.items.map((q) => renderQ(q))}
              </div>
            ))}
            {odysseyByPlan.orphan.map((q) => renderQ(q))}
          </div>
        )}
      </section>

      <section
        className="overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
        style={{ boxShadow: cardShadow }}
      >
        <div className="border-b border-[#ECE7E2] px-4 py-3 text-[12px] font-semibold text-[#8A847E]">
          내가 추가한 질문
        </div>
        {manualQs.map((q) => renderQ(q))}
        <div className="flex gap-2 p-4">
          <input
            value={manualDraft}
            onChange={(e) => setManualDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onAddManual()
              }
            }}
            placeholder="+ 궁금한 거 하나 적기"
            className="min-w-0 flex-1 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
          />
          <button
            type="button"
            onClick={onAddManual}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
          >
            추가
          </button>
        </div>
      </section>
    </div>
  )
}

function TodoTab({
  prototypes,
  qById,
  droppedOpen,
  setDroppedOpen,
  onPrep,
  onDrop,
}: {
  prototypes: LdPrototype[]
  qById: Map<string, LdProtoQuestion>
  droppedOpen: boolean
  setDroppedOpen: (v: boolean) => void
  onPrep: (id: string) => void
  onDrop: (p: LdPrototype) => void
}) {
  const planned = prototypes
    .filter((p) => p.status === 'planned')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const dropped = prototypes
    .filter((p) => p.status === 'dropped')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const card = (p: LdPrototype) => {
    const q = qById.get(p.questionId)
    return (
      <li
        key={p.id}
        className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-start gap-2">
          {p.kind === 'conversation' ? (
            <MessageCircle size={18} style={{ color: COMPASS.accent }} />
          ) : (
            <Sparkles size={18} style={{ color: COMPASS.accent }} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#1C1B1A]">{p.title}</p>
            <p className="mt-1 text-[12px] text-[#8A847E]">
              ← &ldquo;{q?.body ?? '…'}&rdquo;
            </p>
            <p className="mt-1 text-[12px] text-[#B5AFA8]">
              {p.kind === 'conversation'
                ? p.person
                  ? p.person
                  : '아직 사람 못 정함'
                : p.happenedOn
                  ? `${p.happenedOn} 예정`
                  : '날짜 미정'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onPrep(p.id)}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
          >
            준비하기
          </button>
          {p.status === 'planned' && (
            <button
              type="button"
              onClick={() => onDrop(p)}
              className="text-[12px] text-[#8A847E]"
            >
              접기
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 px-1 text-[12px] font-semibold text-[#8A847E]">
          예정
        </h3>
        {planned.length === 0 ? (
          <p className="px-1 text-[13px] text-[#B5AFA8]">
            질문 탭에서 프로토타입을 만들어 봐.
          </p>
        ) : (
          <ul className="space-y-3">{planned.map(card)}</ul>
        )}
      </section>

      {dropped.length > 0 && (
        <section
          className="overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
          style={{ boxShadow: cardShadow }}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-[12px] font-semibold text-[#8A847E]"
            onClick={() => setDroppedOpen(!droppedOpen)}
          >
            <span>접은 것 ({dropped.length})</span>
            <span>{droppedOpen ? '▾' : '▸'}</span>
          </button>
          {droppedOpen && (
            <ul className="space-y-2 border-t border-[#ECE7E2] p-3">
              {dropped.map((p) => {
                const q = qById.get(p.questionId)
                return (
                  <li
                    key={p.id}
                    className="rounded-xl bg-[#FAF8F6] px-3 py-2 text-[13px] text-[#8A847E]"
                  >
                    <p className="font-medium text-[#1C1B1A]">{p.title}</p>
                    <p className="text-[12px]">← &ldquo;{q?.body ?? '…'}&rdquo;</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function LearnedTab({
  prototypes,
  protoQuestions,
  qById,
  filter,
  setFilter,
  sort,
  setSort,
}: {
  prototypes: LdPrototype[]
  protoQuestions: LdProtoQuestion[]
  qById: Map<string, LdProtoQuestion>
  filter: 'all' | 'conversation' | 'experience'
  setFilter: (v: 'all' | 'conversation' | 'experience') => void
  sort: 'recent' | 'byQuestion'
  setSort: (v: 'recent' | 'byQuestion') => void
}) {
  const done = prototypes
    .filter((p) => p.status === 'done')
    .filter((p) => (filter === 'all' ? true : p.kind === filter))
    .sort((a, b) =>
      (b.happenedOn ?? b.createdAt).localeCompare(a.happenedOn ?? a.createdAt),
    )

  const newQs = protoQuestions.filter((q) => q.origin === 'prototype')
  const convDone = prototypes.filter(
    (p) => p.status === 'done' && p.kind === 'conversation',
  ).length
  const expDone = prototypes.filter(
    (p) => p.status === 'done' && p.kind === 'experience',
  ).length

  const answeredDots = (a: PrototypeAnswered | null) => {
    if (a === 'a_lot') return '답 됐음 ●●'
    if (a === 'some') return '답 됐음 ●○'
    if (a === 'more_confused') return '더 헷갈림'
    return ''
  }

  const card = (p: LdPrototype) => {
    const q = qById.get(p.questionId)
    const spawned = protoQuestions.filter(
      (nq) =>
        nq.origin === 'prototype' && nq.originRef?.prototype_id === p.id,
    )
    return (
      <li
        key={p.id}
        className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-semibold">
            {p.kind === 'conversation' ? '💬' : '🧪'}{' '}
            {p.person ? `${p.person} · ` : ''}
            {p.title}
          </p>
          <div className="shrink-0 text-right text-[11px] text-[#8A847E]">
            <div>{p.happenedOn ?? ''}</div>
            <div>{answeredDots(p.answered)}</div>
          </div>
        </div>
        <p className="mt-1 text-[12px] text-[#8A847E]">
          ← &ldquo;{q?.body ?? '…'}&rdquo;
        </p>
        {p.learned && (
          <p className="mt-2 text-[13px] text-[#1C1B1A]">
            알게 된 것: {p.learned}
          </p>
        )}
        {spawned.length > 0 && (
          <p className="mt-1 text-[12px] text-[#8A847E]">
            여기서 나온 새 질문:{' '}
            {spawned.map((s) => `"${s.body}"`).join(' · ')}
          </p>
        )}
      </li>
    )
  }

  let body: ReactNode
  if (sort === 'byQuestion') {
    const groups = new Map<string, LdPrototype[]>()
    for (const p of done) {
      const list = groups.get(p.questionId) ?? []
      list.push(p)
      groups.set(p.questionId, list)
    }
    body = (
      <div className="space-y-4">
        {[...groups.entries()].map(([qid, items]) => (
          <div key={qid}>
            <p className="mb-2 px-1 text-[12px] font-semibold text-[#8A847E]">
              {qById.get(qid)?.body ?? '질문'}
            </p>
            <ul className="space-y-3">{items.map(card)}</ul>
          </div>
        ))}
      </div>
    )
  } else {
    body =
      done.length === 0 ? (
        <p className="text-[13px] text-[#B5AFA8]">아직 끝낸 프로토타입이 없어.</p>
      ) : (
        <ul className="space-y-3">{done.map(card)}</ul>
      )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-[#FAF8F6] p-1">
          {(
            [
              ['all', '전체'],
              ['conversation', '대화'],
              ['experience', '경험'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className="rounded-full px-3 py-1 text-[12px] font-semibold"
              style={
                filter === k
                  ? { background: COMPASS.accent, color: '#fff' }
                  : { color: '#8A847E' }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as 'recent' | 'byQuestion')
          }
          className="rounded-xl border border-[#ECE7E2] bg-white px-2 py-1.5 text-[12px]"
        >
          <option value="recent">정렬: 최근순</option>
          <option value="byQuestion">질문으로 묶기</option>
        </select>
      </div>

      {body}

      <div
        className="grid grid-cols-3 gap-2 rounded-[18px] border border-[#ECE7E2] bg-white p-4"
        style={{ boxShadow: cardShadow }}
      >
        <div className="text-center">
          <p className="text-[20px] font-bold" style={{ color: COMPASS.accent }}>
            {convDone}
          </p>
          <p className="text-[11px] text-[#8A847E]">대화</p>
        </div>
        <div className="text-center">
          <p className="text-[20px] font-bold" style={{ color: COMPASS.accent }}>
            {expDone}
          </p>
          <p className="text-[11px] text-[#8A847E]">경험</p>
        </div>
        <div className="text-center">
          <p className="text-[20px] font-bold" style={{ color: COMPASS.accent }}>
            {newQs.length}
          </p>
          <p className="text-[11px] text-[#8A847E]">새 질문</p>
        </div>
      </div>
    </div>
  )
}

function BrainstormFlow({
  compass,
  question,
  mode,
  onBack,
  onPickMode,
  onDone,
}: {
  compass: CompassActions
  question: LdProtoQuestion
  mode: 'brainstorm' | 'pick'
  onBack: () => void
  onPickMode: () => void
  onDone: () => void
}) {
  const ideas = compass.protoIdeas.filter(
    (i) => i.questionId === question.id && !i.promoted,
  )
  const people = ideas.filter((i) => i.kind === 'conversation')
  const experiences = ideas.filter((i) => i.kind === 'experience')
  const [personDraft, setPersonDraft] = useState('')
  const [expDraft, setExpDraft] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const addIdea = async (kind: PrototypeKind, body: string) => {
    const t = body.trim()
    if (!t) return
    await compass.addProtoIdea({
      questionId: question.id,
      kind,
      body: t,
    })
  }

  if (mode === 'pick') {
    return (
      <div className="pb-24">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-[13px] text-[#8A847E]"
        >
          ← 브레인스토밍
        </button>
        <h2 className="mb-1 text-[20px] font-bold">이 중에 할 것 고르기</h2>
        <p className="mb-4 text-[13px] text-[#8A847E]">
          &ldquo;{question.body}&rdquo;
        </p>
        <p className="mb-3 text-[12px] text-[#B5AFA8]">1~3개 선택</p>
        <ul className="mb-6 space-y-2">
          {ideas.map((i) => (
            <li key={i.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#ECE7E2] bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => {
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (next.has(i.id)) next.delete(i.id)
                      else if (next.size < 3) next.add(i.id)
                      return next
                    })
                  }}
                  className="mt-1"
                />
                <span className="text-[13px]">
                  {i.kind === 'conversation' ? '💬' : '🧪'} {i.body}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={async () => {
            for (const id of selected) {
              const idea = ideas.find((i) => i.id === id)
              if (!idea) continue
              await compass.addPrototype({
                questionId: question.id,
                kind: idea.kind,
                title: idea.body,
                status: 'planned',
                person: null,
                howKnown: null,
                prepChecks:
                  idea.kind === 'conversation' ? emptyPrepChecks() : null,
                questions:
                  idea.kind === 'conversation'
                    ? [PROTOTYPE_REFERRAL_QUESTION]
                    : [],
                scope: null,
                duration: null,
                learnGoal: null,
                happenedOn: null,
                learned: null,
                answered: null,
                engagement: null,
                energy: null,
                referral: null,
              })
              await compass.upsertProtoIdea({ ...idea, promoted: true })
            }
            onDone()
          }}
          className="h-12 w-full rounded-full text-[15px] font-semibold text-white disabled:opacity-40"
          style={{ background: COMPASS.accent }}
        >
          할 일에 넣기
        </button>
      </div>
    )
  }

  const total = people.length + experiences.length

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-[13px] text-[#8A847E]"
      >
        ← 질문
      </button>
      <p className="mb-4 text-[15px] font-semibold leading-snug text-[#1C1B1A]">
        &ldquo;{question.body}&rdquo;
      </p>
      <p className="mb-1 text-[14px] text-[#1C1B1A]">
        이걸 알아보려면 누굴 만나거나 뭘 해보면 될까?
      </p>
      <p className="mb-5 text-[13px] text-[#8A847E]">
        많이 적을수록 좋아. 말 안 돼도 일단 적어.
      </p>

      <section className="mb-5">
        <h3 className="mb-2 text-[13px] font-semibold">💬 만나볼 사람</h3>
        <input
          value={personDraft}
          onChange={(e) => setPersonDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              await addIdea('conversation', personDraft)
              setPersonDraft('')
            }
          }}
          placeholder='+ 누구 (이름 몰라도 "그런 사람" 이라고 써도 돼)'
          className="mb-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        />
        <IdeaList
          items={people}
          onRemove={(id) => void compass.deleteProtoIdea(id)}
        />
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-[13px] font-semibold">🧪 해볼 것</h3>
        <input
          value={expDraft}
          onChange={(e) => setExpDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              await addIdea('experience', expDraft)
              setExpDraft('')
            }
          }}
          placeholder="+ 뭘 해보면 감이 올까"
          className="mb-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        />
        <IdeaList
          items={experiences}
          onRemove={(id) => void compass.deleteProtoIdea(id)}
        />
      </section>

      {total < 3 && (
        <p className="mb-4 text-[12px] text-[#B5AFA8]">
          세 개쯤 적고 나서 고르는 게 나아.
        </p>
      )}

      <button
        type="button"
        disabled={total === 0}
        onClick={onPickMode}
        className="h-12 w-full rounded-full text-[15px] font-semibold text-white disabled:opacity-40"
        style={{ background: COMPASS.accent }}
      >
        이 중에 할 것 고르기 →
      </button>
    </div>
  )
}

function IdeaList({
  items,
  onRemove,
}: {
  items: LdProtoIdea[]
  onRemove: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li
          key={i.id}
          className="flex items-center justify-between gap-2 rounded-xl bg-[#FAF8F6] px-3 py-2 text-[13px]"
        >
          <span>· {i.body}</span>
          <button
            type="button"
            onClick={() => onRemove(i.id)}
            className="text-[#B5AFA8]"
            aria-label="삭제"
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function PrepScreen({
  compass,
  prototype,
  question,
  teamPeople,
  onBack,
  onReflect,
}: {
  compass: CompassActions
  prototype: LdPrototype
  question: LdProtoQuestion | null
  teamPeople: { id: string; name: string; relation: string }[]
  onBack: () => void
  onReflect: () => void
}) {
  const [p, setP] = useState(prototype)
  const [teamOpen, setTeamOpen] = useState(false)
  const [personQuery, setPersonQuery] = useState(prototype.person ?? '')

  useEffect(() => {
    setP(prototype)
    setPersonQuery(prototype.person ?? '')
  }, [prototype])

  const save = async (next: LdPrototype) => {
    setP(next)
    await compass.upsertPrototype(next)
  }

  const checks: PrototypePrepChecks = p.prepChecks ?? emptyPrepChecks()
  const filteredTeam = teamPeople.filter(
    (t) =>
      !personQuery ||
      t.name.toLowerCase().includes(personQuery.toLowerCase()),
  )

  if (p.kind === 'experience') {
    return (
      <div className="pb-24">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-[13px] text-[#8A847E]"
        >
          ← 할 일
        </button>
        <h2 className="mb-1 text-[20px] font-bold">🧪 경험 준비</h2>
        <p className="mb-5 text-[12px] text-[#8A847E]">
          ← &ldquo;{question?.body ?? '…'}&rdquo;
        </p>

        <label className="mb-4 block">
          <span className="text-[12px] text-[#8A847E]">뭘 할 거야</span>
          <input
            value={p.title}
            onChange={(e) => void save({ ...p, title: e.target.value })}
            className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
          />
        </label>

        <div className="mb-4 flex flex-wrap gap-2">
          <label className="flex-1">
            <span className="text-[12px] text-[#8A847E]">언제</span>
            <input
              type="date"
              value={p.happenedOn ?? ''}
              onChange={(e) =>
                void save({ ...p, happenedOn: e.target.value || null })
              }
              className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
            />
          </label>
          <label className="w-32">
            <span className="text-[12px] text-[#8A847E]">얼마나</span>
            <select
              value={p.duration ?? '반나절'}
              onChange={(e) => void save({ ...p, duration: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-2 py-2.5 text-[14px]"
            >
              {PROTOTYPE_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-4 block">
          <span className="text-[12px] text-[#8A847E]">이걸로 뭘 알고 싶어?</span>
          <input
            value={p.learnGoal ?? ''}
            onChange={(e) => void save({ ...p, learnGoal: e.target.value })}
            className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
          />
          <span className="mt-1 block text-[11px] text-[#B5AFA8]">
            ⓘ 원래 질문이랑 달라도 돼. 더 좁혀도 되고.
          </span>
        </label>

        <label className="mb-6 block">
          <span className="text-[12px] text-[#8A847E]">가장 작은 버전은 뭐야?</span>
          <textarea
            rows={3}
            value={p.scope ?? ''}
            onChange={(e) => void save({ ...p, scope: e.target.value })}
            className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
          />
          <span className="mt-1 block text-[11px] text-[#B5AFA8]">
            ⓘ 크게 잡으면 안 하게 돼. 이번 주에 되는 크기로.
          </span>
        </label>

        <button
          type="button"
          onClick={onReflect}
          className="h-12 w-full rounded-full text-[15px] font-semibold text-white"
          style={{ background: COMPASS.accent }}
        >
          끝나면 기록하기
        </button>
      </div>
    )
  }

  const goReflect = () => {
    const ready =
      checks.notJob && checks.listen && checks.questions
    if (!ready) {
      const ok = window.confirm(
        '준비 없이 갔어도 괜찮아. 기록은 남기자.',
      )
      if (!ok) return
    }
    onReflect()
  }

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-[13px] text-[#8A847E]"
      >
        ← 할 일
      </button>
      <h2 className="mb-1 text-[20px] font-bold">💬 대화 준비</h2>
      <p className="mb-5 text-[12px] text-[#8A847E]">
        ← &ldquo;{question?.body ?? '…'}&rdquo;
      </p>

      <div className="mb-3">
        <span className="text-[12px] text-[#8A847E]">누구</span>
        <div className="mt-1 flex gap-2">
          <input
            value={personQuery}
            onChange={(e) => {
              setPersonQuery(e.target.value)
              void save({ ...p, person: e.target.value || null })
            }}
            placeholder="이름 또는 그런 사람"
            className="min-w-0 flex-1 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
          />
          <button
            type="button"
            onClick={() => setTeamOpen((o) => !o)}
            className="shrink-0 rounded-full border border-[#ECE7E2] px-3 py-2 text-[12px] font-semibold text-[#8A847E]"
          >
            팀에서 찾기
          </button>
        </div>
        {teamOpen && (
          <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-[#ECE7E2] bg-white">
            {filteredTeam.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-[#B5AFA8]">
                팀 연습에 사람이 없어요.
              </li>
            ) : (
              filteredTeam.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#FAF8F6]"
                    onClick={() => {
                      setPersonQuery(t.name)
                      setTeamOpen(false)
                      void save({
                        ...p,
                        person: t.name,
                        howKnown: p.howKnown || t.relation || null,
                      })
                    }}
                  >
                    {t.name}
                    {t.relation ? (
                      <span className="text-[#B5AFA8]"> · {t.relation}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <label className="mb-3 block">
        <span className="text-[12px] text-[#8A847E]">어떻게 아는 사람</span>
        <input
          value={p.howKnown ?? ''}
          onChange={(e) => void save({ ...p, howKnown: e.target.value })}
          className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
        />
      </label>

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="text-[12px] text-[#8A847E]">언제</span>
          <input
            type="date"
            value={p.happenedOn ?? ''}
            onChange={(e) =>
              void save({ ...p, happenedOn: e.target.value || null })
            }
            className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
          />
        </label>
        <button
          type="button"
          onClick={() => void save({ ...p, happenedOn: null })}
          className="rounded-full border border-[#ECE7E2] px-3 py-2 text-[12px] text-[#8A847E]"
        >
          아직 안 정함
        </button>
      </div>

      <div className="mb-5 rounded-[18px] border border-[#ECE7E2] bg-[#FAF8F6] p-4">
        <p className="mb-3 text-[12px] font-semibold text-[#8A847E]">
          가기 전에
        </p>
        {(
          [
            ['notJob', '이게 구직이 아니라는 걸 미리 말했다'],
            [
              'listen',
              '이 사람 이야기를 들으러 가는 거지, 내 얘기 하러 가는 게 아니라는 걸 안다',
            ],
            ['questions', '물어볼 것 3개 이상 준비했다'],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="mb-2 flex cursor-pointer items-start gap-2 text-[13px] last:mb-0"
          >
            <input
              type="checkbox"
              checked={checks[key]}
              onChange={(e) =>
                void save({
                  ...p,
                  prepChecks: { ...checks, [key]: e.target.checked },
                })
              }
              className="mt-0.5"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">
          물어볼 것
        </p>
        <p className="mb-2 text-[11px] text-[#B5AFA8]">기본 질문에서 담기:</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PROTOTYPE_STARTER_QUESTIONS.map((chip) => {
            const already = p.questions.includes(chip)
            return (
              <button
                key={chip}
                type="button"
                disabled={already}
                onClick={() => {
                  if (already) return
                  void save({ ...p, questions: [...p.questions, chip] })
                }}
                className="rounded-full border border-[#ECE7E2] bg-white px-2.5 py-1 text-[11px] text-[#8A847E] disabled:opacity-40"
              >
                + {chip}
              </button>
            )
          })}
        </div>
        <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">
          내 질문 목록
        </p>
        <ul className="space-y-2">
          {p.questions.map((q, i) => (
            <li key={`${i}-${q}`} className="flex gap-2">
              <span className="pt-2 text-[12px] text-[#B5AFA8]">{i + 1}.</span>
              <input
                value={q}
                onChange={(e) => {
                  const next = [...p.questions]
                  next[i] = e.target.value
                  void save({ ...p, questions: next })
                }}
                className="min-w-0 flex-1 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
              />
              <button
                type="button"
                onClick={() =>
                  void save({
                    ...p,
                    questions: p.questions.filter((_, j) => j !== i),
                  })
                }
                className="text-[#B5AFA8]"
                aria-label="삭제"
              >
                <X size={14} />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => void save({ ...p, questions: [...p.questions, ''] })}
              className="text-[13px] text-[#8A847E]"
            >
              + 직접 쓰기
            </button>
          </li>
        </ul>
      </div>

      <p
        className="mb-6 rounded-xl px-3 py-2 text-[13px] font-medium"
        style={{ background: `${COMPASS.soft}`, color: COMPASS.ink }}
      >
        ⚠ 내가 더 많이 말하고 있으면 그건 인터뷰가 아니야.
      </p>

      <button
        type="button"
        onClick={goReflect}
        className="h-12 w-full rounded-full text-[15px] font-semibold text-white"
        style={{ background: COMPASS.accent }}
      >
        끝나면 기록하기
      </button>
    </div>
  )
}

function ReflectScreen({
  compass,
  prototype,
  question,
  onBack,
  onSaved,
}: {
  compass: CompassActions
  prototype: LdPrototype
  question: LdProtoQuestion | null
  onBack: () => void
  onSaved: () => void
}) {
  const [learned, setLearned] = useState(prototype.learned ?? '')
  const [answered, setAnswered] = useState<PrototypeAnswered | null>(
    prototype.answered,
  )
  const [engagement, setEngagement] = useState(prototype.engagement ?? 0)
  const [energy, setEnergy] = useState(prototype.energy ?? 0)
  const [newQs, setNewQs] = useState<string[]>([''])
  const [referral, setReferral] = useState(prototype.referral ?? '')
  const [error, setError] = useState(false)
  const [makeReferralProto, setMakeReferralProto] = useState(false)

  const save = async () => {
    if (!learned.trim()) {
      setError(true)
      return
    }
    setError(false)
    const next: LdPrototype = {
      ...prototype,
      learned: learned.trim(),
      answered,
      engagement,
      energy,
      referral: referral.trim() || null,
      happenedOn: prototype.happenedOn ?? todayKey(),
      status: 'done',
    }
    await compass.upsertPrototype(next)

    for (const body of newQs) {
      const t = body.trim()
      if (!t) continue
      await compass.addProtoQuestion({
        body: t,
        origin: 'prototype',
        originRef: { prototype_id: prototype.id },
      })
    }

    if (makeReferralProto && referral.trim()) {
      await compass.addPrototype({
        questionId: prototype.questionId,
        kind: 'conversation',
        title: referral.trim(),
        status: 'planned',
        person: referral.trim(),
        howKnown: `${prototype.person ?? '이전 대화'}에서 소개`,
        prepChecks: emptyPrepChecks(),
        questions: [PROTOTYPE_REFERRAL_QUESTION],
        scope: null,
        duration: null,
        learnGoal: null,
        happenedOn: null,
        learned: null,
        answered: null,
        engagement: null,
        energy: null,
        referral: null,
      })
    }

    onSaved()
  }

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-[13px] text-[#8A847E]"
      >
        ← 준비
      </button>
      <h2 className="mb-5 text-[20px] font-bold">끝났어? 잊기 전에 적자.</h2>

      <div className="mb-4 rounded-xl bg-[#FAF8F6] px-3 py-2">
        <p className="text-[11px] text-[#8A847E]">원래 질문</p>
        <p className="text-[13px] font-medium">
          &ldquo;{question?.body ?? '…'}&rdquo;
        </p>
      </div>

      <label className="mb-4 block">
        <span className="text-[13px] font-semibold">뭘 알게 됐어?</span>
        <textarea
          rows={4}
          value={learned}
          onChange={(e) => {
            setLearned(e.target.value)
            if (e.target.value.trim()) setError(false)
          }}
          className="mt-1 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        />
        {error && (
          <p className="mt-1 text-[12px] text-[#E0574A]">
            여기가 이 프로토타입의 전부야.
          </p>
        )}
      </label>

      <fieldset className="mb-5">
        <legend className="mb-2 text-[13px] font-semibold">
          원래 질문에 답이 좀 됐어?
        </legend>
        {(
          [
            ['a_lot', '꽤 됐어'],
            ['some', '조금'],
            ['more_confused', '아니, 오히려 더 헷갈려'],
          ] as const
        ).map(([v, label]) => (
          <label
            key={v}
            className="mb-1.5 flex items-center gap-2 text-[13px]"
          >
            <input
              type="radio"
              name="answered"
              checked={answered === v}
              onChange={() => setAnswered(v)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="mb-5">
        <p className="mb-2 text-[13px] font-semibold">하는 동안 기분이 어땠어?</p>
        <div className="flex flex-wrap gap-6">
          <CompassBipolarSlider
            label="몰입"
            value={engagement}
            onChange={setEngagement}
          />
          <CompassBipolarSlider
            label="에너지"
            value={energy}
            onChange={setEnergy}
          />
        </div>
        <p className="mt-2 text-[11px] text-[#B5AFA8]">
          ⓘ 굿타임 저널이랑 같은 눈금. 이것도 데이터야.
        </p>
      </div>

      <div className="mb-5">
        <p className="mb-1 text-[13px] font-semibold">새로 생긴 질문 있어?</p>
        <p className="mb-2 text-[12px] text-[#8A847E]">
          → 여기 적으면 [질문] 탭에 새 질문으로 들어가
        </p>
        {newQs.map((q, i) => (
          <input
            key={i}
            value={q}
            onChange={(e) => {
              const next = [...newQs]
              next[i] = e.target.value
              setNewQs(next)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setNewQs((prev) => [...prev, ''])
              }
            }}
            placeholder="+"
            className="mb-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
          />
        ))}
        <button
          type="button"
          onClick={() => setNewQs((prev) => [...prev, ''])}
          className="text-[12px] text-[#8A847E]"
        >
          + 질문 더
        </button>
      </div>

      {prototype.kind === 'conversation' && (
        <div className="mb-6">
          <p className="mb-2 text-[13px] font-semibold">
            또 만나보라고 소개받은 사람 있어?
          </p>
          <input
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            className="mb-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
          />
          {referral.trim() && (
            <label className="flex items-center gap-2 text-[12px] text-[#8A847E]">
              <input
                type="checkbox"
                checked={makeReferralProto}
                onChange={(e) => setMakeReferralProto(e.target.checked)}
              />
              새 프로토타입으로 만들기
            </label>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        className="h-12 w-full rounded-full text-[15px] font-semibold text-white"
        style={{ background: COMPASS.accent }}
      >
        저장
      </button>
    </div>
  )
}
