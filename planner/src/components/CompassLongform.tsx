import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COMPASS,
  emptyLongformData,
  normalizeLongformData,
  type ExerciseKey,
  type LongformData,
  type LongformStep,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'
import { longformGuideStep } from '../compass/guides'

const SERIF = '"Noto Serif KR", Georgia, "Times New Roman", serif'

const WORK_ANGLE_CHIPS = [
  '돈은 여기서 어떤 역할이야?',
  '일이 없어지면 뭐가 같이 사라져?',
  '네 일이 남들한테는 뭘 해주는 것 같아?',
  '언제 "이건 좋은 일이었다"고 느꼈어?',
  '경험이나 성장은 여기랑 무슨 상관이야?',
  '일이 세상이랑 어디서 만나?',
]

const LIFE_ANGLE_CHIPS = [
  '뭐가 삶을 살 만하게 만들어?',
  '너랑 다른 사람들 사이는 어떤 관계야?',
  '가족, 나라, 세계는 네 삶 어디쯤에 있어?',
  '뭐가 좋은 거고 뭐가 나쁜 거야?',
  '너보다 큰 무언가가 있다고 생각해?',
  '기쁨이랑 슬픔은 삶에서 무슨 역할이야?',
  '돈, 유명해지는 것, 성취는 만족이랑 무슨 상관이야?',
]

const WORK_QUESTIONS: { id: string; label: string }[] = [
  { id: 'why_work', label: '왜 일하는가' },
  { id: 'what_for', label: '일은 뭘 위한 건가' },
  { id: 'meaning', label: '일은 무슨 의미인가' },
  { id: 'connect', label: '일은 나 · 타인 · 사회와 어떻게 연결되나' },
  { id: 'good_work', label: '뭐가 좋은 일, 가치 있는 일인가' },
  { id: 'money', label: '돈은 여기서 어떤 역할인가' },
  { id: 'growth', label: '경험 · 성장 · 충족은 어떤 관계인가' },
]

const LIFE_QUESTIONS: { id: string; label: string }[] = [
  { id: 'why_here', label: '왜 우리는 여기 있나' },
  { id: 'purpose', label: '삶의 의미나 목적은 뭔가' },
  { id: 'others', label: '나와 다른 사람들은 어떤 관계인가' },
  { id: 'place', label: '가족 · 나라 · 세계는 어디에 놓이나' },
  { id: 'good_bad', label: '뭐가 좋은 거고 뭐가 나쁜 건가' },
  { id: 'bigger', label: '나보다 큰 무언가가 있나, 있다면 삶에 어떤 영향인가' },
  {
    id: 'emotions',
    label: '기쁨 · 슬픔 · 정의 · 불의 · 사랑 · 평화 · 다툼은 어떤 역할인가',
  },
  { id: 'status', label: '돈 · 명성 · 성취는 만족스러운 삶과 무슨 상관인가' },
]

const WORK_HELP = `일에 대한 네 생각을 한 편의 글로 쓰는 거야. 500자쯤.

"어떤 일을 하고 싶은가"가 아니라 "왜 일하는가"를 쓴다.
여기서 일은 돈 받는 일만이 아니라, 세상이랑 능동적으로 관계 맺는 것 전부야.
집안일도, 누굴 돌보는 것도, 공부도 포함.

정답은 없고, 지금 생각이면 돼. 보통 6개월마다 다시 써.`

const LIFE_HELP = `세상이 어떻게 돌아간다고 보는지, 뭐가 중요한지를 한 편의 글로 쓰는 거야. 500자쯤.

목표나 계획이 아니라 관점이야. 크고 답 없는 질문들이라 부담스러울 수 있는데,
지금 생각하는 대로만 쓰면 돼. 반년 뒤에 달라져 있어도 그게 정상이야.

보통 6개월마다 다시 써.`

