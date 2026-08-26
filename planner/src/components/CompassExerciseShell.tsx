import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LdSnapshot } from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { CompassTimelineSpine } from './CompassTimelineSpine'
import { CompassGuidePanel, GuideInlineHint } from './CompassGuidePanel'
import {
  COMPASS,
  EXERCISE_META,
  formatYm,
  type ExerciseKey,
} from '../types/compass'
import { getGuide, guideFoldSummary } from '../compass/guides'

export function useDebouncedDraftSave<T>(
  snapshot: LdSnapshot | null,
  data: T,
  save: (id: string, data: T) => Promise<void>,
  enabled: boolean,
) {
  const timer = useRef<number | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !snapshot || snapshot.status === 'complete') return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void (async () => {
        try {
          await save(snapshot.id, data)
          setSavedAt(new Date())
          setError(null)
        } catch {
          setError('저장 실패. 네트워크 확인하고 다시 눌러주세요.')
        }
      })()
    }, 800)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [data, enabled, save, snapshot])

  return { savedAt, error }
}

export function useExerciseSnapshot(
  compass: CompassActions,
  key: ExerciseKey,
  snapshotId: string | undefined,
  onNavigateSnapshot: (id: string | undefined) => void,
) {
  const all = compass.snapshotsFor(key)
  const completes = compass.completeSnapshotsFor(key)
  const active =
    (snapshotId ? all.find((s) => s.id === snapshotId) : null) ??
    compass.draftFor(key) ??
    completes[completes.length - 1] ??
    null

  const ensureDraft = useCallback(
    async (forceNew = false) => {
      const draft = await compass.createDraft(key, undefined, forceNew)
      onNavigateSnapshot(draft.id)
      return draft
    },
    [compass, key, onNavigateSnapshot],
  )

  useEffect(() => {
    if (!active && !compass.loading) {
      void ensureDraft(false)
    }
  }, [active, compass.loading, ensureDraft])

  return { all, completes, active, ensureDraft, readonly: active?.status === 'complete' }
}

interface ExerciseChromeProps {
  exerciseKey: ExerciseKey
  compass: CompassActions
  all: LdSnapshot[]
  active: LdSnapshot | null
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
  onCreateNew: () => void
  savedAt: Date | null
  error: string | null
  help: string
  helpCadence?: string
  /** Current guide how[].step — drives panel highlight + inline hint */
  guideStep?: string | null
  /** Show auto inline hint above children (default true when guideStep set) */
  showInlineHint?: boolean
  lockedMsg: boolean
  onDismissLock?: () => void
  children: ReactNode
  completeLabel?: string
  onComplete?: () => void
  hideComplete?: boolean
  completeDisabled?: boolean
}

