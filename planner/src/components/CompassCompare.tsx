import { useMemo, useState } from 'react'
import {
  COMPASS,
  DASHBOARD_GAUGES,
  EXERCISE_META,
  formatYm,
  getDashboardGauge,
  normalizeLongformData,
  normalizeCoherenceData,
  normalizeGoodtimeRunData,
  normalizeMindmapData,
  mindmapRoleIdeasFromData,
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
import { ScatterPlot } from './CompassGoodtime'

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
        ) : key === 'coherence' ? (
          <CoherenceCompare snaps={snaps} />
        ) : key === 'odyssey' ? (
          <OdysseyCompare snaps={snaps} />
        ) : key === 'failure' || key === 'gravity' || key === 'team' ? (
          <ListVenn snaps={snaps} exerciseKey={key} />
        ) : key === 'mindmap' ? (
          <MindmapCompare snaps={snaps} />
        ) : key === 'goodtime' ? (
          <GoodtimeRunCompare
            snaps={snaps}
            journalEntries={compass.journalEntries}
          />
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

function CoherenceCompare({ snaps }: { snaps: LdSnapshot[] }) {
  const norms = snaps.map((s) => normalizeCoherenceData(s.data))
  const first = norms[0]
  const last = norms[norms.length - 1]
  const count = (d: typeof first, kind: 'complement' | 'clash' | 'drives') =>
    d.marks.filter((m) => m.kind === kind).length

  const answers: { key: 'complement' | 'clash' | 'drives'; label: string }[] = [
    { key: 'complement', label: '보완' },
    { key: 'clash', label: '충돌' },
    { key: 'drives', label: '이끎' },
  ]

  return (
    <div className="space-y-6">
      <div
        className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
        style={{ boxShadow: cardShadow }}
      >
        <p className="mb-2 text-[13px] font-semibold text-[#8A847E]">
          표시 개수
        </p>
        <p className="text-[14px] text-[#1C1B1A]">
          보완 {count(first, 'complement')}→{count(last, 'complement')}
          {' / '}
          충돌 {count(first, 'clash')}→{count(last, 'clash')}
          {' / '}
          이끎 {count(first, 'drives')}→{count(last, 'drives')}
        </p>
      </div>

      {answers.map(({ key, label }) => (
        <div key={key}>
          <p className="mb-3 text-[13px] font-semibold text-[#8A847E]">{label}</p>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${snaps.length}, minmax(0, 1fr))`,
            }}
          >
            {norms.map((d, i) => (
              <div
                key={snaps[i].id}
                className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                style={{ boxShadow: cardShadow }}
              >
                <p className="mb-2 text-[11px] font-semibold text-[#8A847E]">
                  {formatYm(snaps[i].takenAt)}
                </p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C1B1A]">
                  {d.answers[key].trim() || '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
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

function MindmapCompare({ snaps }: { snaps: LdSnapshot[] }) {
  const norms = snaps.map((s) => normalizeMindmapData(s.data))
  const ideas = norms.map((d) =>
    d.roleIdeas.length ? d.roleIdeas : mindmapRoleIdeasFromData(d),
  )
  const max = Math.max(...ideas.map((x) => x.length), 3)

  return (
    <div className="space-y-6">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i}>
          <p className="mb-3 text-[13px] font-semibold text-[#8A847E]">
            역할 {i + 1}
          </p>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${snaps.length}, minmax(0, 1fr))`,
            }}
          >
            {ideas.map((list, si) => {
              const idea = list[i]
              return (
                <div
                  key={snaps[si].id}
                  className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                  style={{ boxShadow: cardShadow }}
                >
                  <p className="mb-1 text-[11px] font-semibold text-[#8A847E]">
                    {formatYm(snaps[si].takenAt)}
                  </p>
                  <p className="text-[16px] font-bold text-[#1C1B1A]">
                    {idea?.title || '—'}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C1B1A]">
                    {idea?.daySketch || '—'}
                  </p>
                  {idea?.words?.length ? (
                    <p className="mt-2 text-[12px] text-[#8A847E]">
                      {idea.words.join(' · ')}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function GoodtimeRunCompare({
  snaps,
  journalEntries,
}: {
  snaps: LdSnapshot[]
  journalEntries: LdJournalEntry[]
}) {
  const first = snaps[0]
  const last = snaps[snaps.length - 1]
  const aEntries = journalEntries.filter((e) => e.runId === first.id)
  const bEntries = journalEntries.filter((e) => e.runId === last.id)

  const agg = (list: LdJournalEntry[]) => {
    const map = new Map<
      string,
      { eng: number; ene: number; n: number; minutes: number; flow: boolean; label: string }
    >()
    for (const e of list) {
      const k = e.activity.trim().toLowerCase()
      const prev = map.get(k)
      if (!prev) {
        map.set(k, {
          eng: e.engagement,
          ene: e.energy,
          n: 1,
          minutes: e.durationMin,
          flow: e.isFlow,
          label: e.activity.trim(),
        })
      } else {
        map.set(k, {
          ...prev,
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

  const ptsA = agg(aEntries)
  const ptsB = agg(bEntries)
  const setA = new Set(ptsA.map((p) => p.label.toLowerCase()))
  const setB = new Set(ptsB.map((p) => p.label.toLowerCase()))
  const onlyThen = ptsA.filter((p) => !setB.has(p.label.toLowerCase())).map((p) => p.label)
  const both = ptsA.filter((p) => setB.has(p.label.toLowerCase())).map((p) => p.label)
  const onlyNow = ptsB.filter((p) => !setA.has(p.label.toLowerCase())).map((p) => p.label)

  const dataA = normalizeGoodtimeRunData(first.data)
  const dataB = normalizeGoodtimeRunData(last.data)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">
            {formatYm(first.takenAt)}
          </p>
          <ScatterPlot points={ptsA} ghosts={ptsB} size={420} />
        </div>
        <div>
          <p className="mb-2 text-[12px] font-semibold text-[#8A847E]">
            {formatYm(last.takenAt)} (고스트 = 이전 런)
          </p>
          <ScatterPlot points={ptsB} ghosts={ptsA} size={420} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: '사라진 것', items: onlyThen },
          { title: '계속 있는 것', items: both },
          { title: '새로 생긴 것', items: onlyNow },
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

      <div>
        <p className="mb-3 text-[13px] font-semibold text-[#8A847E]">
          주간 회고 · 놀라운 거
        </p>
        {[1, 2, 3].map((week) => {
          const wa = dataA.weekly.find((w) => w.week === week)
          const wb = dataB.weekly.find((w) => w.week === week)
          if (!wa && !wb) return null
          return (
            <div key={week} className="mb-4">
              <p className="mb-2 text-[12px] text-[#B5AFA8]">{week}주차</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: formatYm(first.takenAt), text: wa?.surprise },
                  { label: formatYm(last.takenAt), text: wb?.surprise },
                ].map((col) => (
                  <div
                    key={col.label}
                    className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                    style={{ boxShadow: cardShadow }}
                  >
                    <p className="mb-1 text-[11px] font-semibold text-[#8A847E]">
                      {col.label}
                    </p>
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#1C1B1A]">
                      {col.text?.trim() || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
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
