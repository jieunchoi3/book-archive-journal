import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  type CompassRoute,
  type ExerciseKey,
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
          onAddWeeklyTask={onAddWeeklyTask}
          protoPlanLink={protoPlanLink}
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
  onAddWeeklyTask,
  protoPlanLink,
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
  onAddWeeklyTask: (label: string) => void
  protoPlanLink: string | null
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8A847E]"
      >
        <ArrowLeft size={16} /> Compass
      </button>

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
        <CompassGoodtime
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onOpenMindmap={() => onOpenExercise('mindmap')}
        />
      )}
      {exerciseKey === 'odyssey' && (
        <CompassOdyssey
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
          onOpenCoherence={() => onOpenExercise('coherence')}
          onOpenMindmap={() => onOpenExercise('mindmap')}
        />
      )}
      {exerciseKey === 'prototype' && (
        <CompassPrototype compass={compass} initialPlanLink={protoPlanLink} />
      )}
      {exerciseKey === 'choosing' && (
        <CompassChoosing
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
          onRequestSnapshotAi={onRequestSnapshotAi}
          onAddWeeklyTask={onAddWeeklyTask}
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
          onOpenGoodtime={() => onOpenExercise('goodtime')}
          onOpenOdyssey={() => onOpenExercise('odyssey')}
        />
      )}
    </div>
  )
}
