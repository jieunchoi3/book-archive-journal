import { useMemo, useState } from 'react'
import {
  COMPASS,
  DASHBOARD_GAUGES,
  EXERCISE_META,
  formatYm,
  getDashboardGauge,
  normalizeLongformData,
  type DashboardData,
  type ExerciseKey,
  type FailureData,
  type GravityData,
  type LdJournalEntry,
  type LdSnapshot,
  type OdysseyData,
  type TeamData,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { cardShadow } from './CompassExerciseShell'

interface CompassCompareProps {
  compass: CompassActions
  onBack: () => void
  onRequestAi: (snapshotIds: string[], exerciseKey: ExerciseKey) => void
  initialKey?: ExerciseKey
  initialIds?: string[]
}

const COMPAREABLE: ExerciseKey[] = [
  'dashboard',
  'workview',
  'lifeview',
  'odyssey',
  'goodtime',
  'failure',
  'gravity',
  'team',
  'coherence',
  'choosing',
  'mindmap',
]

export function CompassCompare({
  compass,
  onBack,
  onRequestAi,
  initialKey,
  initialIds,
}: CompassCompareProps) {
  const [key, setKey] = useState<ExerciseKey>(initialKey ?? 'dashboard')
  const completes = compass.completeSnapshotsFor(key)
  const [ids, setIds] = useState<string[]>(() => {
    if (initialIds?.length) return initialIds.slice(0, 3)
    return completes.slice(-2).map((s) => s.id)
  })

  const snaps = ids
    .map((id) => completes.find((s) => s.id === id))
    .filter(Boolean) as LdSnapshot[]

  const setSlot = (index: number, id: string) => {
    setIds((prev) => {
      const next = [...prev]
      next[index] = id
      return next
    })
  }

  return (
    <div className="pb-28">
      <button type="button" onClick={onBack} className="mb-4 text-[13px] text-[#8A847E]">
        ← Compass
      </button>
      <h1 className="text-[28px] font-bold text-[#1C1B1A]">비교</h1>
      <p className="mt-1 text-[14px] text-[#8A847E]">그때의 나와 지금의 나</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-[#8A847E]">
          연습
          <select
            value={key}
            onChange={(e) => {
              const k = e.target.value as ExerciseKey
              setKey(k)
              const c = compass.completeSnapshotsFor(k)
              setIds(c.slice(-2).map((s) => s.id))
            }}
            className="ml-2 rounded-xl border border-[#ECE7E2] bg-white px-2 py-1.5 text-[13px]"
          >
            {COMPAREABLE.map((k) => {
              const meta = EXERCISE_META.find((m) => m.key === k)
              return (
                <option key={k} value={k}>
                  {meta?.name ?? k}
                </option>
              )
            })}
          </select>
        </label>
        {ids.map((id, i) => (
          <label key={i} className="text-[12px] text-[#8A847E]">
            {i === 0 ? '비교' : '↔'}
            <select
              value={id}
              onChange={(e) => setSlot(i, e.target.value)}
              className="ml-1 rounded-xl border border-[#ECE7E2] bg-white px-2 py-1.5 text-[13px]"
            >
              {completes.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatYm(s.takenAt)} {s.label ?? ''}
                </option>
              ))}
            </select>
          </label>
        ))}
        {ids.length < 3 && completes.length > ids.length && (
          <button
            type="button"
            className="rounded-full border border-[#ECE7E2] px-3 py-1 text-[12px]"
            onClick={() => {
              const next = completes.find((s) => !ids.includes(s.id))
              if (next) setIds((p) => [...p, next.id])
            }}
          >
            + 하나 더
          </button>
        )}
      </div>

      <div className="mt-6">
        {snaps.length < 2 ? (
          <p className="text-[14px] text-[#8A847E]">
            같은 연습의 완료 기록이 2개 이상 있어야 비교할 수 있어요.
          </p>
        ) : key === 'dashboard' ? (
          <GaugeCompare snaps={snaps} />
        ) : key === 'workview' || key === 'lifeview' ? (
          <LongformCompare snaps={snaps} />
        ) : key === 'odyssey' ? (
          <OdysseyCompare snaps={snaps} />
        ) : key === 'failure' || key === 'gravity' || key === 'team' ? (
          <ListVenn snaps={snaps} exerciseKey={key} />
        ) : key === 'goodtime' ? (
          <GoodtimePeriodCompare compass={compass} />
        ) : (
          <GenericJsonCompare snaps={snaps} />
        )}
      </div>

      {snaps.length >= 2 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#ECE7E2] bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-none justify-center px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => onRequestAi(snaps.map((s) => s.id), key)}
              className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
            >
              이 비교로 AI 리포트 받기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function GaugeCompare({ snaps }: { snaps: LdSnapshot[] }) {
  return (
    <div>
      <div
        className="mb-4 overflow-x-auto rounded-[18px] border border-[#ECE7E2] bg-white p-4"
        style={{ boxShadow: cardShadow }}
      >
        <svg viewBox={`0 0 ${Math.max(320, snaps.length * 120)} 160`} className="h-40 w-full">
          {DASHBOARD_GAUGES.map((g) => {
            const pts = snaps.map((s, i) => {
              const raw = getDashboardGauge(
                s.data as unknown as DashboardData,
                g.key,
              )
              const v = raw ?? 0
              const x = 40 + i * 100
              const y = 140 - (v / 120) * 120
              return `${x},${y}`
            })
            return (
              <polyline
                key={g.key}
                fill="none"
                stroke={g.color}
                strokeWidth={2}
                points={pts.join(' ')}
              />
            )
          })}
          {snaps.map((s, i) => (
            <text
              key={s.id}
              x={40 + i * 100}
              y={155}
              textAnchor="middle"
              fontSize={10}
              fill="#8A847E"
            >
              {formatYm(s.takenAt)}
            </text>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DASHBOARD_GAUGES.map((g) => {
          const first =
            getDashboardGauge(snaps[0].data as unknown as DashboardData, g.key) ?? 0
          const last =
            getDashboardGauge(
              snaps[snaps.length - 1].data as unknown as DashboardData,
              g.key,
            ) ?? 0
          const delta = last - first
          return (
            <div
              key={g.key}
              className="rounded-[18px] border border-[#ECE7E2] bg-white p-4 text-center"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-[12px] text-[#8A847E]">{g.label}</p>
              <p
                className="mt-1 text-[22px] font-bold tabular-nums"
                style={{ color: g.color }}
              >
                {delta > 0 ? `+${delta}` : delta}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LongformCompare({ snaps }: { snaps: LdSnapshot[] }) {
  const [diffOnly, setDiffOnly] = useState(false)
  const first = normalizeLongformData(snaps[0].data)
  const last = normalizeLongformData(snaps[snaps.length - 1].data)
  const a = (first.body ?? '').split(/\n\n+/).filter(Boolean)
  const b = (last.body ?? '').split(/\n\n+/).filter(Boolean)
  const max = Math.max(a.length, b.length)

  const setA = new Set(first.reasons.map((r) => r.trim()).filter(Boolean))
  const setB = new Set(last.reasons.map((r) => r.trim()).filter(Boolean))
  const onlyThen = [...setA].filter((x) => !setB.has(x))
  const both = [...setA].filter((x) => setB.has(x))
  const onlyNow = [...setB].filter((x) => !setA.has(x))

  return (
    <div className="space-y-6">
      {(first.reasons.length > 0 || last.reasons.length > 0) && (
        <div>
          <p className="mb-3 text-[13px] font-semibold text-[#8A847E]">
            쏟아낸 이유 · 집합 비교
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: '그때만 있던 것', items: onlyThen },
              { title: '계속 있는 것', items: both },
              { title: '지금 새로 생긴 것', items: onlyNow },
            ].map((col) => (
              <div
                key={col.title}
                className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                style={{ boxShadow: cardShadow }}
              >
                <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">
                  {col.title}
                </p>
                <ul className="space-y-1 text-[13px] text-[#1C1B1A]">
                  {col.items.length === 0 ? (
                    <li className="text-[#B5AFA8]">—</li>
                  ) : (
                    col.items.map((t) => <li key={t}>· {t}</li>)
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {(first.values.some(Boolean) || last.values.some(Boolean)) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: formatYm(snaps[0].takenAt), values: first.values },
            {
              label: formatYm(snaps[snaps.length - 1].takenAt),
              values: last.values,
            },
          ].map((col) => (
            <div
              key={col.label}
              className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">
                가치 · {col.label}
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-[14px]">
                {col.values.map((v, i) => (
                  <li key={i}>{v || '—'}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setDiffOnly((v) => !v)}
          className="mb-3 rounded-full px-3 py-1 text-[12px] font-semibold"
          style={{ background: COMPASS.soft, color: COMPASS.ink }}
        >
          {diffOnly ? '전체 보기' : '달라진 데만 보기'}
        </button>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold text-[#8A847E]">
              {formatYm(snaps[0].takenAt)}
            </p>
            {Array.from({ length: max }).map((_, i) => {
              const changed = a[i] !== b[i]
              if (diffOnly && !changed) return null
              return (
                <p
                  key={i}
                  className="mb-3 border-l-[3px] pl-3 font-serif text-[15px] leading-relaxed"
                  style={{ borderColor: changed ? COMPASS.accent : 'transparent' }}
                >
                  {a[i] ?? '—'}
                </p>
              )
            })}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold text-[#8A847E]">
              {formatYm(snaps[snaps.length - 1].takenAt)}
            </p>
            {Array.from({ length: max }).map((_, i) => {
              const changed = a[i] !== b[i]
              if (diffOnly && !changed) return null
              return (
                <p
                  key={i}
                  className="mb-3 border-l-[3px] pl-3 font-serif text-[15px] leading-relaxed"
                  style={{ borderColor: changed ? COMPASS.accent : 'transparent' }}
                >
                  {b[i] ?? '—'}
                </p>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function OdysseyCompare({ snaps }: { snaps: LdSnapshot[] }) {
  const plans = ['A', 'B', 'C']
  const gaugeMeta = [
    { key: 'resources' as const, label: '자원', color: '#5E8C7B' },
    { key: 'pull' as const, label: '끌림', color: '#3E6B5E' },
    { key: 'confidence' as const, label: '자신감', color: '#C08A4A' },
    { key: 'coherence' as const, label: '내 관점과 맞나', color: '#B4635A' },
  ]
  return (
    <div className="space-y-6">
      {plans.map((pid, pi) => (
        <div key={pid}>
          <h3 className="mb-2 text-[14px] font-semibold">플랜 {pid}</h3>
          <div className="flex gap-3 overflow-x-auto">
            {snaps.map((s) => {
              const plan = (s.data as unknown as OdysseyData).plans?.[pi]
              return (
                <div
                  key={s.id}
                  className="w-56 shrink-0 rounded-[18px] border border-[#ECE7E2] bg-white p-3"
                  style={{ boxShadow: cardShadow }}
                >
                  <p className="text-[11px] text-[#8A847E]">{formatYm(s.takenAt)}</p>
                  <p className="mt-1 text-[14px] font-semibold">{plan?.title || plan?.badge}</p>
                  <ul className="mt-2 space-y-1 text-[12px] text-[#5A5550]">
                    {(plan?.milestones ?? []).map((m) => (
                      <li key={m.id}>
                        {m.yearIndex + 1}년 · {m.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {snaps.length >= 2 && (
            <div
              className="mt-3 overflow-x-auto rounded-[18px] border border-[#ECE7E2] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <svg
                viewBox={`0 0 ${Math.max(280, snaps.length * 100)} 140`}
                className="h-32 w-full"
              >
                {gaugeMeta.map((g) => {
                  const pts = snaps.map((s, i) => {
                    const v =
                      (s.data as unknown as OdysseyData).plans?.[pi]?.gauges?.[g.key] ?? 0
                    const x = 36 + i * 90
                    const y = 110 - (v / 5) * 90
                    return `${x},${y}`
                  })
                  return (
                    <polyline
                      key={g.key}
                      fill="none"
                      stroke={g.color}
                      strokeWidth={2}
                      points={pts.join(' ')}
                    />
                  )
                })}
                {snaps.map((s, i) => (
                  <text
                    key={s.id}
                    x={36 + i * 90}
                    y={130}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#8A847E"
                  >
                    {formatYm(s.takenAt)}
                  </text>
                ))}
              </svg>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {gaugeMeta.map((g) => {
                  const first =
                    (snaps[0].data as unknown as OdysseyData).plans?.[pi]?.gauges?.[
                      g.key
                    ] ?? 0
                  const last =
                    (snaps[snaps.length - 1].data as unknown as OdysseyData).plans?.[
                      pi
                    ]?.gauges?.[g.key] ?? 0
                  const delta = last - first
                  return (
                    <div key={g.key} className="rounded-xl bg-[#FAF8F6] px-2 py-2 text-center">
                      <p className="text-[11px] text-[#8A847E]">{g.label}</p>
                      <p
                        className="text-[18px] font-bold tabular-nums"
                        style={{ color: g.color }}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {snaps.length >= 2 && (
            <MilestoneDiff
              a={(snaps[0].data as unknown as OdysseyData).plans?.[pi]?.milestones ?? []}
              b={
                (snaps[snaps.length - 1].data as unknown as OdysseyData).plans?.[pi]
                  ?.milestones ?? []
              }
            />
          )}
        </div>
      ))}
    </div>
  )
}

function MilestoneDiff({
  a,
  b,
}: {
  a: { label: string }[]
  b: { label: string }[]
}) {
  const aSet = new Set(a.map((m) => m.label))
  const bSet = new Set(b.map((m) => m.label))
  const gone = [...aSet].filter((x) => !bSet.has(x))
  if (!gone.length) return null
  return (
    <p className="mt-1 text-[12px] text-[#8A847E]">
      사라진 마일스톤:{' '}
      {gone.map((g) => (
        <span key={g} className="mr-2 line-through">
          {g}
        </span>
      ))}
    </p>
  )
}

function listLabels(snap: LdSnapshot, key: ExerciseKey): string[] {
  if (key === 'failure') {
    return ((snap.data as unknown as FailureData).rows ?? [])
      .map((r) => r.event)
      .filter(Boolean)
  }
  if (key === 'gravity') {
    return ((snap.data as unknown as GravityData).items ?? [])
      .map((i) => i.problem)
      .filter(Boolean)
  }
  return ((snap.data as unknown as TeamData).people ?? [])
    .map((p) => p.name)
    .filter(Boolean)
}

function ListVenn({
  snaps,
  exerciseKey,
}: {
  snaps: LdSnapshot[]
  exerciseKey: ExerciseKey
}) {
  const a = new Set(listLabels(snaps[0], exerciseKey))
  const b = new Set(listLabels(snaps[snaps.length - 1], exerciseKey))
  const onlyThen = [...a].filter((x) => !b.has(x))
  const both = [...a].filter((x) => b.has(x))
  const onlyNow = [...b].filter((x) => !a.has(x))

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ['그때만 있던 것', onlyThen],
        ['계속 있는 것', both],
        ['지금 새로 생긴 것', onlyNow],
      ].map(([title, items]) => (
        <div
          key={title as string}
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
          style={{ boxShadow: cardShadow }}
        >
          <h3 className="mb-2 text-[12px] font-semibold text-[#8A847E]">{title as string}</h3>
          <ul className="space-y-1 text-[13px]">
            {(items as string[]).map((t) => (
              <li key={t}>{t}</li>
            ))}
            {(items as string[]).length === 0 && (
              <li className="text-[#B5AFA8]">없음</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}

function GenericJsonCompare({ snaps }: { snaps: LdSnapshot[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {snaps.map((s) => (
        <div
          key={s.id}
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
          style={{ boxShadow: cardShadow }}
        >
          <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">
            {formatYm(s.takenAt)} {s.label}
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-[#5A5550]">
            {JSON.stringify(s.data, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

function GoodtimePeriodCompare({ compass }: { compass: CompassActions }) {
  const dayMs = 86400000
  const now = Date.now()
  const recent = compass.journalEntries.filter(
    (e) => now - Date.parse(e.entryDate) <= 28 * dayMs,
  )
  const prior = compass.journalEntries.filter((e) => {
    const t = Date.parse(e.entryDate)
    return t < now - 28 * dayMs && t >= now - 56 * dayMs
  })

  const agg = (list: LdJournalEntry[]) => {
    const map = new Map<string, { eng: number; ene: number; n: number; label: string }>()
    for (const e of list) {
      const k = e.activity.trim().toLowerCase()
      const prev = map.get(k)
      if (!prev) map.set(k, { eng: e.engagement, ene: e.energy, n: 1, label: e.activity })
      else
        map.set(k, {
          eng: prev.eng + e.engagement,
          ene: prev.ene + e.energy,
          n: prev.n + 1,
          label: prev.label,
        })
    }
    return [...map.entries()].map(([key, v]) => ({
      key,
      label: v.label,
      x: v.eng / v.n,
      y: v.ene / v.n,
    }))
  }

  const cur = agg(recent)
  const ghost = agg(prior)
  const toXY = (x: number, y: number) => ({
    px: ((x + 5) / 10) * 100,
    py: 100 - ((y + 5) / 10) * 100,
  })

  return (
    <div>
      <p className="mb-2 text-[12px] text-[#8A847E]">
        최근 4주(실선 점) vs 그전 4주(고스트) · 화살표는 이동
      </p>
      <div
        className="relative aspect-square w-full max-w-md overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
        style={{ boxShadow: cardShadow }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-full w-px"
          style={{ background: COMPASS.line }}
        />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-px w-full"
          style={{ background: COMPASS.line }}
        />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="cmp-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4 Z" fill={COMPASS.accent} opacity={0.5} />
            </marker>
          </defs>
          {ghost.map((g) => {
            const c = cur.find((p) => p.key === g.key)
            if (!c) return null
            const a = toXY(g.x, g.y)
            const b = toXY(c.x, c.y)
            return (
              <line
                key={g.key}
                x1={a.px}
                y1={a.py}
                x2={b.px}
                y2={b.py}
                stroke={COMPASS.accent}
                strokeWidth={0.5}
                opacity={0.45}
                markerEnd="url(#cmp-arrow)"
              />
            )
          })}
        </svg>
        {ghost.map((g) => {
          const { px, py } = toXY(g.x, g.y)
          return (
            <span
              key={`g-${g.key}`}
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${px}%`,
                top: `${py}%`,
                background: COMPASS.line,
                opacity: 0.5,
              }}
            />
          )
        })}
        {cur.map((p) => {
          const { px, py } = toXY(p.x, p.y)
          return (
            <span
              key={p.key}
              title={p.label}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${px}%`,
                top: `${py}%`,
                background: COMPASS.accent,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export function hashCompareInput(ids: string[], key: ExerciseKey) {
  return `compare:v1:${key}:${ids.join(',')}`
}

export function useCompareReady(compass: CompassActions) {
  return useMemo(
    () =>
      EXERCISE_META.some(
        (m) => compass.completeSnapshotsFor(m.key).length >= 2,
      ),
    [compass],
  )
}
