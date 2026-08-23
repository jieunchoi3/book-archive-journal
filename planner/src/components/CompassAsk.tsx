import { useMemo, useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import {
  ASK_COLOR_PALETTE,
  CADENCE_PRESETS,
  COMPASS,
  daysBetween,
  todayKey,
  type LdAnswer,
  type LdQuestion,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'

interface CompassAskListProps {
  compass: CompassActions
  onOpenQuestion: (questionId: string) => void
  onBack: () => void
}

export function CompassAskList({
  compass,
  onOpenQuestion,
  onBack,
}: CompassAskListProps) {
  const [creating, setCreating] = useState(false)
  const [body, setBody] = useState('')
  const [cadence, setCadence] = useState(90)
  const [customDays, setCustomDays] = useState('')
  const [color, setColor] = useState<string>(ASK_COLOR_PALETTE[0])

  const create = async () => {
    const days = customDays ? Math.max(1, Number(customDays) || 90) : cadence
    if (!body.trim()) return
    const q = await compass.createQuestion({
      body: body.trim(),
      cadenceDays: days,
      color,
    })
    setCreating(false)
    setBody('')
    setCustomDays('')
    onOpenQuestion(q.id)
  }

  return (
    <div className="pb-24">
      <header className="mb-6 flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="mt-2 rounded-lg p-1 text-[#8A847E] hover:bg-[#FAF8F6]"
          aria-label="뒤로"
        >
          <ArrowLeft size={20} />
        </button>
        <div
          className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[16px]"
          style={{ background: COMPASS.soft }}
        >
          <Mail size={28} style={{ color: COMPASS.accent }} />
        </div>
        <div className="min-w-0 pt-1">
          <h1 className="text-[32px] font-bold leading-none tracking-tight text-[#1C1B1A]">
            Ask Myself
          </h1>
          <p className="mt-2 text-[15px] text-[#8A847E]">
            내가 나한테 던지는 질문. 때 되면 다시 열려요.
          </p>
        </div>
      </header>

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mb-6 w-full rounded-full border border-dashed px-4 py-3 text-[14px] font-semibold"
          style={{ borderColor: COMPASS.line, color: COMPASS.accent }}
        >
          + 새 질문 만들기
        </button>
      ) : (
        <div
          className="mb-6 rounded-[18px] border border-[#ECE7E2] bg-white p-5"
          style={{
            boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
          }}
        >
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="나한테 던질 질문"
            className="mb-4 w-full resize-none rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[16px] text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
          />
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#8A847E]">
            주기
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {CADENCE_PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => {
                  setCadence(p.days)
                  setCustomDays('')
                }}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                style={
                  !customDays && cadence === p.days
                    ? { background: COMPASS.accent, color: '#fff' }
                    : { background: '#FAF8F6', color: '#1C1B1A' }
                }
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomDays(customDays || '45')}
              className="rounded-full px-3 py-1.5 text-[12px] font-medium"
              style={
                customDays
                  ? { background: COMPASS.accent, color: '#fff' }
                  : { background: '#FAF8F6', color: '#1C1B1A' }
              }
            >
              직접 입력
            </button>
          </div>
          {customDays !== '' && (
            <input
              type="number"
              min={1}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="mb-3 w-28 rounded-xl border border-[#ECE7E2] px-3 py-2 text-[14px]"
              placeholder="일"
            />
          )}
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#8A847E]">
            색
          </p>
          <div className="mb-4 flex gap-2">
            {ASK_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 3px ${COMPASS.soft}` : undefined,
                }}
                aria-label={c}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-full px-4 py-2 text-[13px] text-[#8A847E]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void create()}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
            >
              만들고 첫 답 쓰기
            </button>
          </div>
        </div>
      )}

      {compass.dueQuestions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-[#1C1B1A]">
            오늘 열린 질문
          </h2>
          <ul className="flex flex-col gap-3">
            {compass.dueQuestions.map((q) => (
              <DueQuestionCard
                key={q.id}
                question={q}
                answerCount={compass.answersFor(q.id).length}
                onOpen={() => onOpenQuestion(q.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {compass.waitingQuestions.length > 0 && (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-[#8A847E]">
            기다리는 중
          </h2>
          <ul className="flex flex-col gap-2">
            {compass.waitingQuestions.map((q) => (
              <WaitingRow key={q.id} question={q} />
            ))}
          </ul>
        </section>
      )}

      {compass.questions.length === 0 && !creating && (
        <p className="text-[14px] text-[#8A847E]">
          아직 질문이 없어요. 몇 달 뒤의 나에게 던질 한 문장부터.
        </p>
      )}
    </div>
  )
}

function DueQuestionCard({
  question,
  answerCount,
  onOpen,
}: {
  question: LdQuestion
  answerCount: number
  onOpen: () => void
}) {
  const months = Math.max(1, Math.round(question.cadenceDays / 30))
  return (
    <li
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-5"
      style={{
        boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
      }}
    >
      <p className="text-[17px] font-medium leading-snug text-[#1C1B1A]">
        “{question.body}”
      </p>
      <p className="mt-2 text-[13px] text-[#8A847E]">
        {months}개월마다 · 지난 답 {answerCount}개
      </p>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="text-[14px] font-semibold"
          style={{ color: COMPASS.accent }}
        >
          지금 답하기 →
        </button>
      </div>
    </li>
  )
}

function WaitingRow({ question }: { question: LdQuestion }) {
  const today = todayKey()
  const daysLeft = daysBetween(today, question.nextDueOn)
  const elapsed = Math.max(
    0,
    question.cadenceDays - daysLeft,
  )
  const progress = Math.min(1, elapsed / question.cadenceDays)
  const bars = 3
  const filled = Math.round(progress * bars)

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-[#FAF8F6] px-4 py-3">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: question.color }}
      />
      <p className="min-w-0 flex-1 truncate text-[14px] text-[#1C1B1A]">
        “{question.body}”
      </p>
      <span className="shrink-0 text-[12px] text-[#8A847E]">{daysLeft}일 남음</span>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className="h-3 w-1.5 rounded-sm"
            style={{
              background: i < filled ? question.color : '#ECE7E2',
            }}
          />
        ))}
      </span>
    </li>
  )
}

interface CompassAskDetailProps {
  compass: CompassActions
  questionId: string
  onBack: () => void
}

export function CompassAskDetail({
  compass,
  questionId,
  onBack,
}: CompassAskDetailProps) {
  const question = compass.questions.find((q) => q.id === questionId)
  const past = compass.answersFor(questionId)
  const [body, setBody] = useState('')
  const [feeling, setFeeling] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState<LdAnswer | null>(null)
  const [mode, setMode] = useState<'answer' | 'timeline'>(() => {
    const q = compass.questions.find((x) => x.id === questionId)
    if (!q) return 'answer'
    return q.nextDueOn <= todayKey() ? 'answer' : 'timeline'
  })
  const [cadenceEdit, setCadenceEdit] = useState(false)

  const isDue = question ? question.nextDueOn <= todayKey() : false
  const displayAnswers = useMemo(() => {
    const list = [...past]
    if (justSubmitted && !list.some((a) => a.id === justSubmitted.id)) {
      list.unshift(justSubmitted)
    }
    return list
  }, [justSubmitted, past])

  const showCompose =
    mode === 'answer' &&
    Boolean(question) &&
    (isDue || past.length === 0 || !revealed) &&
    !(revealed && displayAnswers.length > 0)

  if (!question) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-[#8A847E]">
          ← 목록
        </button>
        <p className="mt-4 text-[#8A847E]">질문을 찾을 수 없어요.</p>
      </div>
    )
  }

  const submit = async () => {
    if (!body.trim()) return
    const ans = await compass.submitAnswer(questionId, body, feeling)
    setJustSubmitted(ans)
    setBody('')
    setFeeling(null)
    setRevealed(true)
  }

  if (mode === 'timeline' || (revealed && displayAnswers.length > 0 && !showCompose)) {
    return (
      <AskTimeline
        question={question}
        answers={displayAnswers}
        highlightId={justSubmitted?.id}
        onBack={onBack}
        onAnswerAgain={() => {
          setRevealed(false)
          setJustSubmitted(null)
          setMode('answer')
        }}
        compass={compass}
        cadenceEdit={cadenceEdit}
        setCadenceEdit={setCadenceEdit}
      />
    )
  }

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1 text-[13px] text-[#8A847E]"
      >
        <ArrowLeft size={16} /> 목록
      </button>

      <h1
        className="mb-6 text-[28px] font-medium leading-snug text-[#1C1B1A]"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {question.body}
      </h1>

      {past.length > 0 && !revealed && (
        <p className="mb-4 text-[13px] text-[#B5AFA8]">
          지난 답변 {past.length}개는 다 쓰고 나면 열려요.
        </p>
      )}

      <textarea
        rows={8}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="지금 생각"
        className="mb-4 w-full resize-none rounded-[18px] border border-[#ECE7E2] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        style={{
          boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      />

      <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#8A847E]">
        확신 정도
      </p>
      <div className="mb-6 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setFeeling(n)}
            className="h-4 w-4 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
            style={{
              background: feeling != null && feeling >= n ? COMPASS.accent : '#ECE7E2',
            }}
            aria-label={`${n}`}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!body.trim()}
        onClick={() => void submit()}
        className="w-full rounded-full py-3 text-[15px] font-semibold text-white disabled:opacity-40"
        style={{ background: COMPASS.accent }}
      >
        답변 저장하고 과거 열기
      </button>

      {!isDue && past.length > 0 && (
        <button
          type="button"
          className="mt-4 w-full text-center text-[13px] text-[#8A847E]"
          onClick={() => setMode('timeline')}
        >
          지난 답 타임라인 보기
        </button>
      )}
    </div>
  )
}

function AskTimeline({
  question,
  answers,
  highlightId,
  onBack,
  onAnswerAgain,
  compass,
  cadenceEdit,
  setCadenceEdit,
}: {
  question: LdQuestion
  answers: LdAnswer[]
  highlightId?: string
  onBack: () => void
  onAnswerAgain: () => void
  compass: CompassActions
  cadenceEdit: boolean
  setCadenceEdit: (v: boolean) => void
}) {
  const feelings = [...answers].reverse().map((a) => a.feeling ?? 0)

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8A847E]"
      >
        <ArrowLeft size={16} /> 목록
      </button>

      <h1
        className="mb-4 text-[24px] font-medium leading-snug"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {question.body}
      </h1>

      {feelings.some((f) => f > 0) && (
        <div className="mb-6">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#8A847E]">
            확신도
          </p>
          <FeelingSparkline values={feelings} />
        </div>
      )}

      <ul className="relative flex flex-col gap-4 border-l-2 pl-5"
        style={{ borderColor: COMPASS.line }}
      >
        {answers.map((a, i) => (
          <li
            key={a.id}
            className="relative animate-[compass-fade-in_0.35s_ease_both]"
            style={{
              animationDelay: `${i * 120}ms`,
            }}
          >
            <span
              className="absolute -left-[1.4rem] top-3 h-2.5 w-2.5 rounded-full"
              style={{ background: COMPASS.accent }}
            />
            <div
              className="rounded-[18px] border bg-white p-4"
              style={{
                borderColor:
                  a.id === highlightId ? COMPASS.accent : '#ECE7E2',
                boxShadow:
                  '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[12px] text-[#8A847E]">{a.answeredOn}</span>
                {a.feeling != null && (
                  <span className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            a.feeling! >= n ? COMPASS.accent : '#ECE7E2',
                        }}
                      />
                    ))}
                  </span>
                )}
              </div>
              <p
                className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1C1B1A]"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {a.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-2">
        {question.nextDueOn <= todayKey() && (
          <button
            type="button"
            onClick={onAnswerAgain}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
          >
            다시 답하기
          </button>
        )}
        <button
          type="button"
          onClick={() => setCadenceEdit(!cadenceEdit)}
          className="rounded-full bg-[#FAF8F6] px-4 py-2 text-[13px] text-[#1C1B1A]"
        >
          주기 바꾸기
        </button>
        <button
          type="button"
          onClick={() =>
            void compass.updateQuestion({ ...question, isActive: !question.isActive })
          }
          className="rounded-full bg-[#FAF8F6] px-4 py-2 text-[13px] text-[#1C1B1A]"
        >
          {question.isActive ? '쉬어가기' : '다시 켜기'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('이 질문과 답변을 삭제할까요?')) {
              void compass.deleteQuestion(question.id)
              onBack()
            }
          }}
          className="rounded-full px-4 py-2 text-[13px] text-[#E0574A]"
        >
          삭제
        </button>
      </div>

      {cadenceEdit && (
        <div className="mt-4 flex flex-wrap gap-2">
          {CADENCE_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => {
                void compass.updateQuestion({
                  ...question,
                  cadenceDays: p.days,
                })
                setCadenceEdit(false)
              }}
              className="rounded-full px-3 py-1.5 text-[12px]"
              style={
                question.cadenceDays === p.days
                  ? { background: COMPASS.accent, color: '#fff' }
                  : { background: '#FAF8F6' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {answers.length >= 2 && (
        <p className="mt-6 text-[13px] text-[#B5AFA8]">
          AI 비교는 다음 단계에서 열려요.
        </p>
      )}
    </div>
  )
}

function FeelingSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 160
  const h = 36
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v || 0) / 5) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke={COMPASS.accent}
        strokeWidth="2"
        points={pts}
      />
    </svg>
  )
}
