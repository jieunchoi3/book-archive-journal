import { useMemo, useState } from 'react'
import {
  Activity,
  Compass,
  LayoutDashboard,
  Mail,
  Search,
} from 'lucide-react'
import {
  COMPASS,
  EXERCISE_META,
  formatYm,
  type CompassRoute,
  type ExerciseKey,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'

interface CompassOverviewProps {
  compass: CompassActions
  year: number
  onYearChange: (y: number) => void
  onNavigate: (route: CompassRoute) => void
}

export function CompassOverview({
  compass,
  year,
  onYearChange,
  onNavigate,
}: CompassOverviewProps) {
  const [query, setQuery] = useState('')
  const hasAny =
    compass.snapshots.some((s) => s.status === 'complete') ||
    compass.questions.length > 0

  const yearTrack = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i)
    return months.map((m) => {
      const label = new Date(year, m, 1).toLocaleString('en', { month: 'short' })
      const dots: string[] = []
      for (const d of compass.activityDates) {
        if (!d.startsWith(`${year}-`)) continue
        const month = Number(d.slice(5, 7)) - 1
        if (month === m) dots.push(d)
      }
      return { label, dots: [...new Set(dots)].sort() }
    })
  }, [compass.activityDates, year])

  const filteredCards = EXERCISE_META.filter((m) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    )
  })

  const askHits = compass.questions.filter((q) =>
    q.body.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="pb-24">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: COMPASS.soft }}
          >
            <Compass size={28} style={{ color: COMPASS.accent }} />
          </div>
          <div className="pt-1">
            <h1 className="text-[32px] font-bold leading-none tracking-tight text-[#1C1B1A]">
              Compass
            </h1>
            <p className="mt-2 max-w-md text-[15px] text-[#8A847E]">
              같은 질문을 다시 던지고, 그때의 나와 비교하는 곳
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[14px]">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[#8A847E] hover:bg-[#FAF8F6]"
            onClick={() => onYearChange(year - 1)}
            aria-label="이전 해"
          >
            ‹
          </button>
          <span className="min-w-[4.5rem] text-center font-semibold text-[#1C1B1A]">
            {year}
          </span>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[#8A847E] hover:bg-[#FAF8F6]"
            onClick={() => onYearChange(year + 1)}
            aria-label="다음 해"
          >
            ›
          </button>
          <button
            type="button"
            className="ml-1 text-[13px] font-medium"
            style={{ color: COMPASS.accent }}
            onClick={() => onYearChange(new Date().getFullYear())}
          >
            Today
          </button>
        </div>
      </header>

      <div className="relative mb-5">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B5AFA8]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="연습, 질문, 답변에서 찾기…"
          className="w-full rounded-[14px] border border-[#ECE7E2] bg-white py-3 pl-10 pr-4 text-[14px] text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        />
      </div>

      {compass.revisitItems.length > 0 && (
        <section
          className="mb-5 overflow-hidden rounded-xl border backdrop-blur-md"
          style={{
            borderColor: `${COMPASS.accent}33`,
            background: `${COMPASS.soft}f2`,
          }}
          aria-label="이번에 다시 볼 것"
        >
          <div
            className="flex items-center gap-2 border-b px-4 py-2.5"
            style={{ borderColor: `${COMPASS.accent}22` }}
          >
            <Activity size={14} style={{ color: COMPASS.accent }} />
            <h2
              className="text-[12px] font-semibold tracking-wide"
              style={{ color: COMPASS.ink }}
            >
              이번에 다시 볼 것
            </h2>
          </div>
          <ul className="flex flex-col gap-1 px-3 py-2.5">
            {compass.revisitItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-1 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#1C1B1A]">
                    {item.kind === 'question' ? `“${item.title}”` : item.title}
                  </p>
                  <p className="text-[12px] text-[#8A847E]">{item.subtitle}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{ background: COMPASS.accent }}
                  onClick={() => {
                    if (item.action === 'open-ask' && item.questionId) {
                      onNavigate({
                        page: 'askDetail',
                        questionId: item.questionId,
                      })
                    } else if (item.exerciseKey) {
                      onNavigate({
                        page: 'exercise',
                        key: item.exerciseKey,
                      })
                    }
                  }}
                >
                  {item.kind === 'question' ? '열기' : '다시'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasAny && (
        <p className="mb-5 text-[14px] text-[#8A847E]">
          아직 기록이 없어요. 아무 연습이나 Ask부터 열어보세요 — 순서는 상관없어요.
        </p>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-[#8A847E]">
          YEAR TRACK
        </h2>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {yearTrack.map((m) => (
            <div
              key={m.label}
              className="min-w-[4.5rem] rounded-xl bg-[#FAF8F6] px-2 py-2"
            >
              <p className="text-[11px] font-medium text-[#8A847E]">{m.label}</p>
              <p className="mt-1 font-mono text-[11px] tracking-widest text-[#1C1B1A]">
                {m.dots.length === 0
                  ? '····'
                  : m.dots
                      .slice(0, 5)
                      .map(() => '●')
                      .join('')
                      .padEnd(4, '·')
                      .slice(0, 5)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'ask' })}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: COMPASS.accent }}
        >
          <Mail size={14} />
          Ask Myself
          {compass.badgeCount > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 text-[11px]">
              {compass.badgeCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ page: 'compare' })}
          className="rounded-full border border-[#ECE7E2] bg-white px-4 py-2 text-[13px] font-semibold text-[#1C1B1A]"
        >
          비교
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ page: 'ai' })}
          className="rounded-full border border-[#ECE7E2] bg-white px-4 py-2 text-[13px] font-semibold text-[#1C1B1A]"
        >
          AI 리포트
        </button>
      </div>

      {query && askHits.length > 0 && (
        <ul className="mb-4 space-y-2">
          {askHits.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className="w-full rounded-xl bg-[#FAF8F6] px-3 py-2 text-left text-[14px]"
                onClick={() =>
                  onNavigate({ page: 'askDetail', questionId: q.id })
                }
              >
                “{q.body}”
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCards.map((meta) => (
          <ExerciseCard
            key={meta.key}
            meta={meta}
            compass={compass}
            onOpen={(key, snapshotId) =>
              onNavigate({ page: 'exercise', key, snapshotId })
            }
            onCompare={() => onNavigate({ page: 'compare' })}
          />
        ))}
        <button
          type="button"
          onClick={() => onNavigate({ page: 'ask' })}
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 text-left"
          style={{
            boxShadow:
              '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
          }}
        >
          <div
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: COMPASS.soft }}
          >
            <Mail size={20} style={{ color: COMPASS.accent }} />
          </div>
          <h3 className="text-[17px] font-semibold text-[#1C1B1A]">Ask Myself</h3>
          <p className="mt-1 text-[13px] text-[#8A847E]">
            커스텀 질문을 몇 달마다 다시 열기
          </p>
          <p className="mt-3 text-[12px] text-[#8A847E]">
            질문 {compass.questions.length}개
          </p>
        </button>
      </div>
    </div>
  )
}

