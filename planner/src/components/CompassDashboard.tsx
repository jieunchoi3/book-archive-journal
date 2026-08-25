import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COMPASS,
  DASHBOARD_GAUGES,
  DASHBOARD_ORDER,
  emptyDashboardData,
  getDashboardGauge,
  normalizeDashboardData,
  type DashboardAreaState,
  type DashboardData,
  type DashboardGaugeKey,
  type DashboardStep,
  type LdSnapshot,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassDashboardProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
}

const AREA_COPY: Record<
  DashboardGaugeKey,
  {
    definition: string
    listLabel: string
    listPlaceholder: string
    gaugeQuestion: string
    noteLabel: string
  }
> = {
  health: {
    definition:
      '몸만이 아니라 마음과 정신까지 포함해서 봐. 셋 중 뭘 얼마나 중요하게 볼지는 네가 정해.',
    listLabel: '요즘 건강 쪽으로 하고 있는 것들',
    listPlaceholder: '운동, 수면, 먹는 것, 병원, 쉬는 방식 — 좋은 것도 나쁜 것도',
    gaugeQuestion: '이 목록을 보고, 지금 건강은 얼마나 차 있어?',
    noteLabel: '요즘 몸과 마음이 어떤지 몇 문장으로',
  },
  work: {
    definition:
      '돈 받는 일만이 아니야. 부업, 자문, 봉사, 집안일, 돌봄, 공부까지 전부 "일"이야.',
    listLabel: '네가 지금 하고 있는 모든 "일"',
    listPlaceholder: '본업 업무, 사이드 프로젝트, 집안일, 누굴 챙기는 일까지',
    gaugeQuestion: '이걸 다 놓고 봤을 때, 일하는 삶 전체는 얼마나 차 있어?',
    noteLabel: '일이 지금 어떤 상태인지 몇 문장으로',
  },
  play: {
    definition:
      '결과나 성과 없이, 그냥 하는 게 즐거워서 하는 것. 생산적인 일이어도 재미로 했으면 놀이야. 대부분 여기가 제일 비어 있어.',
    listLabel: '순전히 재미로 하는 것들',
    listPlaceholder: '아무 목적 없이 하는 것. 잘하려고 하는 건 여기 아님.',
    gaugeQuestion: '요즘 놀이는 얼마나 차 있어?',
    noteLabel: '놀이가 지금 이만큼인 이유',
  },
  love: {
    definition:
      '연애만이 아니야. 가족, 친구, 반려동물, 동네까지. 지금 사랑이 어디로 흐르고 있는지 — 너에게서, 그리고 너에게로.',
    listLabel: '사랑이 오가는 곳들',
    listPlaceholder: '누구와, 어떤 관계로. 주는 쪽도 받는 쪽도',
    gaugeQuestion: '이 관계들을 놓고 봤을 때 얼마나 차 있어?',
    noteLabel: '관계가 지금 어떤지 몇 문장으로',
  },
}

const STEP_LABELS = ['건강', '일', '놀이', '사랑', '정리'] as const

const HELP = `어디로 갈지는 지금 어디 있는지를 알아야 정할 수 있어.
이건 잘하고 못하고를 매기는 게 아니라, 네 상태를 그냥 읽는 거야.

건강 · 일 · 놀이 · 사랑 네 칸을 순서대로 본다.
칸마다 먼저 지금 실제로 하고 있는 것들을 적고, 그 목록을 보면서 만족도를 정한다.

네 칸이 골고루 차 있는 게 정답이 아니다. 시기마다 다른 게 정상이야.
보통 1~2개월마다 다시 해.`