export function ExerciseChrome({
  exerciseKey,
  all,
  active,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
  onCreateNew,
  savedAt,
  error,
  help,
  helpCadence,
  guideStep,
  showInlineHint = true,
  lockedMsg,
  onDismissLock,
  children,
  completeLabel = '완료하기',
  onComplete,
  hideComplete,
  completeDisabled,
}: ExerciseChromeProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const meta = EXERCISE_META.find((m) => m.key === exerciseKey)
  const guide = getGuide(exerciseKey)
  const readonly = active?.status === 'complete'
  const completeCount = all.filter((s) => s.status === 'complete').length
  const timeLabel = savedAt
    ? `저장됨 · ${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : null

  const cadenceLine = guide
    ? `${guide.duration} · ${guide.cadence}`
    : helpCadence ||
      (meta?.cadenceDays
        ? `보통 ${Math.round(meta.cadenceDays / 30)}개월마다 다시 해요`
        : null)

  const foldBody = guide ? guideFoldSummary(guide) : help || meta?.description

  return (
    <div className="overflow-visible pb-28">
      {meta && (
        <header className="mb-5 flex items-start gap-3 overflow-visible">
          <div
            className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: COMPASS.soft }}
          >
            <span
              className="text-[26px] leading-none"
              style={{ color: COMPASS.accent }}
              aria-hidden
            >
              ▦
            </span>
          </div>
          <div className="min-w-0 overflow-visible pt-0.5">
            <h1
              className="text-[32px] font-bold text-[#1C1B1A]"
              style={{
                lineHeight: 1.3,
                paddingBlock: 4,
                overflow: 'visible',
              }}
            >
              {meta.name}
            </h1>
            <p className="mt-0.5 text-[15px] text-[#8A847E]">{meta.description}</p>
          </div>
        </header>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {readonly && active ? (
            <span
              className="rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: COMPASS.soft, color: COMPASS.ink }}
            >
              {formatYm(active.takenAt)}의 나 · 읽기 전용
            </span>
          ) : (
            <span className="text-[13px] text-[#B5AFA8]">
              {timeLabel ?? '자동 저장'}
            </span>
          )}
          {error && <span className="text-[12px] text-[#E0574A]">{error}</span>}
        </div>
        {completeCount > 0 && (
          <button
            type="button"
            onClick={onCreateNew}
            className="shrink-0 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
            style={{ color: COMPASS.accent }}
          >
            + 새로 하기
          </button>
        )}
      </div>

      <CompassTimelineSpine
        snapshots={all}
        activeId={active?.id}
        onSelect={(id) => onNavigateSnapshot(id)}
        onCompare={onCompare}
        onCreateNew={onCreateNew}
      />

      {readonly && active && onRequestSnapshotAi && (
        <button
          type="button"
          className="mb-3 rounded-full px-4 py-1.5 text-[12px] font-semibold text-white"
          style={{ background: COMPASS.accent }}
          onClick={() => onRequestSnapshotAi(active.id)}
        >
          이번 기록 AI로 읽기
        </button>
      )}

      <button
        type="button"
        className="mb-4 flex items-center gap-1.5 text-left text-[13px] text-[#8A847E]"
        onClick={() => setHelpOpen((v) => !v)}
      >
        <span aria-hidden>{helpOpen ? '▾' : '▸'}</span>
        이 연습이 뭐예요?
      </button>
      {helpOpen && (
        <div className="mb-5 whitespace-pre-wrap rounded-2xl bg-[#FAF8F6] px-4 py-3 text-[14px] leading-relaxed text-[#8A847E]">
          <p>{foldBody}</p>
          {cadenceLine && <p className="mt-2 text-[13px]">{cadenceLine}</p>}
        </div>
      )}

      {lockedMsg && (
        <div
          className="mb-4 rounded-[18px] border px-4 py-3 text-[14px]"
          style={{ borderColor: COMPASS.line, background: COMPASS.soft }}
        >
          <p className="text-[#1C1B1A]">
            완료된 기록은 그대로 둡니다. 지금 생각이 달라졌다면 새로 해보세요.
          </p>
          <button
            type="button"
            className="mt-2 text-[13px] font-semibold"
            style={{ color: COMPASS.accent }}
            onClick={onDismissLock ?? onCreateNew}
          >
            새로 하기
          </button>
        </div>
      )}

      {showInlineHint && guideStep && (
        <GuideInlineHint
          exerciseKey={exerciseKey}
          step={guideStep}
          className="mb-4"
        />
      )}

      {children}

      {!readonly && active && !hideComplete && onComplete && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#ECE7E2] bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex w-full justify-end px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={onComplete}
              disabled={completeDisabled}
              className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
              style={{ background: COMPASS.accent }}
            >
              {completeLabel}
            </button>
          </div>
        </div>
      )}

      <CompassGuidePanel exerciseKey={exerciseKey} guideStep={guideStep} />
    </div>
  )
}

export const cardShadow =
  '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)'

/** Shared page title — use for exercises that don't wrap ExerciseChrome. */
export function CompassExerciseHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <header className="mb-5 flex items-start gap-3 overflow-visible">
      <div
        className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[16px]"
        style={{ background: COMPASS.soft }}
      >
        <span
          className="text-[26px] leading-none"
          style={{ color: COMPASS.accent }}
          aria-hidden
        >
          ▦
        </span>
      </div>
      <div className="min-w-0 overflow-visible pt-0.5">
        <h1
          className="text-[32px] font-bold text-[#1C1B1A]"
          style={{
            lineHeight: 1.3,
            paddingBlock: 4,
            overflow: 'visible',
          }}
        >
          {title}
        </h1>
        <p className="mt-0.5 text-[15px] text-[#8A847E]">{subtitle}</p>
      </div>
    </header>
  )
}
