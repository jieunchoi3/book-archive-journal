import { useMemo, useState } from 'react'
import {
  COMPASS,
  JOURNAL_BUCKET_LABELS,
  JOURNAL_BUCKETS,
  emptyAeiou,
  todayKey,
  type AeiouData,
  type JournalBucket,
  type LdJournalEntry,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { cardShadow } from './CompassExerciseShell'
import { Zap } from 'lucide-react'

interface CompassGoodtimeProps {
  compass: CompassActions
}

type Period = 'week' | '4w' | '3m' | 'all'

function startOfWeek(d = new Date()) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(12, 0, 0, 0)
  return mon
}

function dateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function filterByPeriod(entries: LdJournalEntry[], period: Period, offsetPeriods = 0) {
  if (period === 'all' && offsetPeriods === 0) return entries
  const now = Date.now()
  const dayMs = 86400000
  const span =
    period === 'week' ? 7 : period === '4w' ? 28 : period === '3m' ? 90 : 3650
  const end = now - offsetPeriods * span * dayMs
  const start = end - span * dayMs
  return entries.filter((e) => {
    const t = Date.parse(e.entryDate)
    return t >= start && t <= end
  })
}

export function CompassGoodtime({ compass }: CompassGoodtimeProps) {
  const [mode, setMode] = useState<'기록' | '패턴'>('기록')
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [activity, setActivity] = useState('')
  const [bucket, setBucket] = useState<JournalBucket | ''>('')
  const [engagement, setEngagement] = useState(0)
  const [energy, setEnergy] = useState(0)
  const [isFlow, setIsFlow] = useState(false)
  const [period, setPeriod] = useState<Period>('4w')
  const [ghost, setGhost] = useState(false)
  const [aeiouEntry, setAeiouEntry] = useState<LdJournalEntry | null>(null)
  const [aeiou, setAeiou] = useState<AeiouData>(emptyAeiou())

  const weekDays = useMemo(() => {
    const mon = startOfWeek()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      const key = dateKey(d)
      const count = compass.journalEntries.filter((e) => e.entryDate === key).length
      return { key, label: ['월', '화', '수', '목', '금', '토', '일'][i], count }
    })
  }, [compass.journalEntries])

  const dayEntries = compass.journalEntries
    .filter((e) => e.entryDate === selectedDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const addRow = async () => {
    const label = activity.trim()
    if (!label) return
    await compass.addJournalEntry({
      entryDate: selectedDate,
      activity: label,
      bucket: bucket || null,
      engagement,
      energy,
      isFlow,
      note: null,
      aeiou: null,
    })
    setActivity('')
    setBucket('')
    setEngagement(0)
    setEnergy(0)
    setIsFlow(false)
  }

  const current = filterByPeriod(compass.journalEntries, period, 0)
  const previous = ghost ? filterByPeriod(compass.journalEntries, period, 1) : []

  const aggregate = (list: LdJournalEntry[]) => {
    const map = new Map<string, { eng: number; ene: number; n: number; sample: LdJournalEntry }>()
    for (const e of list) {
      const k = e.activity.trim().toLowerCase()
      const prev = map.get(k)
      if (!prev) map.set(k, { eng: e.engagement, ene: e.energy, n: 1, sample: e })
      else
        map.set(k, {
          eng: prev.eng + e.engagement,
          ene: prev.ene + e.energy,
          n: prev.n + 1,
          sample: prev.sample,
        })
    }
    return [...map.entries()].map(([k, v]) => ({
      key: k,
      label: v.sample.activity,
      x: v.eng / v.n,
      y: v.ene / v.n,
      n: v.n,
      sample: v.sample,
    }))
  }

  const points = aggregate(current)
  const ghostPoints = aggregate(previous)

  const daysLogged = new Set(current.map((e) => e.entryDate)).size
  const flowCount = current.filter((e) => e.isFlow).length
  const avgEnergy =
    current.length === 0
      ? 0
      : current.reduce((s, e) => s + e.energy, 0) / current.length

  const openAeiou = (entry: LdJournalEntry) => {
    setAeiouEntry(entry)
    setAeiou(entry.aeiou ?? emptyAeiou())
  }

  const saveAeiou = async () => {
    if (!aeiouEntry) return
    await compass.upsertJournalEntry({ ...aeiouEntry, aeiou })
    setAeiouEntry(null)
  }

  return (
    <div className="pb-24">
      <div className="mb-4 inline-flex rounded-full bg-[#FAF8F6] p-1">
        {(['기록', '패턴'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="rounded-full px-4 py-1.5 text-[13px] font-semibold"
            style={
              mode === m
                ? { background: COMPASS.accent, color: '#fff' }
                : { color: '#8A847E' }
            }
          >
            {m}
          </button>
        ))}
      </div>

      {mode === '기록' ? (
        <>
          <div className="mb-4 flex gap-1">
            {weekDays.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDate(d.key)}
                className="flex flex-1 flex-col items-center rounded-xl py-2 text-[11px]"
                style={{
                  background:
                    selectedDate === d.key ? COMPASS.soft : '#FAF8F6',
                  color: selectedDate === d.key ? COMPASS.ink : '#8A847E',
                }}
              >
                <span>{d.label}</span>
                <span
                  className="mt-1 h-2 w-2 rounded-full"
                  style={{
                    background: d.count > 0 ? COMPASS.accent : '#ECE7E2',
                  }}
                />
              </button>
            ))}
          </div>

          <div
            className="mb-3 rounded-[18px] border border-[#ECE7E2] bg-white p-3"
            style={{ boxShadow: cardShadow }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addRow()
                  }
                }}
                placeholder="무엇을 했나?"
                className="min-w-[10rem] flex-1 rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
              />
              <select
                value={bucket}
                onChange={(e) => setBucket(e.target.value as JournalBucket | '')}
                className="rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-2 py-2 text-[12px]"
              >
                <option value="">bucket</option>
                {JOURNAL_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {JOURNAL_BUCKET_LABELS[b]}
                  </option>
                ))}
              </select>
              <SliderChip
                label="몰입"
                value={engagement}
                onChange={setEngagement}
              />
              <SliderChip label="에너지" value={energy} onChange={setEnergy} />
              <button
                type="button"
                onClick={() => setIsFlow((v) => !v)}
                className="rounded-xl border px-2 py-2"
                style={{
                  borderColor: isFlow ? COMPASS.accent : '#ECE7E2',
                  color: isFlow ? COMPASS.accent : '#8A847E',
                }}
                aria-label="flow"
              >
                <Zap size={16} fill={isFlow ? COMPASS.accent : 'none'} />
              </button>
              <button
                type="button"
                onClick={() => void addRow()}
                className="rounded-full px-3 py-2 text-[13px] font-semibold text-white"
                style={{ background: COMPASS.accent }}
              >
                +
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {dayEntries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-[14px] border bg-white px-3 py-2 text-[13px]"
                style={{
                  borderColor: e.isFlow ? COMPASS.accent : '#ECE7E2',
                  boxShadow: cardShadow,
                }}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{e.activity}</span>
                <span className="text-[#8A847E]">
                  {e.bucket ? JOURNAL_BUCKET_LABELS[e.bucket] : '—'}
                </span>
                <span className="tabular-nums text-[#8A847E]">
                  {e.engagement}/{e.energy}
                </span>
                <button
                  type="button"
                  className="text-[11px] text-[#8A847E]"
                  onClick={() => openAeiou(e)}
                >
                  AEIOU
                </button>
                <button
                  type="button"
                  className="text-[11px] text-[#E0574A]"
                  onClick={() => void compass.deleteJournalEntry(e.id)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          {dayEntries.length >= 6 && (
            <p className="mt-3 text-center text-[13px] text-[#8A847E]">
              오늘 여기까지면 충분해요
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(
              [
                ['week', '이번 주'],
                ['4w', '4주'],
                ['3m', '3개월'],
                ['all', '전체'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPeriod(k)}
                className="rounded-full px-3 py-1 text-[12px] font-semibold"
                style={
                  period === k
                    ? { background: COMPASS.accent, color: '#fff' }
                    : { background: '#FAF8F6', color: '#8A847E' }
                }
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setGhost((v) => !v)}
              className="ml-auto rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{
                background: ghost ? COMPASS.soft : '#FAF8F6',
                color: COMPASS.ink,
              }}
            >
              과거 고스트 {ghost ? '켜짐' : '꺼짐'}
            </button>
          </div>

          <ScatterPlot
            points={points}
            ghostPoints={ghostPoints}
            onPointClick={(p) => openAeiou(p.sample)}
          />

          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCard label="기록한 날" value={String(daysLogged)} />
            <StatCard label="flow 표시한 활동" value={String(flowCount)} />
            <StatCard label="평균 에너지" value={avgEnergy.toFixed(1)} />
          </div>
        </>
      )}

      {aeiouEntry && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold">AEIOU · {aeiouEntry.activity}</h3>
              <button type="button" onClick={() => setAeiouEntry(null)}>
                닫기
              </button>
            </div>
            {(
              [
                ['activities', '무엇을 하고 있었나 (Activities)'],
                ['environments', '어디였나 (Environments)'],
                ['interactions', '누구와 어떻게 주고받았나 (Interactions)'],
                ['objects', '무엇을 다루고 있었나 (Objects)'],
                ['users', '그때 나는 어떤 역할이었나 (Users)'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="mb-3 block">
                <span className="mb-1 block text-[12px] text-[#8A847E]">{label}</span>
                <textarea
                  rows={2}
                  value={aeiou[k]}
                  onChange={(e) => setAeiou((a) => ({ ...a, [k]: e.target.value }))}
                  className="w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => void saveAeiou()}
              className="mt-2 w-full rounded-full py-2.5 text-[14px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SliderChip({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const positive = value > 0
  return (
    <label className="flex flex-col items-center text-[10px] text-[#8A847E]">
      {label} {value > 0 ? `+${value}` : value}
      <input
        type="range"
        min={-5}
        max={5}
        step={1}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(n === 0 ? 0 : n)
        }}
        className="w-20"
        style={{ accentColor: positive ? COMPASS.accent : '#8A847E' }}
      />
    </label>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-4 text-center"
      style={{ boxShadow: cardShadow }}
    >
      <p className="text-[11px] font-semibold tracking-wider text-[#8A847E]">{label}</p>
      <p className="mt-1 text-[22px] font-bold tabular-nums text-[#1C1B1A]">{value}</p>
    </div>
  )
}

function ScatterPlot({
  points,
  ghostPoints,
  onPointClick,
}: {
  points: {
    key: string
    label: string
    x: number
    y: number
    n: number
    sample: LdJournalEntry
  }[]
  ghostPoints: { key: string; x: number; y: number }[]
  onPointClick: (p: (typeof points)[number]) => void
}) {
  const toXY = (x: number, y: number) => {
    const px = ((x + 5) / 10) * 100
    const py = 100 - ((y + 5) / 10) * 100
    return { px, py }
  }

  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
      style={{ boxShadow: cardShadow }}
    >
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        <Quad label="참고 하는 일" />
        <Quad label="더 하기" accent />
        <Quad label="빼기" />
        <Quad label="재충전 필요" />
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px"
        style={{ background: COMPASS.line }}
      />
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-px w-full"
        style={{ background: COMPASS.line }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {ghostPoints.map((g) => {
          const cur = points.find((p) => p.key === g.key)
          if (!cur) return null
          const a = toXY(g.x, g.y)
          const b = toXY(cur.x, cur.y)
          return (
            <line
              key={`g-${g.key}`}
              x1={a.px}
              y1={a.py}
              x2={b.px}
              y2={b.py}
              stroke={COMPASS.accent}
              strokeWidth={0.4}
              opacity={COMPASS.ghostOpacity + 0.2}
              markerEnd="url(#arrow)"
            />
          )
        })}
        <defs>
          <marker id="arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill={COMPASS.accent} opacity={0.5} />
          </marker>
        </defs>
      </svg>
      {ghostPoints.map((g) => {
        const { px, py } = toXY(g.x, g.y)
        return (
          <span
            key={`gp-${g.key}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${px}%`,
              top: `${py}%`,
              background: COMPASS.line,
              opacity: COMPASS.ghostOpacity + 0.3,
            }}
          />
        )
      })}
      {points.map((p) => {
        const { px, py } = toXY(p.x, p.y)
        const size = 8 + Math.min(16, p.n * 3)
        return (
          <button
            key={p.key}
            type="button"
            title={p.label}
            onClick={() => onPointClick(p)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${px}%`,
              top: `${py}%`,
              width: size,
              height: size,
              background: COMPASS.accent,
            }}
          />
        )
      })}
      <span className="absolute bottom-2 left-2 text-[10px] text-[#8A847E]">몰입 →</span>
      <span className="absolute left-2 top-2 text-[10px] text-[#8A847E]">에너지 ↑</span>
    </div>
  )
}

function Quad({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div className="flex items-start justify-end p-2">
      <span
        className="text-[10px] font-semibold"
        style={{ color: accent ? COMPASS.accent : '#B5AFA8' }}
      >
        {label}
      </span>
    </div>
  )
}