const WORK_GUARD = `⚠ 이건 아니야
어떤 일을 하고 싶은지, 어떤 회사를 원하는지 쓰는 게 아니야.
왜 일하는지, 일이 뭐라고 생각하는지를 쓰는 거야.
조건 목록이 아니라 선언문에 가깝게.

여기서 "일"은 돈 받는 일만이 아니야.
세상이랑 능동적으로 관계 맺는 것 전부.`

const LIFE_GUARD = `⚠ 이건 아니야
목표나 버킷리스트가 아니야.
세상이 어떻게 돌아간다고 보는지, 뭐가 중요한지를 쓰는 거야.
정답을 찾을 필요 없고, 지금 생각이면 돼.`

const STEP_LABELS = ['쏟아내기', '쓰기', '가치 뽑기'] as const

interface CompassLongformProps {
  kind: 'workview' | 'lifeview'
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
  onOpenExercise?: (key: ExerciseKey) => void
}

function LongformStepper({
  step,
  maxReached,
  onJump,
}: {
  step: LongformStep
  maxReached: LongformStep
  onJump: (s: LongformStep) => void
}) {
  return (
    <div className="mb-5 flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const s = i as LongformStep
        const done = s < step
        const current = s === step
        const locked = s > maxReached
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className="mx-1.5 h-px w-8 sm:w-12"
                style={{
                  background: s <= maxReached ? COMPASS.accent : '#ECE7E2',
                }}
              />
            )}
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                if (!locked) onJump(s)
              }}
              className="flex flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                style={
                  done
                    ? { background: COMPASS.accent, color: '#fff' }
                    : current
                      ? {
                          background: '#fff',
                          border: `2px solid ${COMPASS.accent}`,
                          color: COMPASS.ink,
                        }
                      : {
                          background: '#fff',
                          border: '1.5px solid #ECE7E2',
                          color: '#B5AFA8',
                        }
                }
              >
                {i + 1}
              </span>
              <span
                className="text-[11px] font-medium"
                style={{ color: current || done ? COMPASS.ink : '#B5AFA8' }}
              >
                {label}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function CompassLongform({
  kind,
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
  onOpenExercise,
}: CompassLongformProps) {
  const key = kind as ExerciseKey
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    key,
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<LongformData>(emptyLongformData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [maxReached, setMaxReached] = useState<LongformStep>(0)
  const [reasonDraft, setReasonDraft] = useState('')
  const [promptQ, setPromptQ] = useState(
    kind === 'workview' ? '왜 일해?' : '왜 우리는 여기 있을까?',
  )
  const [bodyOpen, setBodyOpen] = useState(false)
  const [listOpenMobile, setListOpenMobile] = useState(true)
  const reasonRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const angles = kind === 'workview' ? WORK_ANGLE_CHIPS : LIFE_ANGLE_CHIPS
  const questions = kind === 'workview' ? WORK_QUESTIONS : LIFE_QUESTIONS
  const help = kind === 'workview' ? WORK_HELP : LIFE_HELP
  const guard = kind === 'workview' ? WORK_GUARD : LIFE_GUARD

  useEffect(() => {
    if (!active) {
      setData(emptyLongformData())
      return
    }
    const next = normalizeLongformData(
      compass.getDraftData(active, emptyLongformData()),
    )
    setData(next)
    setMaxReached((m) => (next.step > m ? next.step : m) as LongformStep)
    setLockedMsg(false)
    setReasonDraft('')
    setPromptQ(kind === 'workview' ? '왜 일해?' : '왜 우리는 여기 있을까?')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate on snapshot switch only
  }, [active?.id, kind])

  const save = useCallback(
    async (id: string, next: LongformData) => {
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

  const patch = (p: Partial<LongformData>) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({ ...d, ...p }))
  }

  const setStep = (step: LongformStep) => {
    if (readonly) {
      setData((d) => ({ ...d, step }))
      return
    }
    patch({ step })
    setMaxReached((m) => (step > m ? step : m) as LongformStep)
  }

  const addReason = (text?: string) => {
    const t = (text ?? reasonDraft).trim()
    if (!t) return
    patch({ reasons: [...data.reasons, t] })
    setReasonDraft('')
    requestAnimationFrame(() => reasonRef.current?.focus())
  }

  const removeReason = (idx: number) => {
    patch({ reasons: data.reasons.filter((_, i) => i !== idx) })
  }

  const canGoWrite = data.reasons.length >= 5
  const canComplete =
    data.values.every((v) => v.trim().length > 0) && data.body.trim().length > 0

  const hasLife = compass.completeSnapshotsFor('lifeview').length > 0
  const hasWork = compass.completeSnapshotsFor('workview').length > 0

  const ReasonsList = ({
    allowAdd,
    compact,
  }: {
    allowAdd?: boolean
    compact?: boolean
  }) => (
    <div>
      <p
        className={`mb-2 font-semibold text-[#1C1B1A] ${compact ? 'text-[13px]' : 'text-[14px]'}`}
      >
        내가 적은 이유
      </p>
      <ul className="space-y-1.5">
        {data.reasons.map((r, i) => (
          <li
            key={`${i}-${r.slice(0, 8)}`}
            className="group flex items-start gap-2 text-[14px] text-[#8A847E]"
          >
            <span
              className="mt-1.5 h-3 w-[3px] shrink-0 rounded-full"
              style={{ background: COMPASS.line }}
            />
            <span className="min-w-0 flex-1 leading-snug">{r}</span>
            {!readonly && (
              <button
                type="button"
                className="hidden text-[12px] text-[#B5AFA8] group-hover:inline"
                onClick={() => removeReason(i)}
                aria-label="삭제"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {allowAdd && !readonly && (
        <div className="mt-3">
          <input
            type="text"
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addReason()
              }
            }}
            placeholder="+ 더 추가"
            className="w-full rounded-lg border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
          />
        </div>
      )}
    </div>
  )

  return (
    <ExerciseChrome
      exerciseKey={key}
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help={help}
      helpCadence="보통 6개월마다 다시 써."
      guideStep={longformGuideStep(data.step)}
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
      hideComplete={data.step !== 2}
      completeDisabled={!canComplete}
    >
      <LongformStepper
        step={data.step}
        maxReached={readonly ? 2 : maxReached}
        onJump={setStep}
      />

      {/* ─── Step 0: 쏟아내기 ─── */}
      {data.step === 0 && (
        <div
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 sm:p-8"
          style={{ boxShadow: cardShadow }}
        >
          <h2 className="text-[24px] font-bold text-[#1C1B1A]">{promptQ}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#8A847E]">
            잘 쓰려고 하지 마. 떠오르는 대로 10개 채우는 게 목표야.
            <br />
            유치해도 되고 서로 모순돼도 돼.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!readonly && (
              <input
                ref={reasonRef}
                type="text"
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addReason()
                  }
                }}
                placeholder="+ 하나씩 (Enter로 추가)"
                className="min-w-[200px] flex-1 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-4 py-3 text-[15px] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
              />
            )}
            <div className="text-[13px] text-[#8A847E]">
              <span className="font-semibold text-[#1C1B1A]">
                {data.reasons.length}
              </span>{' '}
              / 10
              {data.reasons.length >= 10 && (
                <span className="ml-2 text-[#B5AFA8]">충분해. 더 써도 되고.</span>
              )}
            </div>
          </div>
          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-[#ECE7E2]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (data.reasons.length / 10) * 100)}%`,
                background: COMPASS.accent,
              }}
            />
          </div>

          <ul className="mt-4 space-y-1.5">
            {data.reasons.map((r, i) => (
              <li
                key={`${i}-${r.slice(0, 10)}`}
                className="group flex h-10 items-center gap-2 rounded-lg bg-[#FAF8F6] px-3"
              >
                <span className="min-w-0 flex-1 truncate text-[15px]">{r}</span>
                {!readonly && (
                  <button
                    type="button"
                    className="hidden text-[#B5AFA8] group-hover:inline"
                    onClick={() => removeReason(i)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-[#ECE7E2] pt-5">
            <p className="mb-3 text-[13px] font-semibold text-[#8A847E]">
              ─── 다른 각도로 물어볼게
            </p>
            <div className="flex flex-wrap gap-2">
              {angles.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={readonly}
                  onClick={() => setPromptQ(chip)}
                  className="rounded-full border border-[#ECE7E2] bg-white px-3 py-1.5 text-[13px] text-[#1C1B1A] hover:border-[#A9C3B8] hover:bg-[#E8EFEB] disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {!readonly && (
            <div className="mt-8 flex flex-col items-end gap-2">
              {!canGoWrite && (
                <p className="text-[13px] text-[#B5AFA8]">
                  다섯 개는 있어야 다음이 편해
                </p>
              )}
              <button
                type="button"
                disabled={!canGoWrite}
                onClick={() => setStep(1)}
                className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
                style={{ background: COMPASS.accent }}
              >
                다음 · 쓰기 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 1: 쓰기 ─── */}
      {data.step === 1 && (
        <div className="space-y-4">
          {/* Mobile: collapsible reasons */}
          <div className="rounded-[18px] border border-[#ECE7E2] bg-white p-4 lg:hidden" style={{ boxShadow: cardShadow }}>
            <button
              type="button"
              className="flex w-full items-center justify-between text-[14px] font-semibold"
              onClick={() => setListOpenMobile((v) => !v)}
            >
              내가 적은 이유 ({data.reasons.length})
              <span>{listOpenMobile ? '▾' : '▸'}</span>
            </button>
            {listOpenMobile && (
              <div className="mt-3">
                <ReasonsList allowAdd />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_640px_280px] lg:justify-center">
            <aside className="sticky top-6 hidden self-start lg:block">
              <div
                className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                style={{ boxShadow: cardShadow }}
              >
                <ReasonsList allowAdd />
              </div>
            </aside>

            <div
              className="relative rounded-[18px] border border-[#ECE7E2] bg-white p-8 sm:p-10"
              style={{ boxShadow: cardShadow, maxWidth: 640 }}
            >
              <textarea
                ref={taRef}
                disabled={readonly}
                value={data.body}
                onChange={(e) => patch({ body: e.target.value })}
                placeholder="왼쪽 목록을 다시 읽고, 거기서 반복되는 걸 한 편의 글로 이어봐."
                rows={18}
                className="min-h-[420px] w-full resize-y border-0 bg-transparent text-[18px] leading-[1.8] tracking-[-0.01em] text-[#1C1B1A] placeholder:text-[#B5AFA8] outline-none disabled:opacity-80"
                style={{ fontFamily: SERIF }}
              />
              <div className="mt-3 flex justify-end gap-2 text-[12px] text-[#8A847E]">
                <span>{data.body.length}자</span>
                {data.body.length < 500 && (
                  <span className="text-[#B5AFA8]">· 500자쯤이면 충분</span>
                )}
              </div>
            </div>

            <aside className="space-y-4 self-start lg:sticky lg:top-6">
              <div
                className="rounded-[14px] border-l-[3px] bg-[#FAF8F6] p-4 text-[13px] leading-[1.6] whitespace-pre-line text-[#8A847E]"
                style={{ borderColor: COMPASS.accent }}
              >
                {guard}
              </div>
              <div
                className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                style={{ boxShadow: cardShadow }}
              >
                <p className="mb-2 text-[13px] font-semibold text-[#1C1B1A]">
                  다뤄볼 질문
                </p>
                <p className="mb-3 text-[12px] text-[#B5AFA8]">
                  참고용이야, 다 안 다뤄도 돼
                </p>
                <ul className="space-y-2">
                  {questions.map((q) => {
                    const checked = data.questions_checked.includes(q.id)
                    return (
                      <li key={q.id}>
                        <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[#1C1B1A]">
                          <input
                            type="checkbox"
                            disabled={readonly}
                            checked={checked}
                            onChange={() => {
                              if (readonly) {
                                setLockedMsg(true)
                                return
                              }
                              const next = checked
                                ? data.questions_checked.filter((id) => id !== q.id)
                                : [...data.questions_checked, q.id]
                              patch({ questions_checked: next })
                            }}
                            className="mt-0.5 accent-[#3E6B5E]"
                          />
                          <span>{q.label}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </aside>
          </div>

          {!readonly && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="h-12 rounded-full px-7 text-[14px] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
                style={{ background: COMPASS.accent }}
              >
                다음 · 가치 뽑기 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 2: 가치 뽑기 ─── */}
      {data.step === 2 && (
        <div
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 sm:p-8"
          style={{ boxShadow: cardShadow }}
        >
          <h2 className="text-[22px] font-bold leading-snug text-[#1C1B1A]">
            방금 쓴 글을 다시 읽고, 여기서 제일 크게 나온 값 3개를 뽑아봐.
          </h2>

          <button
            type="button"
            onClick={() => setBodyOpen((v) => !v)}
            className="mt-5 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-4 py-3 text-left text-[13px] text-[#8A847E]"
          >
            {bodyOpen ? '▾ 본문 접기' : '▸ 본문 다시 보기'}
          </button>
          {bodyOpen && (
            <div
              className="mt-2 whitespace-pre-wrap rounded-xl border border-[#ECE7E2] bg-white p-5 text-[16px] leading-[1.8] text-[#1C1B1A]"
              style={{ fontFamily: SERIF }}
            >
              {data.body || '—'}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-[15px] font-semibold text-[#8A847E]">
                  {i + 1}.
                </span>
                <input
                  type="text"
                  disabled={readonly}
                  value={data.values[i]}
                  onChange={(e) => {
                    if (readonly) {
                      setLockedMsg(true)
                      return
                    }
                    const values = [...data.values] as [string, string, string]
                    values[i] = e.target.value
                    patch({ values })
                  }}
                  placeholder="가치 한 줄"
                  className="flex-1 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-70"
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-[15px] text-[#8A847E]">
            이 세 개가 앞으로 뭘 고를 때 기준이 돼.
          </p>

          {readonly && onOpenExercise && (
            <div className="mt-8 border-t border-[#ECE7E2] pt-5">
              {kind === 'workview' && !hasLife && (
                <p className="text-[15px] text-[#8A847E]">
                  삶 관점도 쓰면 두 개를 맞춰볼 수 있어.{' '}
                  <button
                    type="button"
                    className="font-semibold"
                    style={{ color: COMPASS.accent }}
                    onClick={() => onOpenExercise('lifeview')}
                  >
                    삶 관점 쓰러 가기
                  </button>
                </p>
              )}
              {kind === 'lifeview' && hasWork && (
                <p className="text-[15px] text-[#8A847E]">
                  일 관점도 있으면 두 개를 맞춰볼 수 있어.{' '}
                  <button
                    type="button"
                    className="font-semibold"
                    style={{ color: COMPASS.accent }}
                    onClick={() => onOpenExercise('coherence')}
                  >
                    두 관점 맞춰보기
                  </button>
                </p>
              )}
              {kind === 'lifeview' && !hasWork && (
                <p className="text-[15px] text-[#8A847E]">
                  일 관점도 쓰면 두 개를 맞춰볼 수 있어.{' '}
                  <button
                    type="button"
                    className="font-semibold"
                    style={{ color: COMPASS.accent }}
                    onClick={() => onOpenExercise('workview')}
                  >
                    일 관점 쓰러 가기
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </ExerciseChrome>
  )
}
