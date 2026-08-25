import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  COMPASS,
  EXERCISE_META,
  emptyOdysseyData,
  type CompassRoute,
  type ExerciseKey,
  type MindmapRoleIdea,
  type OdysseyData,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { CompassOverview } from './CompassOverview'
import { CompassDashboard } from './CompassDashboard'
import { CompassAskDetail, CompassAskList } from './CompassAsk'
import { CompassLongform } from './CompassLongform'
import { CompassCoherence } from './CompassCoherence'
import { CompassGoodtime } from './CompassGoodtime'
import { CompassOdyssey } from './CompassOdyssey'
import { CompassPrototype } from './CompassPrototype'
import { CompassChoosing } from './CompassChoosing'
import { CompassFailure } from './CompassFailure'
import { CompassGravity } from './CompassGravity'
import { CompassTeam } from './CompassTeam'
import { CompassMindmap } from './CompassMindmap'
import { CompassCompare, hashCompareInput } from './CompassCompare'
import { CompassAi } from './CompassAi'

interface CompassViewProps {
  compass: CompassActions
  route: CompassRoute
  onRouteChange: (route: CompassRoute) => void
  onAddWeeklyTask: (label: string) => void
}

export function CompassView({
  compass,
  route,
  onRouteChange,
  onAddWeeklyTask,
}: CompassViewProps) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [protoPlanLink, setProtoPlanLink] = useState<string | null>(null)
  const [aiFocus, setAiFocus] = useState<string | undefined>()
  const [compareSeed, setCompareSeed] = useState<{
    key?: ExerciseKey
    ids?: string[]
  }>({})

  const requestSnapshotAi = async (snapshotId: string) => {
    const snap = compass.snapshots.find((s) => s.id === snapshotId)
    if (!snap) return
    const report = await compass.requestAiReport({
      reportType: 'snapshot',
      inputHash: `snapshot:v1:${snap.id}`,
      inputRefs: { snapshotId: snap.id, exerciseKey: snap.exerciseKey },
      payload: {
        id: snap.id,
        exerciseKey: snap.exerciseKey,
        takenAt: snap.takenAt,
        label: snap.label,
        data: snap.data,
      },
    })
    setAiFocus(report.id)
    onRouteChange({ page: 'ai' })
  }

  const sendIdeaToOdyssey = async (idea: MindmapRoleIdea) => {
    const draft = await compass.createDraft('odyssey', undefined, false)
    const current = compass.getDraftData(draft, emptyOdysseyData())
    const plans = (
      current.plans?.length === 3 ? current.plans : emptyOdysseyData().plans
    ).map((p) => ({ ...p })) as OdysseyData['plans']
    let idx = plans.findIndex((p) => !p.title.trim())
    if (idx < 0) idx = 0
    const plan = plans[idx]
    const qs = [...plan.questions] as [string, string, string]
    if (!qs[0].trim() && idea.daySketch.trim()) qs[0] = idea.daySketch
    plans[idx] = {
      ...plan,
      title: idea.title.trim() || plan.title,
      questions: qs,
    }
    await compass.updateDraftData(draft.id, { plans } as unknown as Record<string, unknown>)
    onRouteChange({ page: 'exercise', key: 'odyssey', snapshotId: draft.id })
  }

  if (compass.loading) {
    return (
      <div className="min-h-screen w-full bg-[#F7F5F3] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <p className="text-[14px] text-[#8A847E]">불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F5F3] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      {route.page === 'overview' && (
        <CompassOverview
          compass={compass}
          year={year}
          onYearChange={setYear}
          onNavigate={onRouteChange}
          onCompareExercise={(key, ids) => {
            setCompareSeed({ key, ids })
            onRouteChange({ page: 'compare' })
          }}
        />
      )}

      {route.page === 'ask' && (
        <CompassAskList
          compass={compass}
          onBack={() => onRouteChange({ page: 'overview' })}
          onOpenQuestion={(questionId) =>
            onRouteChange({ page: 'askDetail', questionId })
          }
        />
      )}

      {route.page === 'askDetail' && (
        <CompassAskDetail
          compass={compass}
          questionId={route.questionId}
          onBack={() => onRouteChange({ page: 'ask' })}
        />
      )}

      {route.page === 'exercise' && (
        <ExerciseShell
          exerciseKey={route.key}
          snapshotId={route.snapshotId}
          compass={compass}
          onBack={() => onRouteChange({ page: 'overview' })}
          onSnapshot={(snapshotId) =>
            onRouteChange({ page: 'exercise', key: route.key, snapshotId })
          }
          onCompare={(ids) => {
            setCompareSeed({ key: route.key, ids })
            onRouteChange({ page: 'compare' })
          }}
          onRequestSnapshotAi={(id) => void requestSnapshotAi(id)}
          onOpenExercise={(key) => onRouteChange({ page: 'exercise', key })}
          onCreatePrototype={(planId) => {
            setProtoPlanLink(planId)
            onRouteChange({ page: 'exercise', key: 'prototype' })
          }}
          protoPlanLink={protoPlanLink}
          onSendToOdyssey={(idea) => void sendIdeaToOdyssey(idea)}
        />
      )}

      {route.page === 'compare' && (
        <CompassCompare
          compass={compass}
          onBack={() => onRouteChange({ page: 'overview' })}
          initialKey={compareSeed.key}
          initialIds={compareSeed.ids}
          onRequestAi={async (snapshotIds, exerciseKey) => {
            const inputHash = hashCompareInput(snapshotIds, exerciseKey)
            const snaps = snapshotIds
              .map((id) => compass.snapshots.find((s) => s.id === id))
              .filter(Boolean)
            const report = await compass.requestAiReport({
              reportType: 'compare',
              inputHash,
              inputRefs: { snapshotIds, exerciseKey },
              payload: snaps.map((s) => ({
                id: s!.id,
                takenAt: s!.takenAt,
                label: s!.label,
                data: s!.data,
              })),
            })
            setAiFocus(report.id)
            onRouteChange({ page: 'ai' })
          }}
        />
      )}

      {route.page === 'ai' && (
        <CompassAi
          compass={compass}
          onBack={() => onRouteChange({ page: 'overview' })}
          onAddWeeklyTask={onAddWeeklyTask}
          focusReportId={aiFocus}
          onOpenSource={(source) => {
            const last = compass.completeSnapshotsFor(source).at(-1)
            onRouteChange({
              page: 'exercise',
              key: source,
              snapshotId: last?.id,
            })
          }}
        />
      )}
    </div>
  )
}

