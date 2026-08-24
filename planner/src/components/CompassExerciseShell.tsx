import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LdSnapshot } from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import { CompassTimelineSpine } from './CompassTimelineSpine'
import { COMPASS, EXERCISE_META, formatYm, type ExerciseKey } from '../types/compass'

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
  onCreateNew: () => void
  savedAt: Date | null
  error: string | null
  help: string
  lockedMsg: boolean
  onDismissLock?: () => void
  children: ReactNode
  completeLabel?: string
  onComplete?: () => void
  hideComplete?: boolean
}

export function ExerciseChrome({
  exerciseKey,
  all,
  active,
  onNavigateSnapshot,
  onCompare,
  onCreateNew,
  savedAt,
  error,
  help,
  lockedMsg,
  onDismissLock,
  children,
  completeLabel = '완료하기',
  onComplete,
  hideComplete,
}: ExerciseChromeProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const meta = EXERCISE_META.find((m) => m.key === exerciseKey)
  const readonly = active?.status === 'complete'
  const timeLabel = savedAt
    ? `저장됨 · ${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <div className="pb-28">
      <div className="mb-3 flex items-center justify-between gap-3">
        {readonly && active ? (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ background: COMPASS.soft, color: COMPASS.ink }}
          >
            {formatYm(active.takenAt)}의 나
          </span>
        ) : (
          <span className="text-[12px] text-[#8A847E]">{timeLabel ?? '자동 저장'}</span>
        )}
        {error && <span className="text-[12px] text-[#E0574A]">{error}</span>}
      </div>

      <CompassTimelineSpine
        snapshots={all}
        activeId={active?.id}
        onSelect={(id) => onNavigateSnapshot(id)}
        onCompare={onCompare}
        onCreateNew={onCreateNew}
      />

      <button
        type="button"
        className="mb-4 text-left text-[13px] text-[#8A847E] underline-offset-2 hover:underline"
        onClick={() => setHelpOpen((v) => !v)}
      >
        {helpOpen ? '설명 접기' : '이 연습이 뭐예요?'}
      </button>
      {helpOpen && (
        <p className="mb-5 rounded-2xl bg-[#FAF8F6] px-4 py-3 text-[14px] leading-relaxed text-[#8A847E]">
          {help || meta?.description}
        </p>
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

      {children}

      {!readonly && active && !hideComplete && onComplete && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#ECE7E2] bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-xl justify-end sm:max-w-3xl">
            <button
              type="button"
              onClick={onComplete}
              className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
            >
              {completeLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export const cardShadow =
  '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)'
