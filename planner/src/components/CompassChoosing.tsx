import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  COMPASS,
  choosingGuideStep,
  emptyChoosingData,
  mindmapRoleIdeasFromData,
  newId,
  normalizeChoosingData,
  normalizeMindmapData,
  normalizeOdysseyData,
  todayKey,
  type ChoosingData,
  type ChoosingOption,
  type ChoosingOptionSource,
  type ChoosingStep,
  type ChoosingWearLog,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  cardShadow,
  useDebouncedDraftSave,
  useExerciseSnapshot,
} from './CompassExerciseShell'
import { CompassBipolarSlider } from './CompassBipolarSlider'
import { getGuide } from '../compass/guides'

interface CompassChoosingProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
  onAddWeeklyTask?: (label: string) => void
}

const STEP_RAIL: { step: ChoosingStep; label: string }[] = [
  { step: 'gather', label: '① 모으기' },
  { step: 'narrow', label: '② 좁히기' },
  { step: 'wear', label: '③ 입어보기' },
  { step: 'choose', label: '④ 고르기' },
  { step: 'release', label: '⑤ 놓아주기' },
]

const WEAR_DAYS = 3

export function CompassChoosing({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
  onAddWeeklyTask,
}: CompassChoosingProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'choosing',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<ChoosingData>(emptyChoosingData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [newOpt, setNewOpt] = useState('')
  const [droppedOpen, setDroppedOpen] = useState(false)
  const [wearLogDraft, setWearLogDraft] = useState({
    note: '',
    engagement: 0,
    energy: 0,
  })
  const [bumpId, setBumpId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      setData(emptyChoosingData())
      return
    }
    setData(normalizeChoosingData(compass.getDraftData(active, emptyChoosingData())))
    setLockedMsg(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot switch only
  }, [active?.id])

  const save = useCallback(
    async (id: string, next: ChoosingData) => {
      await compass.updateDraftData(id, next as unknown as Record<string, unknown>)
    },
    [compass],
  )
  const { savedAt, error } = useDebouncedDraftSave(
    active,
    data,
    save,
    Boolean(active && !readonly && !data.closed_on),
  )

  const editLocked = readonly || Boolean(data.closed_on)

  const patch = (p: Partial<ChoosingData>) => {
    if (editLocked) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({ ...d, ...p }))
  }

  const odysseyOptions = useMemo(() => {
    const od = compass.completeSnapshotsFor('odyssey').at(-1)
    if (!od) return [] as ChoosingOption[]
    const plans = normalizeOdysseyData(od.data).plans
    return plans
      .filter((p) => p.title.trim())
      .map((p) => ({
        id: `odyssey:${od.id}:${p.key}`,
        label: p.title.trim(),
        source: 'odyssey' as const,
        source_ref: od.id,
      }))
  }, [compass])

  const mindmapOptions = useMemo(() => {
    const mm = compass.completeSnapshotsFor('mindmap').at(-1)
    if (!mm) return [] as ChoosingOption[]
    const d = normalizeMindmapData(mm.data)
    const ideas = d.roleIdeas.length ? d.roleIdeas : mindmapRoleIdeasFromData(d)
    return ideas
      .filter((r) => r.title.trim())
      .map((r) => ({
        id: `mindmap:${mm.id}:${r.id}`,
        label: r.title.trim(),
        source: 'mindmap' as const,
        source_ref: mm.id,
      }))
  }, [compass])

  const prototypeOptions = useMemo(() => {
    return compass.prototypes
      .filter((p) => p.status === 'done' && p.answered === 'a_lot')
      .map((p) => ({
        id: `prototype:${p.id}`,
        label: p.title.trim() || (p.learned?.slice(0, 40) ?? ''),
        source: 'prototype' as const,
        source_ref: p.id,
      }))
      .filter((o) => o.label)
  }, [compass.prototypes])

  const mergeSourceOptions = (
    flags: ChoosingData['import_flags'],
    base: ChoosingOption[],
  ) => {
    const keepManual = base.filter((o) => o.source === 'manual')
    const next: ChoosingOption[] = [...keepManual]
    const pushUnique = (list: ChoosingOption[]) => {
      for (const o of list) {
        if (next.some((x) => x.id === o.id || x.label === o.label)) continue
        next.push(o)
      }
    }
    if (flags.odyssey) pushUnique(odysseyOptions)
    if (flags.mindmap) pushUnique(mindmapOptions)
    if (flags.prototype) pushUnique(prototypeOptions)
    // drop imported ones if flag off
    return next.filter((o) => {
      if (o.source === 'manual') return true
      if (o.source === 'odyssey') return flags.odyssey
      if (o.source === 'mindmap') return flags.mindmap
      if (o.source === 'prototype') return flags.prototype
      return true
    })
  }

  const setImportFlag = (
    key: keyof ChoosingData['import_flags'],
    on: boolean,
  ) => {
    if (editLocked) {
      setLockedMsg(true)
      return
    }
    setData((d) => {
      const import_flags = { ...d.import_flags, [key]: on }
      const options = mergeSourceOptions(import_flags, d.options)
      const ids = new Set(options.map((o) => o.id))
      return {
        ...d,
        import_flags,
        options,
        shortlist: d.shortlist.filter((id) => ids.has(id)),
        dropped: d.dropped.filter((id) => ids.has(id)),
      }
    })
  }

  const addManual = (label: string) => {
    if (editLocked || !label.trim()) return
    const opt: ChoosingOption = {
      id: newId(),
      label: label.trim(),
      source: 'manual',
    }
    setData((d) => ({ ...d, options: [...d.options, opt] }))
  }

  const removeOption = (id: string) => {
    if (editLocked) return
    setData((d) => ({
      ...d,
      options: d.options.filter((o) => o.id !== id),
      shortlist: d.shortlist.filter((x) => x !== id),
      dropped: d.dropped.filter((x) => x !== id),
    }))
  }

  const shortlistOpts = data.shortlist
    .map((id) => data.options.find((o) => o.id === id))
    .filter(Boolean) as ChoosingOption[]
  const poolOpts = data.options.filter(
    (o) => !data.shortlist.includes(o.id) && !data.dropped.includes(o.id),
  )
  const droppedOpts = data.dropped
    .map((id) => data.options.find((o) => o.id === id))
    .filter(Boolean) as ChoosingOption[]

  const addToShortlist = (id: string) => {
    if (editLocked) return
    setData((d) => {
      if (d.shortlist.includes(id)) return d
      let shortlist = [...d.shortlist, id]
      let bumped: string | null = null
      if (shortlist.length > 5) {
        bumped = shortlist[0]
        shortlist = shortlist.slice(1)
        setBumpId(bumped)
        window.setTimeout(() => setBumpId(null), 240)
      }
      const dropped = d.dropped.filter((x) => x !== id)
      if (bumped) dropped.push(bumped)
      return { ...d, shortlist, dropped: [...new Set(dropped)] }
    })
  }

  const removeFromShortlist = (id: string) => {
    if (editLocked) return
    setData((d) => ({
      ...d,
      shortlist: d.shortlist.filter((x) => x !== id),
      dropped: d.dropped.includes(id) ? d.dropped : [...d.dropped, id],
    }))
  }

  const restoreDropped = (id: string) => {
    if (editLocked) return
    setData((d) => ({
      ...d,
      dropped: d.dropped.filter((x) => x !== id),
    }))
  }

  const activeWearId = useMemo(() => {
    for (const [id, w] of Object.entries(data.wear)) {
      if (!w.started_on) continue
      if (w.logs.length < w.days) return id
    }
    return null
  }, [data.wear])

  const startWear = (id: string) => {
    if (editLocked || activeWearId) return
    setData((d) => ({
      ...d,
      wear: {
        ...d.wear,
        [id]: {
          started_on: todayKey(),
          days: WEAR_DAYS,
          logs: d.wear[id]?.logs ?? [],
        },
      },
    }))
  }

  const saveWearLog = (id: string) => {
    if (editLocked) return
    const note = wearLogDraft.note.trim()
    const date = todayKey()
    setData((d) => {
      const prev = d.wear[id] ?? {
        started_on: date,
        days: WEAR_DAYS,
        logs: [],
      }
      const withoutToday = prev.logs.filter((l) => l.date !== date)
      const log: ChoosingWearLog = {
        date,
        note,
        engagement: wearLogDraft.engagement,
        energy: wearLogDraft.energy,
      }
      return {
        ...d,
        wear: {
          ...d.wear,
          [id]: { ...prev, logs: [...withoutToday, log] },
        },
      }
    })
    setWearLogDraft({ note: '', engagement: 0, energy: 0 })
  }

  const setReflection = (
    id: string,
    key: 'head' | 'body' | 'future',
    value: string,
  ) => {
    if (editLocked) return
    setData((d) => ({
      ...d,
      reflections: {
        ...d.reflections,
        [id]: {
          head: d.reflections[id]?.head ?? '',
          body: d.reflections[id]?.body ?? '',
          future: d.reflections[id]?.future ?? '',
          [key]: value,
        },
      },
    }))
  }

  const canChooseNext = shortlistOpts.every((o) => {
    const r = data.reflections[o.id]
    return Boolean(r?.head?.trim() || r?.body?.trim() || r?.future?.trim())
  })

  const chosenOpt = data.options.find((o) => o.id === data.chosen)
  const guide = getGuide('choosing')

  const goStep = (step: ChoosingStep) => {
    if (editLocked && step !== data.step) {
      setLockedMsg(true)
      return
    }
    patch({ step })
  }

  return (
    <ExerciseChrome
      exerciseKey="choosing"
      compass={compass}
      all={all}
      active={active}
      onNavigateSnapshot={onNavigateSnapshot}
      onCompare={onCompare}
      onRequestSnapshotAi={onRequestSnapshotAi}
      onCreateNew={() => void ensureDraft(true)}
      savedAt={savedAt}
      error={error}
      help={guide?.what ?? ''}
      guideStep={choosingGuideStep(data.step)}
      lockedMsg={lockedMsg}
      hideComplete={data.step !== 'release' || Boolean(data.closed_on)}
      completeDisabled={!data.chosen}
      onComplete={() => {
        if (!active || !data.chosen) return
        const closed = {
          ...data,
          closed_on: todayKey(),
          step: 'release' as const,
        }
        setData(closed)
        void (async () => {
          await compass.updateDraftData(
            active.id,
            closed as unknown as Record<string, unknown>,
          )
          await compass.completeSnapshot(active.id)
        })()
      }}
      completeLabel="이 결정 닫기"
    >
      {data.closed_on && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-[14px]"
          style={{ background: COMPASS.soft, color: COMPASS.ink }}
        >
          <p className="font-semibold">
            {data.closed_on.replace(/-/g, '.')}에 정한 것 · 닫힘
          </p>
          <p className="mt-1 text-[13px] text-[#8A847E]">
            다시 열고 싶으면 새로 시작해. 이건 그대로 둬.
          </p>
        </div>
      )}

      {data.step !== 'decision' && (
        <div className="mb-5 flex flex-wrap items-center gap-1 overflow-x-auto text-[12px]">
          {STEP_RAIL.map((s, i) => {
            const order = STEP_RAIL.map((x) => x.step)
            const cur = order.indexOf(data.step)
            const current = s.step === data.step
            const done = cur > i
            return (
              <div key={s.step} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#ECE7E2]">──</span>}
                <button
                  type="button"
                  onClick={() => goStep(s.step)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 ${
                    current
                      ? 'font-semibold text-white'
                      : done
                        ? 'text-[#5A5550]'
                        : 'text-[#B5AFA8]'
                  }`}
                  style={current ? { background: COMPASS.accent } : undefined}
                >
                  {s.label}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {data.decision.trim() && data.step !== 'decision' && (
        <p className="mb-4 text-[13px] text-[#8A847E]">
          결정 · <span className="text-[#1C1B1A]">{data.decision}</span>
        </p>
      )}

      {/* ─── Decision ─── */}
      {data.step === 'decision' && (
        <div
          className="mx-auto max-w-xl rounded-[18px] border border-[#ECE7E2] bg-white p-6"
          style={{ boxShadow: cardShadow }}
        >
          <h2 className="text-[20px] font-bold text-[#1C1B1A]">
            지금 뭘 정하려고 해?
          </h2>
          <p className="mt-2 text-[14px] text-[#8A847E]">
            이게 없으면 옵션들이 서로 비교 불가능한 것들로 섞여.
          </p>
          <input
            value={data.decision}
            disabled={editLocked}
            onChange={(e) => patch({ decision: e.target.value })}
            placeholder="예: 다음 1년을 어디에 쓸지"
            className="mt-4 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3.5 py-3 text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-[#3E6B5E]/30"
          />
          <button
            type="button"
            disabled={!data.decision.trim() || editLocked}
            onClick={() => patch({ step: 'gather' })}
            className="mt-5 h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            시작
          </button>
        </div>
      )}

      {/* ─── Gather ─── */}
      {data.step === 'gather' && (
        <div className="space-y-5">
          <h2 className="text-[20px] font-bold text-[#1C1B1A]">
            지금까지 나온 것들 가져오기
          </h2>

          <ImportCheck
            checked={data.import_flags.odyssey}
            disabled={editLocked || odysseyOptions.length === 0}
            onChange={(v) => setImportFlag('odyssey', v)}
            title="오디세이 플랜"
            detail={
              odysseyOptions.length
                ? odysseyOptions.map((o) => o.label).join(' · ')
                : '완료된 오디세이가 아직 없어'
            }
          />
          <ImportCheck
            checked={data.import_flags.mindmap}
            disabled={editLocked || mindmapOptions.length === 0}
            onChange={(v) => setImportFlag('mindmap', v)}
            title="마인드맵 역할"
            detail={
              mindmapOptions.length
                ? mindmapOptions.map((o) => o.label).join(' · ')
                : '완료된 마인드맵이 아직 없어'
            }
          />
          <ImportCheck
            checked={data.import_flags.prototype}
            disabled={editLocked || prototypeOptions.length === 0}
            onChange={(v) => setImportFlag('prototype', v)}
            title="프로토타입에서 나온 것"
            detail={
              prototypeOptions.length
                ? prototypeOptions.map((o) => o.label).join(' · ')
                : '「답 됐음」으로 표시한 프로토타입이 아직 없어'
            }
          />

          <div>
            <p className="mb-2 text-[13px] font-semibold text-[#8A847E]">
              직접 추가
            </p>
            <input
              value={newOpt}
              disabled={editLocked}
              onChange={(e) => setNewOpt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addManual(newOpt)
                  setNewOpt('')
                }
              }}
              placeholder="+ Enter로 추가"
              className="w-full rounded-xl border border-[#ECE7E2] bg-white px-3.5 py-2.5 text-[14px]"
            />
          </div>

          <ul className="space-y-2">
            {data.options.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-2 rounded-xl bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
              >
                <span className="min-w-0 flex-1 text-[#1C1B1A]">{o.label}</span>
                <SourceTag source={o.source} />
                {!editLocked && (
                  <button
                    type="button"
                    onClick={() => removeOption(o.id)}
                    className="text-[#B5AFA8] hover:text-[#E0574A]"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          <p className="text-[13px] text-[#8A847E]">
            총 {data.options.length}개
            {data.options.length >= 8 && (
              <span className="ml-2 text-[#B5AFA8]">
                많을수록 좋아. 줄이는 건 다음 단계에서 해.
              </span>
            )}
          </p>

          {data.options.length < 3 && (
            <p className="text-[13px] text-[#8A847E]">
              세 개는 있어야 고르는 게 의미가 있어. 오디세이나 마인드맵을 먼저
              해도 좋고.
            </p>
          )}

          <button
            type="button"
            disabled={data.options.length < 3 || editLocked}
            onClick={() => patch({ step: 'narrow' })}
            className="h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            다음 · 좁히기 →
          </button>
        </div>
      )}

      {/* ─── Narrow ─── */}
      {data.step === 'narrow' && (
        <div>
          <h2 className="text-[20px] font-bold text-[#1C1B1A]">
            3~5개만 남기자
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#8A847E]">
            {`줄일 땐 잃을 게 없어.
잘못 지웠으면 나중에 알게 되고, 그때 다시 꺼내면 돼.`}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="mb-3 text-[12px] font-semibold text-[#8A847E]">
                전체 ({poolOpts.length + shortlistOpts.length})
              </p>
              <ul className="space-y-2">
                {poolOpts.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={editLocked}
                      onClick={() => addToShortlist(o.id)}
                      className="flex w-full items-center justify-between rounded-xl bg-[#FAF8F6] px-3 py-2.5 text-left text-[14px] text-[#1C1B1A] hover:bg-[#F3E5D8]/50"
                    >
                      <span className="min-w-0 truncate">{o.label}</span>
                      <span className="text-[#8A847E]">→</span>
                    </button>
                  </li>
                ))}
                {poolOpts.length === 0 && (
                  <p className="text-[13px] text-[#B5AFA8]">남은 옵션 없음</p>
                )}
              </ul>
            </div>

            <div
              className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="mb-3 text-[12px] font-semibold text-[#8A847E]">
                남길 것 ({shortlistOpts.length})
              </p>
              <ul className="space-y-2">
                {shortlistOpts.map((o, i) => (
                  <li
                    key={o.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] transition-opacity duration-[240ms] ${
                      bumpId === o.id ? 'opacity-40' : 'bg-[#FAF8F6]'
                    }`}
                  >
                    <span className="text-[#B5AFA8]">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-[#1C1B1A]">
                      {o.label}
                    </span>
                    {!editLocked && (
                      <button
                        type="button"
                        onClick={() => removeFromShortlist(o.id)}
                        className="text-[#B5AFA8] hover:text-[#E0574A]"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
                {shortlistOpts.length < 5 && (
                  <p className="text-[12px] text-[#B5AFA8]">
                    ({5 - shortlistOpts.length}까지 더 넣을 수 있어)
                  </p>
                )}
              </ul>
            </div>
          </div>

          {droppedOpts.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setDroppedOpen((v) => !v)}
                className="text-[13px] text-[#8A847E]"
              >
                {droppedOpen ? '▾' : '▸'} 내린 것 ({droppedOpts.length})
              </button>
              {droppedOpen && (
                <ul className="mt-2 space-y-1">
                  {droppedOpts.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] text-[#8A847E]"
                    >
                      <span>{o.label}</span>
                      {!editLocked && (
                        <button
                          type="button"
                          onClick={() => restoreDropped(o.id)}
                          className="font-semibold"
                          style={{ color: COMPASS.accent }}
                        >
                          다시 올리기
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {shortlistOpts.length >= 3 && (
            <p
              className="mt-5 text-[15px] font-medium"
              style={{ color: COMPASS.accent }}
            >
              여기까지 왔으면 이제 뭘 골라도 괜찮은 선택이야.
            </p>
          )}

          {shortlistOpts.length < 3 && (
            <p className="mt-4 text-[13px] text-[#8A847E]">
              3개 이상은 남겨야 다음으로 갈 수 있어.
            </p>
          )}

          <button
            type="button"
            disabled={
              shortlistOpts.length < 3 ||
              shortlistOpts.length > 5 ||
              editLocked
            }
            onClick={() => patch({ step: 'wear' })}
            className="mt-5 h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            다음 · 입어보기 →
          </button>
        </div>
      )}

      {/* ─── Wear ─── */}
      {data.step === 'wear' && (
        <div>
          <h2 className="text-[20px] font-bold text-[#1C1B1A]">
            하나씩 며칠 입어보자
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#8A847E]">
            {`이미 정했다고 치고 지내보는 거야.
머리로 상상하는 거 말고, 그렇게 정한 사람처럼 하루를 살아보고 어땠는지 적어.`}
          </p>

          <ul className="mt-5 space-y-4">
            {shortlistOpts.map((o, i) => {
              const w = data.wear[o.id]
              const active = activeWearId === o.id
              const done = Boolean(w && w.logs.length >= w.days)
              const dayN = (w?.logs.length ?? 0) + (active ? 1 : 0)
              return (
                <li
                  key={o.id}
                  className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
                  style={{ boxShadow: cardShadow }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-semibold text-[#1C1B1A]">
                        {i + 1}. {o.label}
                      </p>
                      {w?.started_on && (
                        <p className="mt-1 text-[12px] text-[#8A847E]">
                          {Math.min(w.logs.length, w.days)}일차 / {w.days}일
                          {done ? ' · 끝' : ''}
                        </p>
                      )}
                    </div>
                    {!editLocked && !done && !active && !activeWearId && (
                      <button
                        type="button"
                        onClick={() => startWear(o.id)}
                        className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                        style={{ background: COMPASS.accent }}
                      >
                        시작하기
                      </button>
                    )}
                    {active && (
                      <span
                        className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
                        style={{
                          background: COMPASS.soft,
                          color: COMPASS.ink,
                        }}
                      >
                        입어보는 중
                      </span>
                    )}
                  </div>

                  {w && w.days > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ECE7E2]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (w.logs.length / w.days) * 100)}%`,
                          background: COMPASS.accent,
                        }}
                      />
                    </div>
                  )}

                  {w?.logs.map((l, li) => (
                    <p key={l.date} className="mt-2 text-[13px] text-[#5A5550]">
                      · {li + 1}일차: {l.note || '(메모 없음)'}
                    </p>
                  ))}

                  {active && !editLocked && (
                    <div className="mt-3 space-y-3 rounded-xl bg-[#FAF8F6] p-3">
                      <p className="text-[12px] text-[#8A847E]">
                        {Math.min(dayN, WEAR_DAYS)}일차 메모
                      </p>
                      <input
                        value={wearLogDraft.note}
                        onChange={(e) =>
                          setWearLogDraft((d) => ({
                            ...d,
                            note: e.target.value,
                          }))
                        }
                        placeholder="오늘 어땠어?"
                        className="w-full rounded-lg border border-[#ECE7E2] bg-white px-3 py-2 text-[14px]"
                      />
                      <div className="flex flex-wrap gap-4">
                        <CompassBipolarSlider
                          label="몰입"
                          value={wearLogDraft.engagement}
                          onChange={(v) =>
                            setWearLogDraft((d) => ({ ...d, engagement: v }))
                          }
                        />
                        <CompassBipolarSlider
                          label="에너지"
                          value={wearLogDraft.energy}
                          onChange={(v) =>
                            setWearLogDraft((d) => ({ ...d, energy: v }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => saveWearLog(o.id)}
                        className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
                        style={{ background: COMPASS.accent }}
                      >
                        오늘 기록 저장
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <p className="mt-4 text-[13px] text-[#8A847E]">
            건너뛰어도 돼. 근데 해보면 확실히 달라져.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={editLocked}
              onClick={() => patch({ step: 'choose' })}
              className="h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
              style={{ background: COMPASS.accent }}
            >
              다음 · 고르기 →
            </button>
            <button
              type="button"
              disabled={editLocked}
              onClick={() => patch({ step: 'choose' })}
              className="text-[12px] text-[#B5AFA8] hover:text-[#8A847E]"
            >
              입어보기 건너뛰기
            </button>
          </div>
        </div>
      )}

      {/* ─── Choose ─── */}
      {data.step === 'choose' && (
        <div>
          <h2 className="text-[20px] font-bold text-[#1C1B1A]">이제 하나만.</h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#8A847E]">
            {`3~5개로 줄였으면 이미 못 지는 상태야. 여기서 뭘 골라도
좋은 선택이야. 이 단계는 사실 보너스에 가까워.`}
          </p>
          <p className="mt-3 text-[14px] text-[#5A5550]">
            각각에 대해, 여러 방식으로 물어봐.
          </p>

          <ul className="mt-5 space-y-4">
            {shortlistOpts.map((o) => {
              const r = data.reflections[o.id] ?? {
                head: '',
                body: '',
                future: '',
              }
              const selected = data.chosen === o.id
              const wear = data.wear[o.id]
              return (
                <li
                  key={o.id}
                  className="rounded-[18px] border bg-white p-4"
                  style={{
                    boxShadow: cardShadow,
                    borderColor: selected ? COMPASS.accent : '#ECE7E2',
                    borderWidth: selected ? 2 : 1,
                  }}
                >
                  <p className="mb-3 text-[15px] font-semibold text-[#1C1B1A]">
                    {o.label}
                  </p>
                  <Field
                    label="머리로 따져보면"
                    value={r.head}
                    disabled={editLocked}
                    onChange={(v) => setReflection(o.id, 'head', v)}
                  />
                  <Field
                    label="생각만 해도 몸이 어떤 느낌이야"
                    value={r.body}
                    disabled={editLocked}
                    onChange={(v) => setReflection(o.id, 'body', v)}
                  />
                  <Field
                    label="5년 뒤에 이걸 안 한 걸 후회할까"
                    value={r.future}
                    disabled={editLocked}
                    onChange={(v) => setReflection(o.id, 'future', v)}
                  />
                  {wear?.logs.length ? (
                    <div className="mb-3">
                      <p className="mb-1 text-[12px] font-semibold text-[#8A847E]">
                        입어봤을 때 어땠어
                      </p>
                      <ul className="space-y-0.5 text-[13px] text-[#5A5550]">
                        {wear.logs.map((l, i) => (
                          <li key={l.date}>
                            · {i + 1}일차: {l.note || '—'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <label className="mt-2 flex items-center gap-2 text-[14px]">
                    <input
                      type="radio"
                      name="chosen"
                      disabled={editLocked}
                      checked={selected}
                      onChange={() => patch({ chosen: o.id })}
                    />
                    이걸로
                  </label>
                </li>
              )
            })}
          </ul>

          <p className="mt-5 whitespace-pre-wrap text-[14px] leading-relaxed text-[#8A847E]">
            {`다 좋아 보여? 그럼 직감을 들어.
이유를 몰라도 강하게 끌리는 게 있으면 그게 답이야.
직감은 네가 살아온 것 전부의 합이야.`}
          </p>

          {!canChooseNext && (
            <p className="mt-3 text-[13px] text-[#8A847E]">
              옵션마다 세 칸 중 하나만 채워도 돼.
            </p>
          )}

          <button
            type="button"
            disabled={!data.chosen || !canChooseNext || editLocked}
            onClick={() => patch({ step: 'release' })}
            className="mt-5 h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            정했어 →
          </button>
        </div>
      )}

      {/* ─── Release ─── */}
      {data.step === 'release' && chosenOpt && (
        <ReleasePanel
          chosen={chosenOpt}
          others={shortlistOpts.filter((o) => o.id !== chosenOpt.id)}
          environment={data.environment}
          firstStep={data.first_step}
          closed={Boolean(data.closed_on)}
          editLocked={editLocked}
          onEnvironment={(v) => patch({ environment: v })}
          onFirstStep={(v) => patch({ first_step: v })}
          onAddWeekly={
            onAddWeeklyTask && data.first_step.trim()
              ? () => onAddWeeklyTask(data.first_step.trim())
              : undefined
          }
        />
      )}
    </ExerciseChrome>
  )
}

function ImportCheck({
  checked,
  disabled,
  onChange,
  title,
  detail,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  title: string
  detail: string
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-[18px] border border-[#ECE7E2] bg-white p-4 ${
        disabled ? 'opacity-50' : ''
      }`}
      style={{ boxShadow: cardShadow }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>
        <span className="block text-[15px] font-semibold text-[#1C1B1A]">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] text-[#8A847E]">{detail}</span>
      </span>
    </label>
  )
}

function SourceTag({ source }: { source: ChoosingOptionSource }) {
  const label =
    source === 'odyssey'
      ? '오디세이'
      : source === 'mindmap'
        ? '마인드맵'
        : source === 'prototype'
          ? '프로토타입'
          : '직접'
  return (
    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] text-[#8A847E]">
      {label}
    </span>
  )
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[12px] font-semibold text-[#8A847E]">
        {label}
      </span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[14px] outline-none focus:bg-white"
      />
    </label>
  )
}

function ReleasePanel({
  chosen,
  others,
  environment,
  firstStep,
  closed,
  editLocked,
  onEnvironment,
  onFirstStep,
  onAddWeekly,
}: {
  chosen: ChoosingOption
  others: ChoosingOption[]
  environment: string
  firstStep: string
  closed: boolean
  editLocked: boolean
  onEnvironment: (v: string) => void
  onFirstStep: (v: string) => void
  onAddWeekly?: () => void
}) {
  return (
    <div>
      <h2 className="text-[20px] font-bold text-[#1C1B1A]">
        정했어: {chosen.label}
      </h2>

      <ul className="mt-5 space-y-2">
        {others.map((o, i) => (
          <li
            key={o.id}
            className="choosing-fade-item rounded-xl bg-[#FAF8F6] px-3 py-2.5 text-[14px] text-[#1C1B1A]"
            style={{
              animationDelay: `${i * 150}ms`,
            }}
          >
            {o.label}
          </li>
        ))}
      </ul>
      <style>{`
        @keyframes choosingFade {
          from { opacity: 1; }
          to { opacity: 0.12; }
        }
        .choosing-fade-item {
          animation: choosingFade 0.5s ease forwards;
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .choosing-fade-item {
            animation: none;
            opacity: 0.12;
          }
        }
      `}</style>

      <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-[#8A847E]">
        {`이건 지금 안 고른 것이지, 영영 못 하는 게 아니야.
다시 필요해지면 그때 꺼내면 돼.`}
      </p>

      <hr className="my-6 border-[#ECE7E2]" />

      <label className="mb-4 block">
        <span className="mb-1 block text-[14px] font-semibold text-[#1C1B1A]">
          이 선택을 안 흔들리게 하려면 뭘 바꾸면 좋을까?
        </span>
        <textarea
          value={environment}
          disabled={editLocked}
          onChange={(e) => onEnvironment(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[14px]"
        />
        <span className="mt-1 block text-[12px] text-[#B5AFA8]">
          ⓘ 환경을 바꾸면 결심보다 오래 가. 뭘 치우고 뭘 눈에 띄게 둘래?
        </span>
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-[14px] font-semibold text-[#1C1B1A]">
          첫 걸음 하나
        </span>
        <input
          value={firstStep}
          disabled={editLocked}
          onChange={(e) => onFirstStep(e.target.value)}
          className="w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2.5 text-[14px]"
        />
      </label>

      {onAddWeekly && !closed && (
        <button
          type="button"
          onClick={onAddWeekly}
          className="mb-6 text-[13px] font-semibold"
          style={{ color: COMPASS.accent }}
        >
          Weekly에 넣기
        </button>
      )}

      {!closed && (
        <p className="text-[13px] text-[#8A847E]">
          아래 <span className="font-semibold">이 결정 닫기</span>로 마무리해.
        </p>
      )}
    </div>
  )
}
