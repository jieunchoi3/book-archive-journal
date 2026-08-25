import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  COHERENCE_MARK_COLOR,
  COHERENCE_MARK_LABEL,
  COMPASS,
  emptyCoherenceData,
  formatYm,
  newId,
  normalizeCoherenceData,
  normalizeLongformData,
  type CoherenceData,
  type CoherenceDriveDirection,
  type CoherenceMark,
  type CoherenceMarkKind,
  type CoherenceStep,
  type LdSnapshot,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  CompassExerciseHeader,
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

const STEP_LABELS = ['다시 읽기', '세 질문', '나침반'] as const

const HELP = `일 관점이랑 삶 관점을 나란히 놓고, 세 가지만 물어보는 거야.
어디서 서로 보완하는지, 어디서 부딪히는지, 하나가 다른 하나를 이끌고 있는지.

부딪히는 걸 없애는 게 목표가 아니야. 어디인지 아는 게 목표야.
둘이 대충이라도 맞물리면, 내가 누구인지 · 뭘 믿는지 · 뭘 하는지가 한 줄로 서기 시작해.

이걸 마치면 네 나침반이 생겨. 뭘 고를 일이 있을 때 꺼내 보는 것.
보통 1년에 한 번 다시 써.`

const PLACEHOLDERS = {
  complement: '표시한 것 중 [보완]로 묶은 것부터 풀어써봐.',
  clash: '모순이 있다는 게 문제는 아니야. 그냥 어디인지 적어봐.',
  drives: '보통 한쪽이 조용히 다른 쪽을 정하고 있어. 어느 쪽이야?',
} as const

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'] as const

type Side = 'work' | 'life'

interface Sentence {
  id: string
  text: string
}

function splitSentences(body: string, prefix: 'w' | 'l'): Sentence[] {
  const raw: string[] = []
  let buf = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    buf += ch
    if (ch === '.' || ch === '?' || ch === '!' || ch === '\n') {
      const t = buf.replace(/\n/g, ' ').trim()
      if (t) raw.push(t)
      buf = ''
    }
  }
  const tail = buf.replace(/\n/g, ' ').trim()
  if (tail) raw.push(tail)

  const merged: string[] = []
  for (const s of raw) {
    if (!s) continue
    if (
      merged.length > 0 &&
      (s.length < 15 || merged[merged.length - 1].length < 15)
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${s}`
    } else {
      merged.push(s)
    }
  }

  return merged.map((text, i) => ({ id: `${prefix}-${i}`, text }))
}

function excerpt(text: string, max = 48) {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  minHeight = 140,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  minHeight?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`
  }, [value, minHeight])
  return (
    <textarea
      ref={ref}
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-2xl border border-[#ECE7E2] bg-white px-4 py-3 text-[16px] leading-[1.7] text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-70"
      style={{ minHeight }}
    />
  )
}

