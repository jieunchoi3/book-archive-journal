import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Zap } from 'lucide-react'
import { CompassBipolarSlider } from './CompassBipolarSlider'
import {
  COMPASS,
  JOURNAL_DURATION_LABELS,
  JOURNAL_DURATIONS,
  addDays,
  daysBetween,
  emptyAeiou,
  emptyGoodtimeRunData,
  formatYm,
  goodtimeWeekForDate,
  goodtimeWeekRange,
  normalizeGoodtimeRunData,
  todayKey,
  type AeiouData,
  type GoodtimeRunData,
  type GoodtimeState,
  type GoodtimeWeeklyReview,
  type JournalDuration,
  type LdJournalEntry,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  CompassExerciseHeader,
  cardShadow,
  useDebouncedDraftSave,
  useExerciseSnapshot,
} from './CompassExerciseShell'

interface CompassGoodtimeProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onOpenMindmap?: () => void
}

const HELP = `3주 동안 하루에 뭘 했는지, 그때 얼마나 빠져들었고 기운이 어땠는지 적는 거야.

두 개를 따로 본다: 몰입(빠져들었나)이랑 에너지(기운이 찼나 빠졌나).
보통 같이 가지만, 빠져들면서도 진 빠지는 일이 있어. 그런 게 제일 중요한 단서야.

매주 끝에 한 번씩 돌아보고, 3주 뒤에 제일 걸리는 것들을 확대해서 뜯어봐.
완벽하게 다 적을 필요 없어. 하루 3~5개면 충분해.`

const AEIOU_FIELDS: {
  key: keyof AeiouData
  label: string
  prompt: string
}[] = [
  {
    key: 'activities',
    label: 'Activities',
    prompt:
      '그때 실제로 뭘 하고 있었어?\n짜여 있는 일이었어, 아니면 자유로운 거였어?\n무슨 역할이었어 — 이끄는 쪽? 그냥 끼어 있는 쪽?',
  },
  {
    key: 'environments',
    label: 'Environments',
    prompt:
      '어디였어? 어떤 공간이었고, 그 공간이 기분을 어떻게 만들었어?',
  },
  {
    key: 'interactions',
    label: 'Interactions',
    prompt:
      '뭐랑 주고받고 있었어 — 사람? 기계?\n익숙한 방식이었어, 처음 해보는 거였어?',
  },
  {
    key: 'objects',
    label: 'Objects',
    prompt:
      '뭘 만지거나 다루고 있었어?\n그중에 몰입을 만들어준 게 있었어?',
  },
  {
    key: 'users',
    label: 'Users',
    prompt: '또 누가 있었어? 그 사람들은 어떤 역할이었어?',
  },
]

const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const

type Tab = '기록' | '패턴' | '회고' | '줌인' | 'AEIOU' | '정리'

function formatDayLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()} (${DOW[d.getDay()]})`
}

function entriesForRun(all: LdJournalEntry[], runId: string | undefined) {
  if (!runId) return []
  return all.filter((e) => e.runId === runId)
}

function weekEntries(
  entries: LdJournalEntry[],
  startedOn: string,
  week: 1 | 2 | 3,
) {
  const [a, b] = goodtimeWeekRange(startedOn, week)
  return entries.filter((e) => e.entryDate >= a && e.entryDate <= b)
}

function aggregateActivities(list: LdJournalEntry[]) {
  const map = new Map<
    string,
    {
      label: string
      eng: number
      ene: number
      n: number
      minutes: number
      flow: boolean
    }
  >()
  for (const e of list) {
    const k = e.activity.trim().toLowerCase()
    if (!k) continue
    const prev = map.get(k)
    if (!prev) {
      map.set(k, {
        label: e.activity.trim(),
        eng: e.engagement,
        ene: e.energy,
        n: 1,
        minutes: e.durationMin,
        flow: e.isFlow,
      })
    } else {
      map.set(k, {
        label: prev.label,
        eng: prev.eng + e.engagement,
        ene: prev.ene + e.energy,
        n: prev.n + 1,
        minutes: prev.minutes + e.durationMin,
        flow: prev.flow || e.isFlow,
      })
    }
  }
  return [...map.values()].map((v) => ({
    label: v.label,
    x: v.eng / v.n,
    y: v.ene / v.n,
    n: v.n,
    minutes: v.minutes,
    flow: v.flow,
  }))
}

function reviewBuckets(list: LdJournalEntry[]) {
  const high = [...list]
    .filter((e) => e.engagement >= 2)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 8)
  const low = [...list]
    .filter((e) => e.engagement <= -1)
    .sort((a, b) => a.engagement - b.engagement)
    .slice(0, 8)
  const drained = list.filter((e) => e.engagement >= 2 && e.energy <= -1)
  const days = new Set(list.map((e) => e.entryDate)).size
  return { high, low, drained, days, total: list.length }
}

function AutoGrow({
  value,
  onChange,
  placeholder,
  disabled,
  minHeight = 120,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
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
      className="w-full resize-none rounded-2xl border border-[#ECE7E2] bg-white px-4 py-3 text-[15px] leading-relaxed text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-70"
      style={{ minHeight }}
    />
  )
}

function RunProgressBar({
  data,
  entries,
}: {
  data: GoodtimeRunData
  entries: LdJournalEntry[]
}) {
  const started = data.started_on
  if (!started || data.state === 'setup') return null

  const milestones: { key: string; label: string; done: boolean }[] = [
    {
      key: 'w1',
      label: '1주 회고',
      done: data.weekly.some((w) => w.week === 1),
    },
    {
      key: 'w2',
      label: '2주 회고',
      done: data.weekly.some((w) => w.week === 2),
    },
    {
      key: 'w3',
      label: '3주 회고',
      done: data.weekly.some((w) => w.week === 3),
    },
    {
      key: 'zoom',
      label: '줌인',
      done: ['aeiou', 'closing', 'done'].includes(data.state),
    },
    {
      key: 'close',
      label: '정리',
      done: data.state === 'done' || (data.state === 'closing' && Boolean(data.closing.trim())),
    },
  ]

  const today = todayKey()
  const weekNow = goodtimeWeekForDate(started, today)
  const weekInfo = (() => {
    if (!weekNow) {
      if (daysBetween(started, today) > 20) return '3주 지남'
      return ''
    }
    const [, end] = goodtimeWeekRange(started, weekNow)
    const left = Math.max(0, daysBetween(today, end))
    const hasReview = data.weekly.some((w) => w.week === weekNow)
    const range = goodtimeWeekRange(started, weekNow)
    const label = `${formatShort(range[0])}~${formatShort(range[1])}`
    if (hasReview) return `${weekNow}주차 ${label} ✓`
    return `${weekNow}주차 ${label} · 진행 중 (${left}일 남음)`
  })()

  const daysLogged = new Set(entries.map((e) => e.entryDate)).size

  return (
    <div className="mb-5 rounded-[18px] border border-[#ECE7E2] bg-white px-4 py-3" style={{ boxShadow: cardShadow }}>
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        {milestones.map((m, i) => (
          <div key={m.key} className="flex min-w-0 flex-1 items-center">
            {i > 0 && (
              <div
                className="mx-1 h-0.5 flex-1"
                style={{
                  background: milestones[i - 1].done ? COMPASS.accent : '#ECE7E2',
                }}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: m.done ? COMPASS.accent : '#fff',
                  border: m.done ? 'none' : `2px solid ${COMPASS.line}`,
                }}
              />
              <span className="whitespace-nowrap text-[10px] text-[#8A847E]">
                {m.label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-[#8A847E]">
        {weekInfo}
        {daysLogged > 0 ? ` · 기록 ${daysLogged}일` : ''}
      </p>
    </div>
  )
}

function formatShort(dateKey: string) {
  const [, m, d] = dateKey.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function CompassGoodtime({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onOpenMindmap,
}: CompassGoodtimeProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'goodtime',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<GoodtimeRunData>(emptyGoodtimeRunData())
  const [tab, setTab] = useState<Tab>('기록')
  const [helpOpen, setHelpOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [finishWarn, setFinishWarn] = useState(false)

  // composer
  const [activity, setActivity] = useState('')
  const [duration, setDuration] = useState<JournalDuration>(60)
  const [engagement, setEngagement] = useState(0)
  const [energy, setEnergy] = useState(0)
  const [isFlow, setIsFlow] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const activityRef = useRef<HTMLInputElement>(null)

  // review draft
  const [reviewWeek, setReviewWeek] = useState<1 | 2 | 3 | null>(null)
  const [engaging, setEngaging] = useState('')
  const [draining, setDraining] = useState('')
  const [surprise, setSurprise] = useState('')
  const [prevReviewOpen, setPrevReviewOpen] = useState(false)

  // pattern
  const [patternWeek, setPatternWeek] = useState<'1' | '2' | '3' | 'all'>('all')
  const [overlay, setOverlay] = useState(false)

  // zoom notes local
  const [zoomNotes, setZoomNotes] = useState<Record<string, string>>({})
  const [customPick, setCustomPick] = useState('')

  // aeiou
  const [aeiouDraft, setAeiouDraft] = useState<AeiouData>(emptyAeiou())

  const entries = useMemo(
    () => entriesForRun(compass.journalEntries, active?.id),
    [compass.journalEntries, active?.id],
  )

  useEffect(() => {
    if (!active) {
      setData(emptyGoodtimeRunData())
      return
    }
    const next = normalizeGoodtimeRunData(
      compass.getDraftData(active, emptyGoodtimeRunData()),
    )
    setData(next)
    if (next.state === 'setup') setTab('기록')
    else if (next.state === 'zoom') setTab('줌인')
    else if (next.state === 'aeiou') setTab('AEIOU')
    else if (next.state === 'closing' || next.state === 'done') setTab('정리')
    else setTab('기록')

    // seed zoom notes from entries
    const notes: Record<string, string> = {}
    for (const e of compass.journalEntries.filter((j) => j.runId === active.id)) {
      if (e.zoomNote) notes[e.activity.trim()] = e.zoomNote
    }
    setZoomNotes(notes)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate on snapshot switch only
  }, [active?.id])

  const save = useCallback(
    async (id: string, next: GoodtimeRunData) => {
      await compass.updateDraftData(id, next as unknown as Record<string, unknown>)
    },
    [compass],
  )
  const { savedAt, error } = useDebouncedDraftSave(
    active,
    data,
    save,
    Boolean(active && !readonly && data.state !== 'setup'),
  )

  const patch = (p: Partial<GoodtimeRunData>) => {
    if (readonly) return
    setData((d) => ({ ...d, ...p }))
  }

  const setState = (state: GoodtimeState) => patch({ state })

  const startRun = async (startedOn: string) => {
    if (!active || readonly) return
    const next: GoodtimeRunData = {
      ...emptyGoodtimeRunData(startedOn),
      state: 'week1',
      started_on: startedOn,
    }
    setData(next)
    await compass.updateDraftData(
      active.id,
      next as unknown as Record<string, unknown>,
    )
    setSelectedDate(startedOn)
    setTab('기록')
  }

  const dayEntries = entries
    .filter((e) => e.entryDate === selectedDate)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const selectedWeek = data.started_on
    ? goodtimeWeekForDate(data.started_on, selectedDate)
    : null

  const pendingReviewWeek = ((): 1 | 2 | 3 | null => {
    if (!data.started_on || data.state === 'setup') return null
    const today = todayKey()
    for (const w of [1, 2, 3] as const) {
      const [, end] = goodtimeWeekRange(data.started_on, w)
      if (today > end && !data.weekly.some((r) => r.week === w)) return w
    }
    return null
  })()

  const showWeek2Nudge =
    !readonly &&
    data.state === 'week2' &&
    !data.week2_nudge_seen

  const shortestWeek1 = useMemo(() => {
    if (!data.started_on) return null
    const w1 = weekEntries(entries, data.started_on, 1)
    if (!w1.length) return null
    return [...w1].sort((a, b) => a.activity.length - b.activity.length)[0]
  }, [data.started_on, entries])

  const placeholder =
    selectedWeek && selectedWeek >= 2
      ? '뭐가 좋았어/힘들었어? 구체적으로'
      : '뭐 했어?'

  const resetComposer = () => {
    setActivity('')
    setEngagement(0)
    setEnergy(0)
    setIsFlow(false)
    setEditingId(null)
  }

  const saveEntry = async () => {
    if (!active || readonly || !activity.trim()) return
    if (editingId) {
      const prev = entries.find((e) => e.id === editingId)
      if (!prev) return
      await compass.upsertJournalEntry({
        ...prev,
        activity: activity.trim(),
        durationMin: duration,
        engagement,
        energy,
        isFlow,
      })
    } else {
      await compass.addJournalEntry({
        runId: active.id,
        entryDate: selectedDate,
        activity: activity.trim(),
        durationMin: duration,
        engagement,
        energy,
        isFlow,
        zoomNote: null,
        aeiou: null,
      })
    }
    resetComposer()
    requestAnimationFrame(() => activityRef.current?.focus())
  }

  const startEdit = (e: LdJournalEntry) => {
    if (readonly) return
    setEditingId(e.id)
    setActivity(e.activity)
    setDuration(e.durationMin)
    setEngagement(e.engagement)
    setEnergy(e.energy)
    setIsFlow(e.isFlow)
    activityRef.current?.focus()
  }

  const openReview = (week: 1 | 2 | 3) => {
    const existing = data.weekly.find((w) => w.week === week)
    setReviewWeek(week)
    setEngaging(existing?.engaging ?? '')
    setDraining(existing?.draining ?? '')
    setSurprise(existing?.surprise ?? '')
    setTab('회고')
  }

  const saveReview = () => {
    if (!reviewWeek || !data.started_on || readonly) return
    if (!engaging.trim() || !draining.trim() || !surprise.trim()) return
    const range = goodtimeWeekRange(data.started_on, reviewWeek)
    const row: GoodtimeWeeklyReview = {
      week: reviewWeek,
      range,
      engaging: engaging.trim(),
      draining: draining.trim(),
      surprise: surprise.trim(),
    }
    const weekly = [
      ...data.weekly.filter((w) => w.week !== reviewWeek),
      row,
    ].sort((a, b) => a.week - b.week)

    let nextState: GoodtimeState = data.state
    if (reviewWeek === 1) nextState = 'week2'
    else if (reviewWeek === 2) nextState = 'week3'
    else if (reviewWeek === 3) nextState = 'zoom'

    patch({ weekly, state: nextState })
    setReviewWeek(null)
    setTab(nextState === 'zoom' ? '줌인' : '기록')
  }

  const patternEntries = useMemo(() => {
    if (!data.started_on) return entries
    if (patternWeek === 'all') return entries
    return weekEntries(entries, data.started_on, Number(patternWeek) as 1 | 2 | 3)
  }, [data.started_on, entries, patternWeek])

  const overlayEntries = useMemo(() => {
    if (!overlay || !data.started_on || patternWeek === 'all') return []
    const w = Number(patternWeek) as 1 | 2 | 3
    if (w <= 1) return []
    return weekEntries(entries, data.started_on, (w - 1) as 1 | 2 | 3)
  }, [overlay, data.started_on, patternWeek, entries])

  const zoomSuggestions = useMemo(() => {
    const agg = aggregateActivities(entries)
    const flow = agg.filter((a) => a.flow).map((a) => a.label)
    const topEng = [...agg]
      .sort((a, b) => b.x - a.x)
      .slice(0, 3)
      .map((a) => a.label)
    const drained = entries
      .filter((e) => e.engagement >= 2 && e.energy <= -1)
      .map((e) => e.activity.trim())
    return [...new Set([...flow, ...topEng, ...drained])]
  }, [entries])

  const togglePick = (label: string) => {
    if (readonly) return
    setData((d) => {
      const has = d.zoom_picks.includes(label)
      if (has) return { ...d, zoom_picks: d.zoom_picks.filter((x) => x !== label) }
      if (d.zoom_picks.length >= 5) return d
      return { ...d, zoom_picks: [...d.zoom_picks, label] }
    })
  }

  const canSaveZoom =
    data.zoom_picks.length >= 3 &&
    data.zoom_picks.length <= 5 &&
    data.zoom_picks.every((p) => (zoomNotes[p] ?? '').trim().length > 0)

  const persistZoomAndContinue = async () => {
    if (!active || !canSaveZoom || readonly) return
    for (const label of data.zoom_picks) {
      const note = zoomNotes[label]?.trim() ?? ''
      const matches = entries.filter(
        (e) => e.activity.trim().toLowerCase() === label.toLowerCase(),
      )
      for (const e of matches) {
        await compass.upsertJournalEntry({ ...e, zoomNote: note })
      }
    }
    setState('aeiou')
    setTab('AEIOU')
    const first = data.zoom_picks[0]
    const sample = entries.find(
      (e) => e.activity.trim().toLowerCase() === first?.toLowerCase(),
    )
    setAeiouDraft(sample?.aeiou ?? emptyAeiou())
    patch({ aeiou_index: 0 })
  }

  const aeiouFilled = AEIOU_FIELDS.filter((f) => aeiouDraft[f.key].trim()).length

  const saveAeiouCurrent = async () => {
    if (!active || readonly || aeiouFilled < 3) return
    const label = data.zoom_picks[data.aeiou_index ?? 0]
    if (!label) return
    const matches = entries.filter(
      (e) => e.activity.trim().toLowerCase() === label.toLowerCase(),
    )
    for (const e of matches) {
      await compass.upsertJournalEntry({ ...e, aeiou: aeiouDraft })
    }
  }

  const goClosing = async () => {
    await saveAeiouCurrent()
    setState('closing')
    setTab('정리')
  }

  const finishEarly = () => {
    const days = new Set(entries.map((e) => e.entryDate)).size
    if (days < 7) {
      setFinishWarn(true)
      return
    }
    setState('closing')
    setTab('정리')
  }

  const completeRun = async () => {
    if (!active || !data.closing.trim()) return
    const frozen: GoodtimeRunData = { ...data, state: 'done', closing: data.closing.trim() }
    await compass.updateDraftData(
      active.id,
      frozen as unknown as Record<string, unknown>,
    )
    await compass.completeSnapshot(active.id)
  }

  const daysLoggedInWeek = (() => {
    if (!data.started_on || !selectedWeek) return { n: 0, total: 7 }
    const list = weekEntries(entries, data.started_on, selectedWeek)
    return { n: new Set(list.map((e) => e.entryDate)).size, total: 7 }
  })()

  const timeLabel = savedAt
    ? `저장됨 · ${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : '자동 저장'

  const hasActiveDraft = Boolean(compass.draftFor('goodtime'))

  // ─── Setup ───
  if (!active || data.state === 'setup') {
    return (
      <div className="pb-24">
        <CompassExerciseHeader
          title="굿타임 저널"
          subtitle="3주 동안 몰입과 에너지를 기록하고 패턴을 읽기"
        />
        <SetupPanel
          onStart={(d) => void startRun(d)}
          defaultDate={todayKey()}
        />
      </div>
    )
  }

  const reviewList =
    reviewWeek && data.started_on
      ? weekEntries(entries, data.started_on, reviewWeek)
      : []
  const buckets = reviewBuckets(reviewList)

  return (
    <div className="overflow-visible pb-28">
      <CompassExerciseHeader
        title="굿타임 저널"
        subtitle="3주 동안 몰입과 에너지를 기록하고 패턴을 읽기"
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[13px] text-[#B5AFA8]">
          {readonly
            ? `${formatYm(active.takenAt)} · 읽기 전용`
            : timeLabel}
        </span>
        <div className="flex items-center gap-3">
          {error && <span className="text-[12px] text-[#E0574A]">{error}</span>}
          {!readonly && !hasActiveDraft && all.filter((s) => s.status === 'complete').length > 0 && (
            <button
              type="button"
              className="text-[13px] font-semibold"
              style={{ color: COMPASS.accent }}
              onClick={() => void ensureDraft(true)}
            >
              + 새로 하기
            </button>
          )}
        </div>
      </div>

      {/* 새로 하기: 진행 중 런이 있으면 숨김 */}

      <RunProgressBar data={data} entries={entries} />

      <button
        type="button"
        className="mb-4 flex items-center gap-1.5 text-[13px] text-[#8A847E]"
        onClick={() => setHelpOpen((v) => !v)}
      >
        <span aria-hidden>{helpOpen ? '▾' : '▸'}</span>
        이 연습이 뭐예요?
      </button>
      {helpOpen && (
        <div className="mb-5 whitespace-pre-wrap rounded-2xl bg-[#FAF8F6] px-4 py-3 text-[14px] leading-relaxed text-[#8A847E]">
          {HELP}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-full bg-[#FAF8F6] p-1">
        {(
          [
            '기록',
            '패턴',
            ...(pendingReviewWeek || reviewWeek || data.weekly.length
              ? (['회고'] as Tab[])
              : []),
            ...(['zoom', 'aeiou', 'closing', 'done'].includes(data.state)
              ? (['줌인', 'AEIOU', '정리'] as Tab[])
              : []),
          ] as Tab[]
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t)
              if (t === '회고' && pendingReviewWeek && !reviewWeek)
                openReview(pendingReviewWeek)
            }}
            className="rounded-full px-3.5 py-1.5 text-[13px] font-medium"
            style={
              tab === t
                ? { background: '#fff', color: COMPASS.ink, boxShadow: cardShadow }
                : { color: '#8A847E' }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {showWeek2Nudge && (
        <Week2Nudge
          sample={shortestWeek1?.activity ?? '팀 회의'}
          onDismiss={() => patch({ week2_nudge_seen: true })}
        />
      )}

      {pendingReviewWeek && tab === '기록' && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
          style={{ background: COMPASS.soft }}
        >
          <p className="text-[14px] text-[#1C1B1A]">
            {pendingReviewWeek}주차 끝났어. 5분만 돌아보고 가자.
          </p>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
            onClick={() => openReview(pendingReviewWeek)}
          >
            회고 쓰기
          </button>
        </div>
      )}

      {/* ─── Log ─── */}
      {tab === '기록' && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[#8A847E]"
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              >
                ‹
              </button>
              <span className="text-[15px] font-semibold text-[#1C1B1A]">
                {formatDayLabel(selectedDate)}
              </span>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[#8A847E]"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              >
                ›
              </button>
            </div>
            <span className="text-[12px] text-[#8A847E]">
              이번 주 {daysLoggedInWeek.n}일 / {daysLoggedInWeek.total}일
            </span>
          </div>

          {!readonly && (
            <div
              className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-[#ECE7E2] bg-white px-2 py-1.5 sm:flex-nowrap"
              style={{ minHeight: 52, boxShadow: cardShadow }}
            >
              <input
                ref={activityRef}
                autoFocus={dayEntries.length === 0}
                disabled={readonly}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void saveEntry()
                  }
                }}
                placeholder={placeholder}
                className="min-w-[200px] flex-1 bg-transparent px-2 py-2 text-[14px] outline-none placeholder:text-[#B5AFA8]"
              />
              <select
                value={duration}
                disabled={readonly}
                onChange={(e) =>
                  setDuration(Number(e.target.value) as JournalDuration)
                }
                className="h-9 w-24 rounded-lg border border-[#ECE7E2] bg-[#FAF8F6] px-2 text-[13px]"
              >
                {JOURNAL_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {JOURNAL_DURATION_LABELS[d]}
                  </option>
                ))}
              </select>
              <CompassBipolarSlider
                label="몰입"
                value={engagement}
                onChange={setEngagement}
                disabled={readonly}
              />
              <CompassBipolarSlider
                label="에너지"
                value={energy}
                onChange={setEnergy}
                disabled={readonly}
              />
              <button
                type="button"
                title='시간 가는 줄 몰랐던 거만. "좋았다"랑은 달라.'
                aria-label="flow"
                disabled={readonly}
                onClick={() => setIsFlow((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: isFlow ? COMPASS.soft : 'transparent',
                  color: isFlow ? COMPASS.accent : '#B5AFA8',
                }}
              >
                <Zap size={16} />
              </button>
              <button
                type="button"
                disabled={readonly || !activity.trim()}
                onClick={() => void saveEntry()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] font-semibold text-white disabled:opacity-40"
                style={{ background: COMPASS.accent }}
              >
                +
              </button>
            </div>
          )}

          {dayEntries.length === 0 && !readonly && (
            <p className="mb-3 text-[13px] text-[#8A847E]">
              오늘 한 일 하나만 적어봐. 30초면 돼.
            </p>
          )}

          <ul className="space-y-1.5">
            {dayEntries.map((e) => (
              <li
                key={e.id}
                className="group flex items-center gap-2 rounded-xl bg-white px-3 py-2.5"
                style={{
                  boxShadow: cardShadow,
                  borderLeft: e.isFlow
                    ? `3px solid ${COMPASS.accent}`
                    : '3px solid transparent',
                }}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => startEdit(e)}
                  disabled={readonly}
                >
                  <span className="text-[14px] font-medium text-[#1C1B1A]">
                    {e.activity}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[#8A847E]">
                    {JOURNAL_DURATION_LABELS[e.durationMin]} · 몰입{' '}
                    {e.engagement > 0 ? `+${e.engagement}` : e.engagement} ·
                    에너지 {e.energy > 0 ? `+${e.energy}` : e.energy}
                    {e.isFlow ? ' · ⚡' : ''}
                  </span>
                </button>
                {!readonly && (
                  <button
                    type="button"
                    className="hidden text-[12px] text-[#B5AFA8] group-hover:inline"
                    onClick={() => void compass.deleteJournalEntry(e.id)}
                  >
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
          {dayEntries.length > 5 && (
            <p className="mt-2 text-[13px] text-[#B5AFA8]">이만큼이면 충분해.</p>
          )}

          {!readonly && data.state !== 'done' && data.state !== 'closing' && (
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                className="text-[13px] text-[#8A847E] underline-offset-2 hover:underline"
                onClick={finishEarly}
              >
                여기서 마무리
              </button>
            </div>
          )}
          {finishWarn && (
            <div className="mt-3 rounded-xl bg-[#FAF8F6] px-4 py-3 text-[13px] text-[#8A847E]">
              일주일은 채워야 패턴이 보여.{' '}
              <button
                type="button"
                className="font-semibold"
                style={{ color: COMPASS.accent }}
                onClick={() => {
                  setFinishWarn(false)
                  setState('closing')
                  setTab('정리')
                }}
              >
                그래도 마무리
              </button>
              {' · '}
              <button
                type="button"
                className="underline"
                onClick={() => setFinishWarn(false)}
              >
                계속 쓰기
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Pattern ─── */}
      {tab === '패턴' && (
        <PatternPanel
          entries={patternEntries}
          overlayEntries={overlayEntries}
          patternWeek={patternWeek}
          setPatternWeek={setPatternWeek}
          overlay={overlay}
          setOverlay={setOverlay}
        />
      )}

      {/* ─── Review ─── */}
      {tab === '회고' && reviewWeek && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <ReviewSide title="몰입 높았던 것" items={buckets.high} kind="high" />
            <ReviewSide title="몰입 낮았던 것" items={buckets.low} kind="low" />
            <ReviewSide
              title="몰입은 높은데 지친 것"
              items={buckets.drained}
              kind="drained"
            />
            <p className="text-[12px] text-[#8A847E]">
              이번 주 {buckets.total}건 · {buckets.days}일 기록
            </p>
            {reviewWeek > 1 && (
              <div>
                <button
                  type="button"
                  className="text-[13px] font-semibold"
                  style={{ color: COMPASS.accent }}
                  onClick={() => setPrevReviewOpen((v) => !v)}
                >
                  {reviewWeek - 1}주차에 쓴 것 보기 {prevReviewOpen ? '▾' : '▸'}
                </button>
                {prevReviewOpen &&
                  data.weekly
                    .filter((w) => w.week < reviewWeek)
                    .map((w) => (
                      <div
                        key={w.week}
                        className="mt-2 rounded-xl bg-[#FAF8F6] px-3 py-2 text-[13px] text-[#8A847E]"
                      >
                        <p className="font-semibold text-[#1C1B1A]">
                          {w.week}주차
                        </p>
                        <p className="mt-1">놀라운 거: {w.surprise || '—'}</p>
                      </div>
                    ))}
              </div>
            )}
          </aside>
          <div className="space-y-5">
            <h3 className="text-[16px] font-semibold text-[#1C1B1A]">
              {reviewWeek}주차 회고
            </h3>
            <div>
              <p className="mb-2 text-[14px] font-medium">
                이번 주 어떤 게 몰입되고 기운을 줬어?
              </p>
              <AutoGrow
                disabled={readonly}
                value={engaging}
                onChange={setEngaging}
              />
            </div>
            <div>
              <p className="mb-2 text-[14px] font-medium">
                뭐가 지루하거나 기운을 뺏었어?
              </p>
              <AutoGrow
                disabled={readonly}
                value={draining}
                onChange={setDraining}
              />
            </div>
            <div>
              <p className="mb-2 text-[14px] font-medium">놀라운 거 있었어?</p>
              <AutoGrow
                disabled={readonly}
                value={surprise}
                onChange={setSurprise}
              />
            </div>
            {!readonly && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={
                    !engaging.trim() || !draining.trim() || !surprise.trim()
                  }
                  onClick={saveReview}
                  className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
                  style={{ background: COMPASS.accent }}
                >
                  회고 저장
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Zoom ─── */}
      {tab === '줌인' && (
        <div className="space-y-5">
          <p className="text-[15px] text-[#1C1B1A]">
            3주 동안 이런 게 나왔어. 여기서 제일 크게 걸리는 거 3~5개만 골라봐.
          </p>
          <div className="flex flex-wrap gap-2">
            {zoomSuggestions.map((label) => {
              const on = data.zoom_picks.includes(label)
              return (
                <button
                  key={label}
                  type="button"
                  disabled={readonly}
                  onClick={() => togglePick(label)}
                  className="rounded-full border px-3 py-1.5 text-[13px]"
                  style={
                    on
                      ? {
                          background: COMPASS.soft,
                          borderColor: COMPASS.accent,
                          color: COMPASS.ink,
                        }
                      : { borderColor: '#ECE7E2', color: '#1C1B1A' }
                  }
                >
                  {on ? '☑' : '☐'} {label}
                </button>
              )
            })}
          </div>
          {!readonly && (
            <div className="flex gap-2">
              <input
                value={customPick}
                onChange={(e) => setCustomPick(e.target.value)}
                placeholder="직접 추가"
                className="flex-1 rounded-xl border border-[#ECE7E2] px-3 py-2 text-[14px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customPick.trim()) {
                    togglePick(customPick.trim())
                    setCustomPick('')
                  }
                }}
              />
              <button
                type="button"
                className="rounded-full px-4 text-[13px] font-semibold text-white"
                style={{ background: COMPASS.accent }}
                onClick={() => {
                  if (customPick.trim()) {
                    togglePick(customPick.trim())
                    setCustomPick('')
                  }
                }}
              >
                추가
              </button>
            </div>
          )}
          <div className="space-y-4">
            {data.zoom_picks.map((label) => (
              <div
                key={label}
                className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                style={{ boxShadow: cardShadow }}
              >
                <p className="font-semibold text-[#1C1B1A]">{label}</p>
                <p className="mt-1 text-[13px] text-[#8A847E]">
                  이 안에서 정확히 뭐가 좋았어?
                </p>
                <input
                  disabled={readonly}
                  value={zoomNotes[label] ?? ''}
                  onChange={(e) =>
                    setZoomNotes((n) => ({ ...n, [label]: e.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-[#ECE7E2] px-3 py-2 text-[14px]"
                  placeholder="한 줄로 좁혀봐"
                />
              </div>
            ))}
          </div>
          {!readonly && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canSaveZoom}
                onClick={() => void persistZoomAndContinue()}
                className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: COMPASS.accent }}
              >
                다음 · AEIOU →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── AEIOU ─── */}
      {tab === 'AEIOU' && data.zoom_picks.length > 0 && (
        <AeiouPanel
          picks={data.zoom_picks}
          index={data.aeiou_index ?? 0}
          setIndex={(i) => {
            void saveAeiouCurrent()
            const label = data.zoom_picks[i]
            const sample = entries.find(
              (e) =>
                e.activity.trim().toLowerCase() === label?.toLowerCase(),
            )
            setAeiouDraft(sample?.aeiou ?? emptyAeiou())
            patch({ aeiou_index: i })
          }}
          draft={aeiouDraft}
          setDraft={setAeiouDraft}
          filled={aeiouFilled}
          readonly={readonly}
          onSave={() => void saveAeiouCurrent()}
          onNext={() => void goClosing()}
        />
      )}

      {/* ─── Closing ─── */}
      {tab === '정리' && (
        <ClosingPanel
          entries={entries}
          closing={data.closing}
          setClosing={(v) => patch({ closing: v })}
          readonly={readonly}
          onComplete={() => void completeRun()}
          onMindmap={onOpenMindmap}
        />
      )}
    </div>
  )
}

function SetupPanel({
  onStart,
  defaultDate,
}: {
  onStart: (date: string) => void
  defaultDate: string
}) {
  const [date, setDate] = useState(defaultDate)
  return (
    <div
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 sm:p-8"
      style={{ boxShadow: cardShadow }}
    >
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1C1B1A]">
        {`3주 동안 매일 뭘 했는지랑, 그때 얼마나 빠져들었고 기운이 어땠는지 적을 거야.
매주 끝에 한 번씩 돌아보고, 3주 뒤에 제일 좋았던 몇 개를 확대해서 뜯어볼 거야.

하루 3~5개면 충분해. 완벽하게 다 적으려고 하면 3일 만에 그만두게 돼.`}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-[14px] text-[#8A847E]">
          시작일:{' '}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-1 rounded-lg border border-[#ECE7E2] px-2 py-1.5 text-[14px] text-[#1C1B1A]"
          />
          <span className="ml-2 text-[13px]">{formatDayLabel(date)}</span>
        </label>
        <button
          type="button"
          onClick={() => onStart(date)}
          className="rounded-full px-6 py-2.5 text-[14px] font-semibold text-white"
          style={{ background: COMPASS.accent }}
        >
          시작하기
        </button>
      </div>
    </div>
  )
}

function Week2Nudge({
  sample,
  onDismiss,
}: {
  sample: string
  onDismiss: () => void
}) {
  return (
    <div
      className="mb-4 rounded-[18px] border border-[#ECE7E2] bg-white p-5"
      style={{ boxShadow: cardShadow }}
    >
      <p className="text-[15px] font-semibold text-[#1C1B1A]">
        이번 주부터는 한 칸 더 좁혀서 써보자
      </p>
      <p className="mt-3 text-[13px] text-[#8A847E]">1주차 네 기록:</p>
      <p className="text-[14px] text-[#1C1B1A]">“{sample}”</p>
      <p className="mt-3 text-[13px] text-[#8A847E]">이번 주에는 이렇게:</p>
      <p className="text-[14px] text-[#1C1B1A]">
        “회의에서 내가 낸 아이디어를 다들 받아줬을 때”
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-[#1C1B1A]">
        뭘 했냐보다 &quot;그 안에서 정확히 뭐가 좋았냐&quot;가 진짜 단서야.
      </p>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: COMPASS.accent }}
        >
          알겠어
        </button>
      </div>
    </div>
  )
}

function ReviewSide({
  title,
  items,
  kind,
}: {
  title: string
  items: LdJournalEntry[]
  kind: 'high' | 'low' | 'drained'
}) {
  return (
    <div
      className="rounded-[16px] border border-[#ECE7E2] bg-white p-3"
      style={{ boxShadow: cardShadow }}
    >
      <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">{title}</p>
      {items.length === 0 ? (
        <p className="text-[13px] text-[#B5AFA8]">—</p>
      ) : (
        <ul className="space-y-1.5 text-[13px] text-[#1C1B1A]">
          {items.map((e) => (
            <li key={e.id}>
              {kind === 'drained' ? (
                <>
                  <span className="tabular-nums text-[#8A847E]">
                    {e.engagement > 0 ? `+${e.engagement}` : e.engagement} /{' '}
                    {e.energy > 0 ? `+${e.energy}` : e.energy}
                  </span>{' '}
                  {e.activity}
                </>
              ) : (
                <>
                  <span className="tabular-nums text-[#8A847E]">
                    {e.engagement > 0 ? `+${e.engagement}` : e.engagement}
                  </span>{' '}
                  {e.activity}
                  {e.isFlow ? ' ⚡' : ''}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PatternPanel({
  entries,
  overlayEntries,
  patternWeek,
  setPatternWeek,
  overlay,
  setOverlay,
}: {
  entries: LdJournalEntry[]
  overlayEntries: LdJournalEntry[]
  patternWeek: '1' | '2' | '3' | 'all'
  setPatternWeek: (v: '1' | '2' | '3' | 'all') => void
  overlay: boolean
  setOverlay: (v: boolean) => void
}) {
  if (entries.length === 0) {
    return (
      <p className="text-[14px] text-[#8A847E]">
        기록 탭에서 며칠 쌓아보자
      </p>
    )
  }
  const points = aggregateActivities(entries)
  const ghosts = aggregateActivities(overlayEntries)
  const daysLogged = new Set(entries.map((e) => e.entryDate)).size
  const flowCount = entries.filter((e) => e.isFlow).length
  const avgEnergy =
    entries.reduce((s, e) => s + e.energy, 0) / Math.max(entries.length, 1)

  return (
    <div>
      {entries.length < 5 && (
        <p className="mb-3 text-[13px] text-[#8A847E]">
          아직 점이 적어. 며칠 더 쌓이면 모양이 보여.
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['1', '2', '3', 'all'] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setPatternWeek(w)}
            className="rounded-full px-3 py-1 text-[12px] font-medium"
            style={
              patternWeek === w
                ? { background: COMPASS.soft, color: COMPASS.ink }
                : { color: '#8A847E' }
            }
          >
            {w === 'all' ? '전체' : `${w}주차`}
          </button>
        ))}
        {patternWeek !== 'all' && patternWeek !== '1' && (
          <label className="ml-2 flex items-center gap-1.5 text-[12px] text-[#8A847E]">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            주차 오버레이
          </label>
        )}
      </div>
      <ScatterPlot points={points} ghosts={overlay ? ghosts : []} />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard label="기록한 날" value={String(daysLogged)} />
        <StatCard label="flow 표시" value={String(flowCount)} />
        <StatCard
          label="평균 에너지"
          value={(avgEnergy >= 0 ? '+' : '') + avgEnergy.toFixed(1)}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[16px] border border-[#ECE7E2] bg-white p-4 text-center"
      style={{ boxShadow: cardShadow }}
    >
      <p className="text-[11px] text-[#8A847E]">{label}</p>
      <p className="mt-1 text-[20px] font-bold tabular-nums text-[#1C1B1A]">
        {value}
      </p>
    </div>
  )
}

export function ScatterPlot({
  points,
  ghosts = [],
  size = 520,
}: {
  points: ReturnType<typeof aggregateActivities>
  ghosts?: ReturnType<typeof aggregateActivities>
  size?: number
}) {
  const maxMin = Math.max(60, ...points.map((p) => p.minutes), 1)
  const toXY = (x: number, y: number, s: number) => ({
    cx: ((x + 5) / 10) * s,
    cy: ((5 - y) / 10) * s,
  })

  const moves = (() => {
    if (!ghosts.length) return []
    return points
      .map((p) => {
        const g = ghosts.find(
          (x) => x.label.toLowerCase() === p.label.toLowerCase(),
        )
        if (!g) return null
        const dist = Math.hypot(p.x - g.x, p.y - g.y)
        return { p, g, dist }
      })
      .filter(Boolean)
      .sort((a, b) => (b!.dist - a!.dist))
      .slice(0, 3) as {
      p: (typeof points)[0]
      g: (typeof points)[0]
      dist: number
    }[]
  })()

  return (
    <div
      className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
      style={{ aspectRatio: '1', minHeight: Math.min(size, 280), boxShadow: cardShadow }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        {/* bottom-right highlight */}
        <rect
          x={size / 2}
          y={size / 2}
          width={size / 2}
          height={size / 2}
          fill="#C08A4A"
          opacity={0.06}
        />
        <line
          x1={0}
          y1={size / 2}
          x2={size}
          y2={size / 2}
          stroke={COMPASS.line}
          strokeWidth={1}
        />
        <line
          x1={size / 2}
          y1={0}
          x2={size / 2}
          y2={size}
          stroke={COMPASS.line}
          strokeWidth={1}
        />
        <text x={size - 12} y={18} textAnchor="end" fontSize={12} fill="#B5AFA8">
          더 하기
        </text>
        <text
          x={size - 12}
          y={size - 12}
          textAnchor="end"
          fontSize={12}
          fill="#B5AFA8"
        >
          빠지지만 지치는 것
        </text>
        <text x={12} y={18} fontSize={12} fill="#B5AFA8">
          해도 괜찮은 것
        </text>
        <text x={12} y={size - 12} fontSize={12} fill="#B5AFA8">
          빼기
        </text>

        {ghosts.map((g) => {
          const { cx, cy } = toXY(g.x, g.y, size)
          const r = 6 + (g.minutes / maxMin) * 10
          return (
            <circle
              key={`g-${g.label}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={COMPASS.accent}
              opacity={0.28}
            />
          )
        })}

        {moves.map(({ p, g }) => {
          const a = toXY(g.x, g.y, size)
          const b = toXY(p.x, p.y, size)
          return (
            <g key={`m-${p.label}`}>
              <line
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke={COMPASS.accent}
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
                opacity={0.6}
              />
              <text
                x={(a.cx + b.cx) / 2}
                y={(a.cy + b.cy) / 2 - 6}
                fontSize={11}
                fill={COMPASS.ink}
              >
                {p.label}
              </text>
            </g>
          )
        })}

        <defs>
          <marker
            id="arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={COMPASS.accent} />
          </marker>
        </defs>

        {points.map((p) => {
          const { cx, cy } = toXY(p.x, p.y, size)
          const r = 6 + (p.minutes / maxMin) * 10
          return (
            <circle
              key={p.label}
              cx={cx}
              cy={cy}
              r={r}
              fill={COMPASS.accent}
              stroke={p.flow ? COMPASS.accent : 'none'}
              strokeWidth={p.flow ? 2 : 0}
              opacity={0.85}
            >
              <title>
                {`${p.label} · ${p.n}회 · 총 ${Math.round(p.minutes / 60)}시간 · 몰입 ${p.x >= 0 ? '+' : ''}${p.x.toFixed(1)} / 에너지 ${p.y >= 0 ? '+' : ''}${p.y.toFixed(1)}`}
              </title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}

function AeiouPanel({
  picks,
  index,
  setIndex,
  draft,
  setDraft,
  filled,
  readonly,
  onSave,
  onNext,
}: {
  picks: string[]
  index: number
  setIndex: (i: number) => void
  draft: AeiouData
  setDraft: (d: AeiouData) => void
  filled: number
  readonly: boolean
  onSave: () => void
  onNext: () => void
}) {
  const label = picks[index] ?? picks[0]
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[#8A847E]"
          disabled={index <= 0}
          onClick={() => setIndex(Math.max(0, index - 1))}
        >
          ‹
        </button>
        {picks.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => setIndex(i)}
            className="rounded-full px-3 py-1 text-[12px] font-medium"
            style={
              i === index
                ? { background: COMPASS.soft, color: COMPASS.ink }
                : { color: '#8A847E' }
            }
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[#8A847E]"
          disabled={index >= picks.length - 1}
          onClick={() => setIndex(Math.min(picks.length - 1, index + 1))}
        >
          ›
        </button>
      </div>
      <h3 className="mb-4 text-[16px] font-semibold text-[#1C1B1A]">{label}</h3>
      <div className="space-y-4">
        {AEIOU_FIELDS.map((f) => (
          <div key={f.key}>
            <p className="text-[12px] font-semibold tracking-wide text-[#8A847E]">
              {f.label}
            </p>
            <p className="mb-2 whitespace-pre-wrap text-[13px] text-[#8A847E]">
              {f.prompt}
            </p>
            <AutoGrow
              disabled={readonly}
              minHeight={64}
              value={draft[f.key]}
              onChange={(v) => setDraft({ ...draft, [f.key]: v })}
            />
          </div>
        ))}
      </div>
      {!readonly && (
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={filled < 3}
            onClick={onSave}
            className="h-11 rounded-full border border-[#ECE7E2] px-5 text-[13px] font-semibold disabled:opacity-40"
          >
            이 활동 저장
          </button>
          <button
            type="button"
            disabled={filled < 3}
            onClick={onNext}
            className="h-11 rounded-full px-5 text-[13px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            다음 · 정리 →
          </button>
        </div>
      )}
    </div>
  )
}

function ClosingPanel({
  entries,
  closing,
  setClosing,
  readonly,
  onComplete,
  onMindmap,
}: {
  entries: LdJournalEntry[]
  closing: string
  setClosing: (v: string) => void
  readonly: boolean
  onComplete: () => void
  onMindmap?: () => void
}) {
  const agg = aggregateActivities(entries)
  const highBoth = agg
    .filter((a) => a.x >= 2 && a.y >= 1)
    .map((a) => a.label)
  const flowDrain = [
    ...new Set(
      entries
        .filter((e) => e.engagement >= 2 && e.energy <= -1)
        .map((e) => e.activity.trim()),
    ),
  ]
  const low = agg
    .filter((a) => a.x <= -1 && a.y <= 0)
    .map((a) => a.label)

  return (
    <div
      className="mx-auto max-w-xl rounded-[22px] border border-[#ECE7E2] bg-white px-6 py-8"
      style={{ boxShadow: cardShadow }}
    >
      <h2 className="text-[20px] font-bold text-[#1C1B1A]">3주치 정리</h2>

      <Group title="몰입 + 에너지가 같이 높았던 것" items={highBoth} />
      <Group title="빠지긴 하는데 지치는 것" items={flowDrain} />
      <Group title="계속 빠져나간 것" items={low} />

      <hr className="my-6 border-[#ECE7E2]" />
      <p className="mb-2 text-[14px] font-medium text-[#1C1B1A]">
        3주 전체를 보고, 뭘 더 하고 뭘 줄이고 싶어?
      </p>
      <AutoGrow
        disabled={readonly}
        value={closing}
        onChange={setClosing}
        minHeight={120}
      />

      <p className="mt-5 text-[13px] text-[#8A847E]">
        여기서 마인드맵으로 넘어가면 이 활동들에서 역할 아이디어를 뽑을 수 있어.
      </p>
      {onMindmap && (
        <button
          type="button"
          className="mt-2 text-[13px] font-semibold"
          style={{ color: COMPASS.accent }}
          onClick={onMindmap}
        >
          마인드맵 하러 가기
        </button>
      )}

      {!readonly && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!closing.trim()}
            onClick={onComplete}
            className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            완료하기
          </button>
        </div>
      )}
    </div>
  )
}

function Group({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5">
      <p className="text-[13px] font-semibold text-[#8A847E]">{title}</p>
      <p className="mt-1 text-[14px] text-[#1C1B1A]">
        {items.length ? items.join(' · ') : '—'}
      </p>
    </div>
  )
}