function VerticalGauge120({
  value,
  touched,
  color,
  ghost,
  disabled,
  label,
  onChange,
}: {
  value: number | null
  touched: boolean
  color: string
  ghost?: number | null
  disabled?: boolean
  label: string
  onChange: (v: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [dragLive, setDragLive] = useState(false)

  const setFromClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current
      if (!el || disabled) return
      const rect = el.getBoundingClientRect()
      const ratio = 1 - (clientY - rect.top) / rect.height
      const next = Math.round(Math.min(120, Math.max(0, ratio * 120)))
      onChange(next)
    },
    [disabled, onChange],
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setFromClientY(e.clientY)
    }
    const onUp = () => {
      dragging.current = false
      setDragLive(false)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      const t = e.touches[0]
      if (t) setFromClientY(t.clientY)
    }
    const onTouchEnd = () => {
      dragging.current = false
      setDragLive(false)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [setFromClientY])

  const display = touched && value != null ? value : null
  const fillPct = display != null ? (display / 120) * 100 : 0
  const overflowPct =
    display != null && display > 100 ? ((display - 100) / 120) * 100 : 0
  const fullLinePct = (100 / 120) * 100
  const delta =
    ghost != null && display != null ? Math.round(display - ghost) : null

  return (
    <div
      className={`relative flex flex-col items-center ${disabled ? 'pointer-events-none opacity-40' : ''}`}
    >
      {disabled && (
        <p className="mb-2 text-center text-[13px] text-[#8A847E]">
          먼저 위에 뭐라도 적어봐. 그래야 감이 와.
        </p>
      )}
      <div className="relative">
        {ghost != null && (
          <span
            className="absolute -left-14 text-[11px] text-[#B5AFA8]"
            style={{ bottom: `calc(${(ghost / 120) * 100}% - 6px)` }}
          >
            이전 {Math.round(ghost)}
          </span>
        )}
        <div
          ref={trackRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={120}
          aria-valuenow={display ?? 0}
          aria-label={`${label} 게이지`}
          tabIndex={disabled ? -1 : 0}
          className="relative h-[260px] w-[84px] cursor-ns-resize overflow-hidden rounded-[42px] border border-[#ECE7E2] bg-[#FAF8F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
          onMouseDown={(e) => {
            if (disabled) return
            dragging.current = true
            setDragLive(true)
            setFromClientY(e.clientY)
          }}
          onTouchStart={(e) => {
            if (disabled) return
            dragging.current = true
            setDragLive(true)
            const t = e.touches[0]
            if (t) setFromClientY(t.clientY)
          }}
          onKeyDown={(e) => {
            if (disabled) return
            const cur = display ?? 0
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              onChange(Math.min(120, cur + (e.shiftKey ? 10 : 2)))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              onChange(Math.max(0, cur - (e.shiftKey ? 10 : 2)))
            } else if (e.key === 'Home') {
              e.preventDefault()
              onChange(0)
            } else if (e.key === 'End') {
              e.preventDefault()
              onChange(100)
            }
          }}
        >
          {/* fill up to min(value, 100) solid */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: `${Math.min(fillPct, fullLinePct)}%`,
              background: color,
              transition: dragLive ? 'none' : 'height 120ms ease-out',
              borderRadius: 42,
            }}
          />
          {/* overflow stripe section */}
          {overflowPct > 0 && (
            <div
              className="absolute left-0 right-0"
              style={{
                bottom: `${fullLinePct}%`,
                height: `${overflowPct}%`,
                background: color,
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,.3) 0 2px, transparent 2px 6px)',
                transition: dragLive ? 'none' : 'height 120ms ease-out',
              }}
            />
          )}
          {/* 100 full line */}
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-[#B5AFA8]"
            style={{ bottom: `${fullLinePct}%` }}
          />
          <span
            className="pointer-events-none absolute -right-9 text-[12px] text-[#B5AFA8]"
            style={{ bottom: `calc(${fullLinePct}% - 7px)` }}
          >
            가득
          </span>
          {ghost != null && (
            <div
              className="pointer-events-none absolute left-1 right-1 border-t border-dashed border-[#B5AFA8]"
              style={{ bottom: `${(ghost / 120) * 100}%` }}
            />
          )}
          {!touched && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[28px] font-semibold text-[#B5AFA8]">
              ?
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[32px] font-bold tabular-nums text-[#1C1B1A]">
          {display != null ? display : '—'}
        </span>
        {display != null && display > 100 && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
            style={{ background: `${color}26`, color }}
          >
            넘침
          </span>
        )}
        {delta != null && delta !== 0 && (
          <span
            className="text-[11px] font-semibold"
            style={{
              color:
                delta > 0 ? COMPASS.accent : delta < 0 ? '#E0574A' : '#B5AFA8',
            }}
          >
            {delta > 0 ? `+${delta}` : `${delta}`}
          </span>
        )}
        {delta === 0 && (
          <span className="text-[11px] font-semibold text-[#B5AFA8]">0</span>
        )}
      </div>
    </div>
  )
}

function Stepper({
  step,
  maxReached,
  onJump,
}: {
  step: DashboardStep
  maxReached: DashboardStep
  onJump: (s: DashboardStep) => void
}) {
  return (
    <div className="mb-5 flex items-center gap-0 overflow-x-auto px-1">
      {STEP_LABELS.map((label, i) => {
        const s = i as DashboardStep
        const done = s < step
        const current = s === step
        const locked = s > maxReached
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className="mx-1 h-px w-6 sm:w-10"
                style={{
                  background: s <= maxReached ? COMPASS.accent : '#ECE7E2',
                }}
              />
            )}
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                if (!locked) onJump(s)
              }}
              className="flex flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                style={
                  done
                    ? { background: COMPASS.accent, color: '#fff' }
                    : current
                      ? {
                          background: '#fff',
                          border: `2px solid ${COMPASS.accent}`,
                          color: COMPASS.ink,
                        }
                      : {
                          background: '#fff',
                          border: '1.5px solid #ECE7E2',
                          color: '#B5AFA8',
                        }
                }
              >
                {i + 1}
              </span>
              <span
                className="text-[11px] font-medium"
                style={{ color: current || done ? COMPASS.ink : '#B5AFA8' }}
              >
                {label}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function CompassDashboard({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
}: CompassDashboardProps) {
  const { all, completes, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'dashboard',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<DashboardData>(emptyDashboardData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [itemDraft, setItemDraft] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [maxReached, setMaxReached] = useState<DashboardStep>(0)
  const itemInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!active) {
      setData(emptyDashboardData())
      return
    }
    const next = normalizeDashboardData(
      compass.getDraftData(active, emptyDashboardData()),
    )
    setData(next)
    setMaxReached((m) => (next.step > m ? next.step : m) as DashboardStep)
    setLockedMsg(false)
    setItemDraft('')
    setEditingIdx(null)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: DashboardData) => {
      await compass.updateDraftData(id, next as unknown as Record<string, unknown>)
    },
    [compass],
  )

  const { savedAt, error } = useDebouncedDraftSave(
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

  const prevNorm = prevComplete
    ? normalizeDashboardData(prevComplete.data)
    : null

  const patchArea = (key: DashboardGaugeKey, patch: Partial<DashboardAreaState>) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({
      ...d,
      areas: { ...d.areas, [key]: { ...d.areas[key], ...patch } },
    }))
  }

  const setStep = (step: DashboardStep) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({ ...d, step }))
    setMaxReached((m) => (step > m ? step : m) as DashboardStep)
    setItemDraft('')
    setEditingIdx(null)
  }

  const areaKey =
    data.step < 4 ? DASHBOARD_ORDER[data.step] : null
  const area = areaKey ? data.areas[areaKey] : null
  const copy = areaKey ? AREA_COPY[areaKey] : null
  const color =
    areaKey != null
      ? DASHBOARD_GAUGES.find((g) => g.key === areaKey)!.color
      : COMPASS.accent

  const canUseGauge =
    areaKey === 'play' || (area != null && area.items.length > 0)

  const canGoNextArea = () => {
    if (!area || !areaKey) return false
    if (areaKey !== 'play' && area.items.length === 0) return false
    if (!area.gauge_touched || area.gauge == null) return false
    return true
  }

  const canComplete =
    DASHBOARD_ORDER.every((k) => {
      const a = data.areas[k]
      if (k === 'play') return a.gauge_touched && a.gauge != null
      return a.items.length > 0 && a.gauge_touched && a.gauge != null
    })

  const addItem = () => {
    if (!areaKey || !area || readonly) return
    const t = itemDraft.trim()
    if (!t) return
    patchArea(areaKey, { items: [...area.items, t] })
    setItemDraft('')
    requestAnimationFrame(() => itemInputRef.current?.focus())
  }

  return (
    <ExerciseChrome
      exerciseKey="dashboard"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help={HELP}
      helpCadence="보통 1~2개월마다 다시 해."
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
      completeDisabled={!canComplete || data.step !== 4}
      hideComplete={data.step !== 4}
    >
      <Stepper
        step={data.step}
        maxReached={readonly ? 4 : maxReached}
        onJump={(s) => {
          if (readonly) {
            setData((d) => ({ ...d, step: s }))
            return
          }
          setStep(s)
        }}
      />

      {data.step < 4 && areaKey && area && copy && (
        <div
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 sm:p-8"
          style={{ boxShadow: cardShadow }}
        >
          <div className="mb-4 flex items-start gap-2">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: color }}
            />
            <div>
              <h2 className="text-[22px] font-bold text-[#1C1B1A]">
                {DASHBOARD_GAUGES.find((g) => g.key === areaKey)!.label}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[#8A847E]">
                {copy.definition}
              </p>
            </div>
          </div>

          <p className="mb-2 text-[14px] font-semibold text-[#1C1B1A]">
            {copy.listLabel}
          </p>
          {!readonly && (
            <input
              ref={itemInputRef}
              type="text"
              value={itemDraft}
              onChange={(e) => setItemDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addItem()
                }
              }}
              placeholder={copy.listPlaceholder}
              className="mb-3 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-4 py-3 text-[15px] text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
            />
          )}

          <ul className="mb-2 space-y-1.5">
            {area.items.map((item, idx) => (
              <li
                key={`${idx}-${item.slice(0, 12)}`}
                className="group flex h-10 items-center gap-2 rounded-lg bg-[#FAF8F6] pr-2"
              >
                <span
                  className="h-full w-1 shrink-0 rounded-l-lg"
                  style={{ background: color }}
                />
                {editingIdx === idx && !readonly ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => {
                      const t = editText.trim()
                      const next = [...area.items]
                      if (!t) next.splice(idx, 1)
                      else next[idx] = t
                      patchArea(areaKey, { items: next })
                      setEditingIdx(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-[15px] text-[#1C1B1A]"
                    onClick={() => {
                      if (readonly) {
                        setLockedMsg(true)
                        return
                      }
                      setEditingIdx(idx)
                      setEditText(item)
                    }}
                  >
                    {item}
                  </button>
                )}
                {!readonly && (
                  <button
                    type="button"
                    className="hidden px-2 text-[14px] text-[#B5AFA8] group-hover:inline"
                    aria-label="삭제"
                    onClick={() => {
                      patchArea(areaKey, {
                        items: area.items.filter((_, i) => i !== idx),
                      })
                    }}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {area.items.length >= 3 && (
            <p className="mb-5 text-[13px] text-[#B5AFA8]">
              더 있으면 더 적어도 되고, 이만큼도 괜찮아
            </p>
          )}

          <div className="my-6 border-t border-[#ECE7E2]" />

          <p className="mb-4 text-[15px] font-semibold text-[#1C1B1A]">
            {copy.gaugeQuestion}
          </p>

          <div className="mb-6 flex justify-center">
            <VerticalGauge120
              value={area.gauge}
              touched={area.gauge_touched}
              color={color}
              ghost={
                prevNorm
                  ? getDashboardGauge(prevNorm, areaKey)
                  : null
              }
              disabled={readonly || !canUseGauge}
              label={DASHBOARD_GAUGES.find((g) => g.key === areaKey)!.label}
              onChange={(v) => {
                if (readonly) {
                  setLockedMsg(true)
                  return
                }
                patchArea(areaKey, { gauge: v, gauge_touched: true })
              }}
            />
          </div>

          {areaKey === 'play' && area.items.length === 0 && (
            <p className="mb-4 text-center text-[13px] text-[#8A847E]">
              비어 있는 것도 결과야. 그대로 두고 가도 돼.
            </p>
          )}

          <label className="mb-2 block text-[14px] font-semibold text-[#1C1B1A]">
            {copy.noteLabel}
          </label>
          <textarea
            rows={3}
            disabled={readonly}
            value={area.note}
            onChange={(e) => {
              if (readonly) {
                setLockedMsg(true)
                return
              }
              patchArea(areaKey, { note: e.target.value })
            }}
            placeholder="두세 문장이면 충분해"
            className="mb-6 min-h-[100px] w-full resize-y rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-4 py-3 text-[15px] leading-[1.7] text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-70"
          />

          {!readonly && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canGoNextArea()}
                onClick={() => setStep((data.step + 1) as DashboardStep)}
                className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] focus-visible:ring-offset-2"
                style={{ background: COMPASS.accent }}
              >
                {data.step === 3
                  ? '다음 · 정리 →'
                  : `다음 · ${STEP_LABELS[data.step + 1]} →`}
              </button>
            </div>
          )}
        </div>
      )}

      {data.step === 4 && (
        <div className="space-y-6">
          <div
            className="grid grid-cols-2 gap-4 rounded-[18px] border border-[#ECE7E2] bg-white p-6 sm:grid-cols-4"
            style={{ boxShadow: cardShadow }}
          >
            {DASHBOARD_GAUGES.map((g) => {
              const a = data.areas[g.key]
              const v = a.gauge
              return (
                <div key={g.key} className="flex flex-col items-center">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: g.color }}
                    />
                    <span className="text-[13px] font-semibold">{g.label}</span>
                  </div>
                  <div
                    className="relative h-28 w-10 overflow-hidden rounded-full bg-[#FAF8F6]"
                    aria-hidden
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0"
                      style={{
                        height: `${((v ?? 0) / 120) * 100}%`,
                        background: g.color,
                      }}
                    />
                    <div
                      className="absolute left-0 right-0 border-t border-[#B5AFA8]/80"
                      style={{ bottom: `${(100 / 120) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[20px] font-bold tabular-nums">
                    {v ?? '—'}
                    {v != null && v > 100 && (
                      <span className="ml-1 text-[11px] font-semibold" style={{ color: g.color }}>
                        넘침
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-[#8A847E]">활동 {a.items.length}개</p>
                </div>
              )
            })}
          </div>

          <div
            className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 sm:p-8"
            style={{ boxShadow: cardShadow }}
          >
            <h2
              className="text-[28px] font-bold leading-snug tracking-tight text-[#1C1B1A] sm:text-[32px]"
            >
              여기서 뭘 바꾸고 싶어?
            </h2>
            <p className="mt-2 text-[15px] text-[#8A847E]">
              하나만 골라도 돼. 지금 안 정해도 돼.
            </p>
            <textarea
              disabled={readonly}
              value={data.change}
              onChange={(e) => {
                if (readonly) {
                  setLockedMsg(true)
                  return
                }
                setData((d) => ({ ...d, change: e.target.value }))
              }}
              placeholder="자유롭게"
              className="mt-5 min-h-[140px] w-full resize-y rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-4 py-3 text-[16px] leading-relaxed text-[#1C1B1A] placeholder:text-[#B5AFA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E] disabled:opacity-70"
            />
            <p className="mt-3 text-[13px] text-[#B5AFA8]">
              이건 문제 목록이 아니라 출발점이야.
            </p>
          </div>
        </div>
      )}
    </ExerciseChrome>
  )
}