function StepRail({
  step,
  maxReached,
  onJump,
}: {
  step: CoherenceStep
  maxReached: CoherenceStep
  onJump: (s: CoherenceStep) => void
}) {
  return (
    <div className="mb-5 flex items-center gap-0 overflow-x-auto px-1">
      {STEP_LABELS.map((label, i) => {
        const s = i as CoherenceStep
        const done = s < step
        const current = s === step
        const locked = s > maxReached
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className="mx-1 h-px w-6 sm:w-10"
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
                className="whitespace-nowrap text-[11px] font-medium"
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

function MarkBadge({ kind }: { kind: CoherenceMarkKind }) {
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: COHERENCE_MARK_COLOR[kind] }}
    >
      {COHERENCE_MARK_LABEL[kind]}
    </span>
  )
}

function drivesArrow(direction: CoherenceDriveDirection | null) {
  if (direction === 'work_to_life') return ' →'
  if (direction === 'life_to_work') return ' ←'
  return ''
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
  const [maxReached, setMaxReached] = useState<CoherenceStep>(0)

  const workCompletes = compass.completeSnapshotsFor('workview')
  const lifeCompletes = compass.completeSnapshotsFor('lifeview')
  const hasBoth = workCompletes.length > 0 && lifeCompletes.length > 0

  const workSnap =
    workCompletes.find((s) => s.id === data.source.workview_id) ??
    workCompletes[workCompletes.length - 1] ??
    null
  const lifeSnap =
    lifeCompletes.find((s) => s.id === data.source.lifeview_id) ??
    lifeCompletes[lifeCompletes.length - 1] ??
    null

  const workBody = workSnap
    ? normalizeLongformData(workSnap.data).body
    : ''
  const lifeBody = lifeSnap
    ? normalizeLongformData(lifeSnap.data).body
    : ''
  const workValues = workSnap
    ? normalizeLongformData(workSnap.data).values.filter(Boolean)
    : data.values_snapshot.work
  const lifeValues = lifeSnap
    ? normalizeLongformData(lifeSnap.data).values.filter(Boolean)
    : data.values_snapshot.life

  const workSentences = useMemo(
    () => splitSentences(workBody, 'w'),
    [workBody],
  )
  const lifeSentences = useMemo(
    () => splitSentences(lifeBody, 'l'),
    [lifeBody],
  )

  // Selection / mark UI
  const [pending, setPending] = useState<{ side: Side; sid: string } | null>(
    null,
  )
  const [pairReady, setPairReady] = useState<{
    work_sid: string
    life_sid: string
  } | null>(null)
  const [kindPick, setKindPick] = useState<CoherenceMarkKind | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [flashIds, setFlashIds] = useState<string[]>([])
  const [sourceModal, setSourceModal] = useState(false)
  const [markModal, setMarkModal] = useState<CoherenceMark | null>(null)
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024,
  )

  const sentenceRefs = useRef<Map<string, HTMLElement>>(new Map())
  const columnsRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<
    { id: string; d: string; color: string }[]
  >([])

  const latestWorkId = workCompletes[workCompletes.length - 1]?.id
  const latestLifeId = lifeCompletes[lifeCompletes.length - 1]?.id

  useEffect(() => {
    if (!active) {
      setData(emptyCoherenceData())
      return
    }
    let next = normalizeCoherenceData(
      compass.getDraftData(active, emptyCoherenceData()),
    )

    const latestW = compass.completeSnapshotsFor('workview').at(-1)
    const latestL = compass.completeSnapshotsFor('lifeview').at(-1)
    if (latestW && latestL) {
      if (!next.source.workview_id || !next.source.lifeview_id) {
        const wv = normalizeLongformData(latestW.data)
        const lv = normalizeLongformData(latestL.data)
        next = {
          ...next,
          source: {
            workview_id: latestW.id,
            workview_date: latestW.takenAt,
            lifeview_id: latestL.id,
            lifeview_date: latestL.takenAt,
          },
          values_snapshot: {
            work: wv.values.filter(Boolean),
            life: lv.values.filter(Boolean),
          },
        }
      }
    }

    if (readonly) {
      next = { ...next, step: 2 }
    }

    setData(next)
    setMaxReached((m) => (next.step > m ? next.step : m) as CoherenceStep)
    setLockedMsg(false)
    setPending(null)
    setPairReady(null)
    setKindPick(null)
  }, [active, compass, readonly, latestWorkId, latestLifeId])

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPending(null)
        setPairReady(null)
        setKindPick(null)
        setPopoverPos(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    Boolean(active && !readonly && hasBoth),
  )

  const patchAnswer = (
    key: 'complement' | 'clash' | 'drives',
    value: string,
  ) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({
      ...d,
      answers: { ...d.answers, [key]: value },
    }))
  }

  const freezeValues = (d: CoherenceData): CoherenceData => ({
    ...d,
    values_snapshot: {
      work: workValues.length ? workValues : d.values_snapshot.work,
      life: lifeValues.length ? lifeValues : d.values_snapshot.life,
    },
  })

  const setStep = (step: CoherenceStep) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => {
      const next =
        step === 2
          ? { ...freezeValues(d), step }
          : { ...d, step }
      return next
    })
    setMaxReached((m) => (step > m ? step : m) as CoherenceStep)
  }

  const setSource = (side: Side, snap: LdSnapshot) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    const lf = normalizeLongformData(snap.data)
    setData((d) => ({
      ...d,
      source: {
        ...d.source,
        ...(side === 'work'
          ? {
              workview_id: snap.id,
              workview_date: snap.takenAt,
            }
          : {
              lifeview_id: snap.id,
              lifeview_date: snap.takenAt,
            }),
      },
      values_snapshot: {
        ...d.values_snapshot,
        [side === 'work' ? 'work' : 'life']: lf.values.filter(Boolean),
      },
      marks: [],
    }))
    setPending(null)
    setPairReady(null)
  }

  const addMark = (
    kind: CoherenceMarkKind,
    direction: CoherenceDriveDirection | null,
  ) => {
    if (!pairReady || readonly) return
    const w = workSentences.find((s) => s.id === pairReady.work_sid)
    const l = lifeSentences.find((s) => s.id === pairReady.life_sid)
    if (!w || !l) return
    const mark: CoherenceMark = {
      id: newId(),
      kind,
      work_sid: w.id,
      life_sid: l.id,
      work_text: w.text,
      life_text: l.text,
      direction: kind === 'drives' ? direction : null,
    }
    setData((d) => ({ ...d, marks: [...d.marks, mark] }))
    setPending(null)
    setPairReady(null)
    setKindPick(null)
    setPopoverPos(null)
  }

  const removeMark = (id: string) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({ ...d, marks: d.marks.filter((m) => m.id !== id) }))
  }

  const onSentenceClick = (
    side: Side,
    sid: string,
    e: ReactMouseEvent,
  ) => {
    if (readonly || data.step !== 0) return
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    }

    if (!pending) {
      setPending({ side, sid })
      setPairReady(null)
      setKindPick(null)
      return
    }

    if (pending.side === side) {
      setPending({ side, sid })
      setPairReady(null)
      setKindPick(null)
      return
    }

    const work_sid = side === 'work' ? sid : pending.sid
    const life_sid = side === 'life' ? sid : pending.sid
    setPairReady({ work_sid, life_sid })
    setKindPick(null)
    setPopoverPos(pos)
  }

  const markForSid = (sid: string) =>
    data.marks.find((m) => m.work_sid === sid || m.life_sid === sid)

  const markIndex = (m: CoherenceMark) =>
    data.marks.findIndex((x) => x.id === m.id)

  // SVG lines (desktop)
  const recomputeLines = useCallback(() => {
    if (!wide || data.step !== 0) {
      setLines([])
      return
    }
    const root = columnsRef.current
    if (!root) return
    const rootRect = root.getBoundingClientRect()
    const next: { id: string; d: string; color: string }[] = []
    for (const m of data.marks) {
      const a = sentenceRefs.current.get(m.work_sid)
      const b = sentenceRefs.current.get(m.life_sid)
      if (!a || !b) continue
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const x1 = ra.right - rootRect.left
      const y1 = ra.top + ra.height / 2 - rootRect.top
      const x2 = rb.left - rootRect.left
      const y2 = rb.top + rb.height / 2 - rootRect.top
      const c1 = x1 + 60
      const c2 = x2 - 60
      next.push({
        id: m.id,
        d: `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`,
        color: COHERENCE_MARK_COLOR[m.kind],
      })
    }
    setLines(next)
  }, [wide, data.marks, data.step])

  useEffect(() => {
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(recomputeLines)
    }
    schedule()
    window.addEventListener('resize', schedule)
    const root = columnsRef.current
    root?.addEventListener('scroll', schedule, true)
    document.addEventListener('scroll', schedule, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      root?.removeEventListener('scroll', schedule, true)
      document.removeEventListener('scroll', schedule, true)
    }
  }, [recomputeLines, workSentences, lifeSentences])

  const flashMark = (m: CoherenceMark) => {
    setFlashIds([m.work_sid, m.life_sid])
    window.setTimeout(() => setFlashIds([]), 900)
    const el = sentenceRefs.current.get(m.work_sid)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const canGoQuestions = data.marks.length >= 2
  const canGoCompass =
    data.answers.complement.trim().length > 0 &&
    data.answers.clash.trim().length > 0 &&
    data.answers.drives.trim().length > 0

  // ─── Gate ───
  if (!hasBoth) {
    const w = workCompletes[workCompletes.length - 1]
    const l = lifeCompletes[lifeCompletes.length - 1]
    return (
      <div>
        <CompassExerciseHeader
          title="두 관점 맞춰보기"
          subtitle="보완 · 충돌 · 이끎으로 나침반 만들기"
        />
        <div
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-6"
          style={{ boxShadow: cardShadow }}
        >
          <p className="mb-4 text-[15px] text-[#1C1B1A]">
            두 관점이 다 있어야 맞춰볼 수 있어.
          </p>
          <ul className="space-y-3 text-[14px]">
            <li className="flex flex-wrap items-center gap-2">
              <span>{w ? '☑' : '☐'}</span>
              <span>
                일 관점
                {w ? ` · ${formatYm(w.takenAt)}` : ' — 아직 안 썼어'}
              </span>
              {!w && (
                <button
                  type="button"
                  className="ml-auto rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{ background: COMPASS.accent }}
                  onClick={() => onOpenExercise('workview')}
                >
                  일 관점 쓰러 가기
                </button>
              )}
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span>{l ? '☑' : '☐'}</span>
              <span>
                삶 관점
                {l ? ` · ${formatYm(l.takenAt)}` : ' — 아직 안 썼어'}
              </span>
              {!l && (
                <button
                  type="button"
                  className="ml-auto rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{ background: COMPASS.accent }}
                  onClick={() => onOpenExercise('lifeview')}
                >
                  삶 관점 쓰러 가기
                </button>
              )}
            </li>
          </ul>
        </div>
      </div>
    )
  }

  const underlineStyle = (sid: string): React.CSSProperties | undefined => {
    const m = markForSid(sid)
    if (!m) return undefined
    return {
      textDecorationLine: 'underline',
      textDecorationThickness: 2,
      textDecorationColor: COHERENCE_MARK_COLOR[m.kind],
      textUnderlineOffset: 4,
    }
  }

  const renderSentenceColumn = (side: Side, sentences: Sentence[], title: string, date: string) => (
    <div
      className="min-h-[200px] rounded-[18px] border border-[#ECE7E2] bg-white p-4 sm:p-5"
      style={{ boxShadow: cardShadow }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-[#1C1B1A]">
          {title} · {formatYm(date)}
        </h3>
      </div>
      <div className="space-y-1 text-[15px] leading-relaxed text-[#1C1B1A]">
        {sentences.map((s) => {
          const selected = pending?.side === side && pending.sid === s.id
          const inPair =
            pairReady &&
            ((side === 'work' && pairReady.work_sid === s.id) ||
              (side === 'life' && pairReady.life_sid === s.id))
          const m = markForSid(s.id)
          const idx = m ? markIndex(m) : -1
          const flashing = flashIds.includes(s.id)
          return (
            <span
              key={s.id}
              data-sid={s.id}
              ref={(el) => {
                if (el) sentenceRefs.current.set(s.id, el)
                else sentenceRefs.current.delete(s.id)
              }}
              role={data.step === 0 && !readonly ? 'button' : undefined}
              tabIndex={data.step === 0 && !readonly ? 0 : undefined}
              onClick={(e) => onSentenceClick(side, s.id, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSentenceClick(side, s.id, e as unknown as ReactMouseEvent)
                }
              }}
              className="group relative mr-1 inline rounded-sm transition-colors"
              style={{
                ...underlineStyle(s.id),
                background: flashing
                  ? `${COMPASS.accent}33`
                  : selected || inPair
                    ? COMPASS.soft
                    : undefined,
                boxShadow:
                  selected || inPair
                    ? `inset 3px 0 0 ${COMPASS.accent}`
                    : undefined,
                paddingLeft: selected || inPair ? 6 : undefined,
                cursor: data.step === 0 && !readonly ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (data.step !== 0 || readonly) return
                if (!selected && !inPair) {
                  ;(e.currentTarget as HTMLElement).style.background = '#FAF8F6'
                }
              }}
              onMouseLeave={(e) => {
                if (flashing || selected || inPair) return
                ;(e.currentTarget as HTMLElement).style.background = ''
              }}
            >
              {s.text}
              {m?.kind === 'drives' &&
                ((side === 'work' && m.direction === 'work_to_life') ||
                  (side === 'life' && m.direction === 'life_to_work')) && (
                  <span aria-hidden>{drivesArrow(m.direction)}</span>
                )}
              {!wide && idx >= 0 && (
                <span
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{
                    background: COHERENCE_MARK_COLOR[m!.kind],
                    color: '#fff',
                  }}
                >
                  {CIRCLED[idx] ?? String(idx + 1)}
                </span>
              )}
              {data.step === 0 && !readonly && (
                <span
                  className="ml-0.5 inline-block text-[11px] text-[#B5AFA8] opacity-0 group-hover:opacity-100"
                  aria-hidden
                >
                  ▸
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )

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
      help={HELP}
      helpCadence="보통 1년에 한 번 다시 써"
      lockedMsg={lockedMsg}
      onDismissLock={() => setLockedMsg(false)}
      hideComplete={data.step !== 2}
      onComplete={() => {
        if (!active || !canGoCompass) return
        const frozen = freezeValues({ ...data, step: 2 })
        void (async () => {
          await compass.updateDraftData(
            active.id,
            frozen as unknown as Record<string, unknown>,
          )
          await compass.completeSnapshot(active.id)
        })()
      }}
      completeLabel="완료하기"
      completeDisabled={!canGoCompass}
    >
      {!readonly && (
        <StepRail step={data.step} maxReached={maxReached} onJump={setStep} />
      )}

      {/* Version selectors */}
      <div className="mb-4 flex flex-wrap gap-3 text-[13px] text-[#8A847E]">
        <label className="flex items-center gap-1.5">
          일 관점
          <select
            disabled={readonly}
            value={data.source.workview_id || workSnap?.id || ''}
            onChange={(e) => {
              const s = workCompletes.find((x) => x.id === e.target.value)
              if (s) setSource('work', s)
            }}
            className="rounded-lg border border-[#ECE7E2] bg-white px-2 py-1 text-[13px] text-[#1C1B1A]"
          >
            {workCompletes.map((s) => (
              <option key={s.id} value={s.id}>
                {formatYm(s.takenAt)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          삶 관점
          <select
            disabled={readonly}
            value={data.source.lifeview_id || lifeSnap?.id || ''}
            onChange={(e) => {
              const s = lifeCompletes.find((x) => x.id === e.target.value)
              if (s) setSource('life', s)
            }}
            className="rounded-lg border border-[#ECE7E2] bg-white px-2 py-1 text-[13px] text-[#1C1B1A]"
          >
            {lifeCompletes.map((s) => (
              <option key={s.id} value={s.id}>
                {formatYm(s.takenAt)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ─── Step 0: mark ─── */}
      {data.step === 0 && (
        <div
          onClick={() => {
            setPending(null)
            setPairReady(null)
            setKindPick(null)
            setPopoverPos(null)
          }}
        >
          <div
            ref={columnsRef}
            className="relative grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            {wide && lines.length > 0 && (
              <svg
                className="pointer-events-none absolute inset-0 z-[1] hidden lg:block"
                width="100%"
                height="100%"
                aria-hidden
              >
                {lines.map((ln) => (
                  <path
                    key={ln.id}
                    d={ln.d}
                    fill="none"
                    stroke={ln.color}
                    strokeWidth={1.5}
                    opacity={0.5}
                  />
                ))}
              </svg>
            )}
            {renderSentenceColumn(
              'work',
              workSentences,
              '일 관점',
              workSnap?.takenAt ?? data.source.workview_date,
            )}
            {renderSentenceColumn(
              'life',
              lifeSentences,
              '삶 관점',
              lifeSnap?.takenAt ?? data.source.lifeview_date,
            )}
          </div>

          {/* Kind / direction popover */}
          {pairReady && popoverPos && !readonly && (
            <div
              className="fixed z-50 rounded-2xl border border-[#ECE7E2] bg-white p-3 shadow-lg"
              style={{
                left: Math.min(popoverPos.x, window.innerWidth - 220),
                top: popoverPos.y,
                transform: 'translateX(-50%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {!kindPick ? (
                <div className="flex gap-2">
                  {(['complement', 'clash', 'drives'] as CoherenceMarkKind[]).map(
                    (k) => (
                      <button
                        key={k}
                        type="button"
                        className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white"
                        style={{ background: COHERENCE_MARK_COLOR[k] }}
                        onClick={() => {
                          if (k === 'drives') setKindPick('drives')
                          else addMark(k, null)
                        }}
                      >
                        [{COHERENCE_MARK_LABEL[k]}]
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white"
                    style={{ background: COHERENCE_MARK_COLOR.drives }}
                    onClick={() => addMark('drives', 'work_to_life')}
                  >
                    일 → 삶
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-white"
                    style={{ background: COHERENCE_MARK_COLOR.drives }}
                    onClick={() => addMark('drives', 'life_to_work')}
                  >
                    삶 → 일
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
            <p className="mb-2 text-[13px] font-semibold text-[#8A847E]">
              표시한 것 ({data.marks.length})
            </p>
            {data.marks.length === 0 ? (
              <p className="text-[13px] text-[#B5AFA8]">
                문장을 하나씩 탭해서 표시를 남겨봐.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.marks.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-xl border border-[#ECE7E2] bg-white px-3 py-2.5 text-left"
                      style={{ boxShadow: cardShadow }}
                      onClick={(e) => {
                        e.stopPropagation()
                        flashMark(m)
                      }}
                    >
                      <MarkBadge kind={m.kind} />
                      <span className="min-w-0 flex-1 text-[13px] text-[#1C1B1A]">
                        <span className="line-clamp-2">
                          {m.kind === 'drives' ? (
                            <>
                              {m.direction === 'life_to_work'
                                ? excerpt(m.life_text)
                                : excerpt(m.work_text)}{' '}
                              →{' '}
                              {m.direction === 'life_to_work'
                                ? excerpt(m.work_text)
                                : excerpt(m.life_text)}
                            </>
                          ) : (
                            <>
                              {excerpt(m.work_text)} ↔ {excerpt(m.life_text)}
                            </>
                          )}
                        </span>
                      </span>
                      {!readonly && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="shrink-0 text-[12px] text-[#B5AFA8]"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeMark(m.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                              removeMark(m.id)
                            }
                          }}
                        >
                          삭제
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!readonly && (
            <div className="mt-8 flex flex-col items-end gap-2">
              {!canGoQuestions && (
                <p className="text-[13px] text-[#B5AFA8]">
                  두 군데만 표시해도 다음이 훨씬 쉬워져
                </p>
              )}
              <button
                type="button"
                disabled={!canGoQuestions}
                onClick={() => setStep(1)}
                className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: COMPASS.accent }}
              >
                다음 · 세 질문 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 1: three questions ─── */}
      {data.step === 1 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <div
              className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="mb-3 text-[13px] font-semibold text-[#8A847E]">
                내가 표시한 것
              </p>
              <ul className="space-y-2">
                {data.marks.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left text-[13px]"
                      onClick={() => setMarkModal(m)}
                    >
                      <MarkBadge kind={m.kind} />
                      <span className="min-w-0 text-[#1C1B1A]">
                        <span className="line-clamp-2">
                          {excerpt(m.work_text, 36)} ↔ {excerpt(m.life_text, 36)}
                        </span>
                        {m.kind === 'drives' && m.direction && (
                          <span className="mt-0.5 block text-[12px] text-[#8A847E]">
                            {m.direction === 'work_to_life'
                              ? '일 → 삶'
                              : '삶 → 일'}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <hr className="my-4 border-[#ECE7E2]" />
              <p className="mb-2 text-[13px] font-semibold text-[#8A847E]">
                뽑아둔 가치
              </p>
              <p className="mb-1 text-[12px] text-[#B5AFA8]">일</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(workValues.length ? workValues : data.values_snapshot.work).map(
                  (v) => (
                    <span
                      key={`w-${v}`}
                      className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                      style={{ background: COMPASS.soft, color: COMPASS.ink }}
                    >
                      {v}
                    </span>
                  ),
                )}
              </div>
              <p className="mb-1 text-[12px] text-[#B5AFA8]">삶</p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {(lifeValues.length ? lifeValues : data.values_snapshot.life).map(
                  (v) => (
                    <span
                      key={`l-${v}`}
                      className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                      style={{ background: COMPASS.soft, color: COMPASS.ink }}
                    >
                      {v}
                    </span>
                  ),
                )}
              </div>
              <button
                type="button"
                className="text-[13px] font-semibold"
                style={{ color: COMPASS.accent }}
                onClick={() => setSourceModal(true)}
              >
                원문 다시 보기
              </button>
            </div>
          </aside>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-[15px] font-semibold text-[#1C1B1A]">
                두 관점이 어디서 서로 보완해?
              </label>
              <AutoGrowTextarea
                disabled={readonly}
                value={data.answers.complement}
                placeholder={PLACEHOLDERS.complement}
                onChange={(v) => patchAnswer('complement', v)}
              />
            </div>
            <div>
              <label className="mb-2 block text-[15px] font-semibold text-[#1C1B1A]">
                어디서 부딪혀?
              </label>
              <AutoGrowTextarea
                disabled={readonly}
                value={data.answers.clash}
                placeholder={PLACEHOLDERS.clash}
                onChange={(v) => patchAnswer('clash', v)}
              />
              <p className="mt-2 text-[13px] leading-relaxed text-[#8A847E]">
                부딪히는 게 잘못된 건 아니야. 일관되게 산다는 건 모든 게
                정돈됐다는 뜻이 아니라, 네 기준에 맞게 살고 있다는 뜻이야.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-[15px] font-semibold text-[#1C1B1A]">
                하나가 다른 하나를 이끌고 있어? 어떻게?
              </label>
              <AutoGrowTextarea
                disabled={readonly}
                value={data.answers.drives}
                placeholder={PLACEHOLDERS.drives}
                onChange={(v) => patchAnswer('drives', v)}
              />
            </div>

            {!readonly && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!canGoCompass}
                  onClick={() => setStep(2)}
                  className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
                  style={{ background: COMPASS.accent }}
                >
                  다음 · 나침반 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Step 2: compass card ─── */}
      {data.step === 2 && (
        <CompassResultCard
          data={data}
          workBody={workBody}
          lifeBody={lifeBody}
          workValues={
            data.values_snapshot.work.length
              ? data.values_snapshot.work
              : workValues
          }
          lifeValues={
            data.values_snapshot.life.length
              ? data.values_snapshot.life
              : lifeValues
          }
          dateLabel={
            active?.takenAt
              ? formatYm(active.takenAt)
              : formatYm(new Date().toISOString().slice(0, 10))
          }
        />
      )}

      {sourceModal && (
        <Modal onClose={() => setSourceModal(false)} title="원문">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-[13px] font-semibold text-[#8A847E]">
                일 관점
              </h4>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C1B1A]">
                {workBody}
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-[13px] font-semibold text-[#8A847E]">
                삶 관점
              </h4>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C1B1A]">
                {lifeBody}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {markModal && (
        <Modal onClose={() => setMarkModal(null)} title="표시한 문장">
          <div className="mb-3">
            <MarkBadge kind={markModal.kind} />
          </div>
          <p className="mb-2 text-[14px] text-[#1C1B1A]">{markModal.work_text}</p>
          <p className="text-[14px] text-[#1C1B1A]">{markModal.life_text}</p>
        </Modal>
      )}
    </ExerciseChrome>
  )
}

function CompassResultCard({
  data,
  workBody,
  lifeBody,
  workValues,
  lifeValues,
  dateLabel,
}: {
  data: CoherenceData
  workBody: string
  lifeBody: string
  workValues: string[]
  lifeValues: string[]
  dateLabel: string
}) {
  const [full, setFull] = useState<'work' | 'life' | null>(null)
  return (
    <div
      className="mx-auto max-w-xl rounded-[22px] border border-[#ECE7E2] bg-white px-6 py-8 sm:px-10"
      style={{ boxShadow: cardShadow }}
    >
      <div className="text-center">
        <p className="text-[28px]" aria-hidden>
          🧭
        </p>
        <h2 className="mt-1 text-[22px] font-bold text-[#1C1B1A]">네 나침반</h2>
        <p className="mt-1 text-[13px] text-[#8A847E]">{dateLabel} 기준</p>
      </div>

      <section className="mt-8">
        <h3 className="text-[13px] font-semibold text-[#8A847E]">일 관점</h3>
        <p className="mt-1 text-[14px] font-medium text-[#1C1B1A]">
          {workValues.filter(Boolean).join(' · ') || '—'}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#1C1B1A]">
          “{excerpt(workBody || data.marks[0]?.work_text || '', 60)}”
          <button
            type="button"
            className="ml-2 text-[12px] font-semibold"
            style={{ color: COMPASS.accent }}
            onClick={() => setFull('work')}
          >
            전문
          </button>
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-[13px] font-semibold text-[#8A847E]">삶 관점</h3>
        <p className="mt-1 text-[14px] font-medium text-[#1C1B1A]">
          {lifeValues.filter(Boolean).join(' · ') || '—'}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#1C1B1A]">
          “{excerpt(lifeBody || data.marks[0]?.life_text || '', 60)}”
          <button
            type="button"
            className="ml-2 text-[12px] font-semibold"
            style={{ color: COMPASS.accent }}
            onClick={() => setFull('life')}
          >
            전문
          </button>
        </p>
      </section>

      <hr className="my-6 border-[#ECE7E2]" />

      {(
        [
          ['complement', '보완', data.answers.complement],
          ['clash', '충돌', data.answers.clash],
          ['drives', '이끎', data.answers.drives],
        ] as const
      ).map(([key, label, text]) => (
        <div key={key} className="mb-4">
          <p className="text-[12px] font-semibold text-[#8A847E]">{label}</p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-[#1C1B1A]">
            {text || '—'}
          </p>
        </div>
      ))}

      <p className="mt-6 text-center text-[13px] leading-relaxed text-[#8A847E]">
        뭘 고를 일이 생기면 이걸 다시 봐.
        <br />
        보통 1년에 한 번은 다시 써.
      </p>

      {full && (
        <Modal
          onClose={() => setFull(null)}
          title={full === 'work' ? '일 관점 전문' : '삶 관점 전문'}
        >
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C1B1A]">
            {full === 'work' ? workBody : lifeBody}
          </p>
        </Modal>
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-[18px] bg-white p-5"
        style={{ boxShadow: cardShadow }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-semibold text-[#1C1B1A]">{title}</h3>
          <button
            type="button"
            className="text-[13px] text-[#8A847E]"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
