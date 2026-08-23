import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COMPASS,
  DASHBOARD_GAUGES,
  emptyDashboardData,
  formatYm,
  type DashboardData,
  type DashboardGaugeKey,
  type LdSnapshot,
} from '../types/compass'
import { CompassTimelineSpine } from './CompassTimelineSpine'
import type { CompassActions } from '../hooks/useCompass'

interface CompassDashboardProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
}

function useDebouncedSave(
  snapshot: LdSnapshot | null,
  data: DashboardData,
  save: (id: string, data: DashboardData) => Promise<void>,
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

function VerticalGauge({
  value,
  color,
  ghost,
  readonly,
  onChange,
}: {
  value: number
  color: string
  ghost?: number | null
  readonly?: boolean
  onChange: (v: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const setFromClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current
      if (!el || readonly) return
      const rect = el.getBoundingClientRect()
      const ratio = 1 - (clientY - rect.top) / rect.height
      onChange(Math.round(Math.min(100, Math.max(0, ratio * 100))))
    },
    [onChange, readonly],
  )

  const delta =
    ghost != null && Number.isFinite(ghost) ? Math.round(value - ghost) : null

  return (
    <div className="relative flex flex-col items-center">
      {delta != null && delta !== 0 && (
        <span
          className="mb-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          style={{
            background: COMPASS.soft,
            color: COMPASS.ink,
          }}
        >
          {delta > 0 ? `+${delta}` : `${delta}`}
        </span>
      )}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        tabIndex={readonly ? -1 : 0}
        className="relative h-[220px] w-14 cursor-ns-resize overflow-hidden rounded-2xl border border-[#ECE7E2] bg-[#FAF8F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        onPointerDown={(e) => {
          if (readonly) return
          dragging.current = true
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          setFromClientY(e.clientY)
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return
          setFromClientY(e.clientY)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onKeyDown={(e) => {
          if (readonly) return
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            onChange(Math.min(100, value + 1))
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(Math.max(0, value - 1))
          }
        }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-150"
          style={{
            height: `${value}%`,
            background: color,
          }}
        />
        {ghost != null && (
          <div
            className="pointer-events-none absolute left-1 right-1 border-t border-dashed"
            style={{
              bottom: `${ghost}%`,
              borderColor: color,
              opacity: COMPASS.ghostOpacity + 0.4,
            }}
          />
        )}
      </div>
      <span className="mt-2 text-[22px] font-bold tabular-nums text-[#1C1B1A]">{value}</span>
    </div>
  )
}

export function CompassDashboard({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
}: CompassDashboardProps) {
  const all = compass.snapshotsFor('dashboard')
  const completes = compass.completeSnapshotsFor('dashboard')

  const active =
    (snapshotId ? all.find((s) => s.id === snapshotId) : null) ??
    compass.draftFor('dashboard') ??
    completes[completes.length - 1] ??
    null

  const readonly = active?.status === 'complete'
  const [data, setData] = useState<DashboardData>(emptyDashboardData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!active) {
      setData(emptyDashboardData())
      return
    }
    setData(compass.getDashboardDraftData(active))
    setLockedMsg(false)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: DashboardData) => {
      await compass.updateDraftData(id, next as unknown as Record<string, unknown>)
    },
    [compass],
  )

  const { savedAt, error } = useDebouncedSave(
    active,
    data,
    save,
    Boolean(active && !readonly),
  )

  const prevComplete: LdSnapshot | null = (() => {
    if (!active) return null
    const idx = completes.findIndex((s) => s.id === active.id)
    if (active.status === 'draft') return completes[completes.length - 1] ?? null
    if (idx > 0) return completes[idx - 1]
    return null
  })()

  const prevGauges =
    prevComplete && (prevComplete.data as unknown as DashboardData)?.gauges
      ? (prevComplete.data as unknown as DashboardData).gauges
      : null

  const setGauge = (key: DashboardGaugeKey, v: number) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({ ...d, gauges: { ...d.gauges, [key]: v } }))
  }

  const ensureDraft = async (forceNew = false) => {
    const draft = await compass.createDraft('dashboard', undefined, forceNew)
    onNavigateSnapshot(draft.id)
  }

  useEffect(() => {
    if (!active && !compass.loading) {
      void ensureDraft(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, compass.loading])

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
        onCreateNew={() => void ensureDraft(true)}
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
          건강 / 일 / 놀이 / 관계 네 영역의 지금 충전량을 눈으로 보는 연습이에요. 몇 달 뒤
          다시 하면 게이지 위에 그때 값이 점선으로 남아요.
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
            onClick={() => void ensureDraft(true)}
          >
            새로 하기
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {DASHBOARD_GAUGES.map((g) => (
          <div
            key={g.key}
            className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
            style={{
              boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: g.color }}
              />
              <span className="text-[13px] font-semibold text-[#1C1B1A]">{g.label}</span>
            </div>
            <VerticalGauge
              value={data.gauges[g.key]}
              color={g.color}
              ghost={prevGauges?.[g.key] ?? null}
              readonly={readonly}
              onChange={(v) => setGauge(g.key, v)}
            />
            <input
              type="text"
              disabled={readonly}
              value={data.reasons[g.key]}
              onChange={(e) => {
                if (readonly) {
                  setLockedMsg(true)
                  return
                }
                const v = e.target.value
                setData((d) => ({
                  ...d,
                  reasons: { ...d.reasons, [g.key]: v },
                }))
              }}
              placeholder="지금 이 상태인 이유 한 줄"
              className="mt-3 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px] text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-70"
            />
          </div>
        ))}
      </div>

      <div
        className="mt-5 rounded-[18px] border border-[#ECE7E2] bg-white p-6"
        style={{
          boxShadow: '0 1px 2px rgba(28,27,26,.04), 0 8px 24px rgba(28,27,26,.05)',
        }}
      >
        <label className="mb-2 block text-[11px] font-semibold tracking-wider text-[#8A847E]">
          지금 나를 걸리게 하는 것
        </label>
        <textarea
          disabled={readonly}
          rows={3}
          value={data.friction}
          onChange={(e) => {
            if (readonly) {
              setLockedMsg(true)
              return
            }
            setData((d) => ({ ...d, friction: e.target.value }))
          }}
          className="w-full resize-none rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[15px] leading-relaxed text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-70"
          placeholder="자유롭게"
        />
      </div>

      {!readonly && active && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#ECE7E2] bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-xl justify-end">
            <button
              type="button"
              onClick={() => void compass.completeSnapshot(active.id)}
              className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
            >
              완료하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
