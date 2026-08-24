import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  COMPASS,
  EXERCISE_META,
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

  if (compass.loading) {
    return (
      <div className="mx-auto min-h-screen max-w-xl bg-[#F7F5F3] px-4 pb-24 pt-6">
        <p className="text-[14px] text-[#8A847E]">불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl bg-[#F7F5F3] px-4 pb-24 pt-6 sm:max-w-3xl">
      {route.page === 'overview' && (
        <CompassOverview
          compass={compass}
          year={year}
          onYearChange={setYear}
          onNavigate={onRouteChange}
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
          onOpenExercise={(key) => onRouteChange({ page: 'exercise', key })}
          onCreatePrototype={(planId) => {
            setProtoPlanLink(planId)
            onRouteChange({ page: 'exercise', key: 'prototype' })
          }}
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
  onOpenExercise,
  onCreatePrototype,
  protoPlanLink,
}: {
  exerciseKey: ExerciseKey
  snapshotId?: string
  compass: CompassActions
  onBack: () => void
  onSnapshot: (id: string | undefined) => void
  onCompare: (ids: [string, string]) => void
  onOpenExercise: (key: ExerciseKey) => void
  onCreatePrototype: (planId: string, title: string) => void
  protoPlanLink: string | null
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
        />
      )}
      {(exerciseKey === 'workview' || exerciseKey === 'lifeview') && (
        <CompassLongform
          kind={exerciseKey}
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
        />
      )}
      {exerciseKey === 'coherence' && (
        <CompassCoherence
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onOpenExercise={(k) => onOpenExercise(k)}
          onCompare={onCompare}
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
        />
      )}
      {exerciseKey === 'failure' && (
        <CompassFailure
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
        />
      )}
      {exerciseKey === 'gravity' && (
        <CompassGravity
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
        />
      )}
      {exerciseKey === 'team' && (
        <CompassTeam
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
        />
      )}
      {exerciseKey === 'mindmap' && (
        <CompassMindmap
          compass={compass}
          snapshotId={snapshotId}
          onNavigateSnapshot={onSnapshot}
          onCompare={onCompare}
        />
      )}
    </div>
  )
}