function ExerciseCard({
  meta,
  compass,
  onOpen,
  onCompare,
}: {
  meta: (typeof EXERCISE_META)[number]
  compass: CompassActions
  onOpen: (key: ExerciseKey, snapshotId?: string) => void
  onCompare: () => void
}) {
  const completes = compass.completeSnapshotsFor(meta.key)
  const last = completes[completes.length - 1]
  const mini = completes.slice(-5)

  return (
    <div
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-6"
      style={{
        boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
      }}
    >
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: COMPASS.soft }}
      >
        <LayoutDashboard size={20} style={{ color: COMPASS.accent }} />
      </div>
      <h3 className="text-[17px] font-semibold text-[#1C1B1A]">{meta.name}</h3>
      <p className="mt-1 text-[13px] text-[#8A847E]">{meta.description}</p>
      <p className="mt-3 text-[12px] text-[#8A847E]">
        {last ? `마지막 ${formatYm(last.takenAt)}` : '아직 없음'}
      </p>
      {mini.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          {mini.map((s) => (
            <span
              key={s.id}
              className="h-2 w-2 rounded-full"
              style={{ background: COMPASS.accent }}
              title={s.takenAt}
            />
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: COMPASS.accent }}
          onClick={() => {
            void (async () => {
              if (last) {
                const draft = await compass.createDraft(meta.key, undefined, true)
                onOpen(meta.key, draft.id)
              } else {
                onOpen(meta.key)
              }
            })()
          }}
        >
          {last ? '다시 하기' : '하기'}
        </button>
        {completes.length >= 2 && (
          <button
            type="button"
            className="rounded-full border border-[#ECE7E2] px-4 py-2 text-[13px] font-semibold text-[#1C1B1A]"
            onClick={onCompare}
          >
            비교
          </button>
        )}
      </div>
    </div>
  )
}