function ExerciseShell({
  exerciseKey,
  snapshotId,
  compass,
  onBack,
  onSnapshot,
  onCompare,
  onRequestSnapshotAi,
  onOpenExercise,
  onCreatePrototype,
  protoPlanLink,
  onSendToOdyssey,
}: {
  exerciseKey: ExerciseKey
  snapshotId?: string
  compass: CompassActions
  onBack: () => void
  onSnapshot: (id: string | undefined) => void
  onCompare: (ids: [string, string]) => void
  onRequestSnapshotAi: (snapshotId: string) => void
  onOpenExercise: (key: ExerciseKey) => void
  onCreatePrototype: (planId: string, title: string) => void
  protoPlanLink: string | null
  onSendToOdyssey: (idea: MindmapRoleIdea) => void
}) {
  const meta = EXERCISE_META.find((m) => m.key === exerciseKey)

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8A847E]"
      >
        <ArrowLeft size={16} /> Compass
      </button>
      {meta && exerciseKey !== 'goodtime' && exerciseKey !== 'prototype' && (
        <div className="mb-4 flex items-start gap-3">
          <div
            className="flex h-[48px] w-[48px] items-center justify-center rounded-[14px]"
            style={{ background: COMPASS.soft }}
          >
            <span className="text-lg" style={{ color: COMPASS.accent }}>
              ▦
            </span>
          </div>
          <div>
            <h1 className="text-[28px] font-bold leading-none text-[#1C1B1A]">
              {meta.name}
            </h1>
            <p className="mt-1.5 text-[14px] text-[#8A847E]">{meta.description}</p>
          </div>
        </div>
      )}

      {exerciseKey === 'dashboard' && (
        <CompassDashboard
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
        />
      )}
      {(exerciseKey === 'workview' || exerciseKey === 'lifeview') && (
        <CompassLongform
          kind={exerciseKey}
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
          onOpenExercise={(k) => onOpenExercise(k)}
        />
      )}
      {exerciseKey === 'coherence' && (
        <CompassCoherence
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onOpenExercise={(k) => onOpenExercise(k)}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
        />
      )}
      {exerciseKey === 'goodtime' && (
        <>
          <div className="mb-4 flex items-start gap-3">
            <div
              className="flex h-[48px] w-[48px] items-center justify-center rounded-[14px]"
              style={{ background: COMPASS.soft }}
            >
              <span className="text-lg" style={{ color: COMPASS.accent }}>
                ▦
              </span>
            </div>
            <div>
              <h1 className="text-[28px] font-bold leading-none text-[#1C1B1A]">
                굿타임 저널
              </h1>
              <p className="mt-1.5 text-[14px] text-[#8A847E]">
                몰입과 에너지를 매일 짧게 기록
              </p>
            </div>
          </div>
          <CompassGoodtime compass={compass} />
        </>
      )}
      {exerciseKey === 'odyssey' && (
        <CompassOdyssey
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
          onCreatePrototype={onCreatePrototype}
        />
      )}
      {exerciseKey === 'prototype' && (
        <>
          <div className="mb-4">
            <h1 className="text-[28px] font-bold text-[#1C1B1A]">프로토타입 로그</h1>
            <p className="mt-1.5 text-[14px] text-[#8A847E]">대화와 작은 실험 기록</p>
          </div>
          <CompassPrototype compass={compass} initialPlanLink={protoPlanLink} />
        </>
      )}
      {exerciseKey === 'choosing' && (
        <CompassChoosing
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
        />
      )}
      {exerciseKey === 'failure' && (
        <CompassFailure
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
        />
      )}
      {exerciseKey === 'gravity' && (
        <CompassGravity
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
        />
      )}
      {exerciseKey === 'team' && (
        <CompassTeam
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
        />
      )}
      {exerciseKey === 'mindmap' && (
        <CompassMindmap
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
          onSendToOdyssey={onSendToOdyssey}
        />
      )}
    </div>
  )
}
