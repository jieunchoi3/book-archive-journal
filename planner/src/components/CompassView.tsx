import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { COMPASS, type CompassRoute, type ExerciseKey } from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { CompassOverview } from './CompassOverview'
import { CompassDashboard } from './CompassDashboard'
import { CompassAskDetail, CompassAskList } from './CompassAsk'

interface CompassViewProps {
  compass: CompassActions
  route: CompassRoute
  onRouteChange: (route: CompassRoute) => void
}

export function CompassView({
  compass,
  route,
  onRouteChange,
}: CompassViewProps) {
  const [year, setYear] = useState(new Date().getFullYear())

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
        />
      )}

      {(route.page === 'compare' || route.page === 'ai') && (
        <div>
          <button
            type="button"
            onClick={() => onRouteChange({ page: 'overview' })}
            className="mb-4 text-[13px] text-[#8A847E]"
          >
            ← Compass
          </button>
          <p className="text-[14px] text-[#8A847E]">
            비교 · AI 리포트는 다음 단계에서 열려요.
          </p>
        </div>
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
}: {
  exerciseKey: ExerciseKey
  snapshotId?: string
  compass: CompassActions
  onBack: () => void
  onSnapshot: (id: string | undefined) => void
}) {
  if (exerciseKey !== 'dashboard') {
    return (
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8A847E]"
        >
          <ArrowLeft size={16} /> Compass
        </button>
        <p className="text-[14px] text-[#8A847E]">
          이 연습은 다음 단계에서 열려요. 지금은 라이프 대시보드와 Ask Myself를
          쓸 수 있어요.
        </p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-[#8A847E]"
      >
        <ArrowLeft size={16} /> Compass
      </button>
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
            라이프 대시보드
          </h1>
          <p className="mt-1.5 text-[14px] text-[#8A847E]">
            건강 · 일 · 놀이 · 관계의 지금
          </p>
        </div>
      </div>
      <CompassDashboard
        compass={compass}
        snapshotId={snapshotId}
        onNavigateSnapshot={onSnapshot}
      />
    </div>
  )
}
