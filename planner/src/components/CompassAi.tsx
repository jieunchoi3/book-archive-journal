import { useState } from 'react'
import { COMPASS, type LdAiReport } from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { cardShadow } from './CompassExerciseShell'

interface CompassAiProps {
  compass: CompassActions
  onBack: () => void
  onAddWeeklyTask: (label: string) => void
  focusReportId?: string
}

export function CompassAi({
  compass,
  onBack,
  onAddWeeklyTask,
  focusReportId,
}: CompassAiProps) {
  const reports = [...compass.aiReports].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const [activeId, setActiveId] = useState(
    focusReportId ?? reports[0]?.id ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<string | null>(null)

  const active = reports.find((r) => r.id === activeId) ?? reports[0] ?? null

  const runPathway = async () => {
    setLoading(true)
    try {
      const work = compass.completeSnapshotsFor('workview').at(-1)
      const life = compass.completeSnapshotsFor('lifeview').at(-1)
      const ody = compass.completeSnapshotsFor('odyssey').at(-1)
      const dash = compass.completeSnapshotsFor('dashboard')
      const have =
        [work, life, ody].filter(Boolean).length >= 2 &&
        compass.journalEntries.length >= 20
      if (!have) {
        alert(
          'pathway는 workview·lifeview·odyssey 중 2개 이상과 저널 20행이 필요해요.',
        )
        return
      }
      const refs = {
        workview: work?.id,
        lifeview: life?.id,
        odyssey: ody?.id,
        dashboardIds: dash.map((d) => d.id),
        journalCount: compass.journalEntries.length,
      }
      const inputHash = `pathway:v1:${JSON.stringify(refs)}`
      const report = await compass.requestAiReport({
        reportType: 'pathway',
        inputHash,
        inputRefs: refs,
        payload: {
          workview: work?.data,
          lifeview: life?.data,
          odyssey: ody?.data,
          dashboards: dash.map((d) => ({ takenAt: d.takenAt, data: d.data })),
          journalSample: compass.journalEntries.slice(-40),
          prototypes: compass.prototypes,
        },
      })
      setActiveId(report.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pb-24">
      <button type="button" onClick={onBack} className="mb-4 text-[13px] text-[#8A847E]">
        ← Compass
      </button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold text-[#1C1B1A]">AI 리포트</h1>
          <p className="mt-1 text-[14px] text-[#8A847E]">채팅이 아니라 기록 해석 카드</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void runPathway()}
          className="rounded-full px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: COMPASS.accent }}
        >
          {loading ? '기록 읽는 중…' : 'pathway 리포트'}
        </button>
      </div>

      {loading && (
        <div className="mb-4 animate-pulse space-y-2">
          <div className="h-8 rounded-xl bg-[#ECE7E2]" />
          <div className="h-24 rounded-xl bg-[#ECE7E2]" />
          <p className="text-[13px] text-[#8A847E]">
            기록 {compass.snapshots.length + compass.journalEntries.length}개를 읽는 중
          </p>
        </div>
      )}

      {reports.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveId(r.id)}
              className="shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold"
              style={
                active?.id === r.id
                  ? { background: COMPASS.accent, color: '#fff' }
                  : { background: '#FAF8F6', color: '#8A847E' }
              }
            >
              {r.reportType} · {r.createdAt.slice(0, 10)}
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <p className="text-[14px] text-[#8A847E]">
          아직 리포트가 없어요. 비교에서 받거나 pathway를 실행해 보세요.
        </p>
      ) : (
        <ReportCard
          report={active}
          onAddWeeklyTask={(label) => {
            onAddWeeklyTask(label)
            setAdded(label)
          }}
          added={added}
        />
      )}
    </div>
  )
}

function ReportCard({
  report,
  onAddWeeklyTask,
  added,
}: {
  report: LdAiReport
  onAddWeeklyTask: (label: string) => void
  added: string | null
}) {
  const out = report.output
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-bold leading-snug text-[#1C1B1A]">
        {out.headline}
      </h2>

      <section className="space-y-2">
        {(out.observations ?? []).map((o, i) => (
          <div
            key={i}
            className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
            style={{ boxShadow: cardShadow }}
          >
            <p className="text-[14px] text-[#1C1B1A]">{o.text}</p>
            {(o.evidence ?? []).map((e, j) => (
              <blockquote
                key={j}
                className="mt-2 border-l-2 pl-3 text-[13px] text-[#8A847E]"
                style={{ borderColor: COMPASS.line }}
              >
                {e}
              </blockquote>
            ))}
            <p className="mt-1 text-[11px] text-[#B5AFA8]">{o.source}</p>
          </div>
        ))}
      </section>

      {out.pathways && out.pathways.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {out.pathways.map((p, i) => (
            <div
              key={i}
              className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <h3 className="text-[15px] font-semibold">{p.name}</h3>
              <p className="mt-1 text-[11px] text-[#8A847E]">확신 {p.confidence}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-[#5A5550]">
                {p.why_it_fits.map((w, j) => (
                  <li key={j}>{w}</li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-[#B4635A]">
                {(p.friction ?? []).join(' · ')}
              </p>
              <p className="mt-3 text-[13px] font-medium">{p.smallest_test}</p>
              <button
                type="button"
                onClick={() => onAddWeeklyTask(p.smallest_test)}
                className="mt-2 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                style={{ background: COMPASS.accent }}
              >
                Weekly에 넣기
              </button>
              {added === p.smallest_test && (
                <p className="mt-1 text-[11px] text-[#8A847E]">이번 주에 넣었어요</p>
              )}
            </div>
          ))}
        </div>
      )}

      {out.tension && (
        <div
          className="rounded-[18px] border bg-white p-4"
          style={{ borderColor: '#E0574A', boxShadow: cardShadow }}
        >
          <p className="text-[12px] font-semibold text-[#E0574A]">긴장</p>
          <p className="mt-1 text-[14px]">{out.tension}</p>
        </div>
      )}

      {(out.unknowns ?? []).length > 0 && (
        <ul className="rounded-[18px] bg-[#FAF8F6] p-4 text-[13px] text-[#8A847E]">
          {(out.unknowns ?? []).map((u, i) => (
            <li key={i} className="mb-1">
              · {u}
            </li>
          ))}
        </ul>
      )}

      {out.next_question && (
        <p className="text-[14px] font-medium" style={{ color: COMPASS.ink }}>
          다음 질문: {out.next_question}
        </p>
      )}
    </div>
  )
}
