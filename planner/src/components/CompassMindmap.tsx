import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  COMPASS,
  MINDMAP_MAP_KEYS,
  MINDMAP_MAP_LABELS,
  emptyMindmapData,
  emptyMindmapMap,
  emptyMindmapRole,
  mindmapRoleIdeasFromData,
  newId,
  normalizeMindmapData,
  type LdJournalEntry,
  type MindmapData,
  type MindmapMapKey,
  type MindmapMapState,
  type MindmapRing,
  type MindmapSourcePick,
  type MindmapTreeNode,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  CompassExerciseHeader,
  ExerciseChrome,
  cardShadow,
  useDebouncedDraftSave,
  useExerciseSnapshot,
} from './CompassExerciseShell'
import { NapkinSketch } from './NapkinSketch'

interface CompassMindmapProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
  onOpenGoodtime?: () => void
  onOpenOdyssey?: () => void
}

const HELP = `굿타임 저널에서 몰입됐던 것 하나, 기운을 줬던 것 하나, 시간 가는 줄 몰랐던 것 하나를
골라서 마인드맵 세 개를 만들 거야.

맵마다 4분. 짧은 게 일부러 그런 거야. 따질 시간을 안 주려고.
말 되는지, 쓸모 있는지 생각하지 말고 그냥 뻗어나가면 돼.

다 그리면 제일 바깥 링에서 눈에 확 들어오는 거 3개를 골라서
"이런 일을 하는 사람"을 하나 만들어. 재밌고, 누군가한테 도움이 되면 그걸로 충분해.
현실적일 필요 없어.

세 번 하고 나면 서로 다른 삶 세 개가 나와. 그게 다음 연습 재료야.`

const CANVAS_W = 1400
const CANVAS_H = 900
const TIMER_SEC = 240
const CENTER = { x: CANVAS_W / 2 - 90, y: CANVAS_H / 2 - 32 }

const RING_SIZE: Record<MindmapRing, { w: number; h: number }> = {
  0: { w: 180, h: 64 },
  1: { w: 150, h: 48 },
  2: { w: 130, h: 40 },
  3: { w: 120, h: 36 },
}

type NodeUIData = {
  label: string
  ring: MindmapRing
  editing: boolean
  pickMode: boolean
  picked: boolean
  dimmed: boolean
  onAdd?: () => void
  onLabel: (label: string) => void
  onEditDone: (label: string, cancel: boolean) => void
  onStartEdit: () => void
  onPick?: () => void
  onTabSibling?: () => void
  onEnterSibling?: () => void
}

function aggregateByActivity(entries: LdJournalEntry[]) {
  const map = new Map<
    string,
    { label: string; eng: number; ene: number; n: number; flow: boolean; id: string }
  >()
  for (const e of entries) {
    const k = e.activity.trim().toLowerCase()
    if (!k) continue
    const prev = map.get(k)
    if (!prev) {
      map.set(k, {
        label: e.activity.trim(),
        eng: e.engagement,
        ene: e.energy,
        n: 1,
        flow: e.isFlow,
        id: e.id,
      })
    } else {
      map.set(k, {
        ...prev,
        eng: prev.eng + e.engagement,
        ene: prev.ene + e.energy,
        n: prev.n + 1,
        flow: prev.flow || e.isFlow,
      })
    }
  }
  return [...map.values()].map((v) => ({
    label: v.label,
    eng: v.eng / v.n,
    ene: v.ene / v.n,
    flow: v.flow,
    entry_ref: v.id,
  }))
}

function placeChild(
  parent: MindmapTreeNode,
  siblingCount: number,
  ring: MindmapRing,
): { x: number; y: number } {
  const n = Math.max(siblingCount + 1, ring === 1 ? 6 : 4)
  const angle = (siblingCount / n) * Math.PI * 2 - Math.PI / 2
  const dist = ring === 1 ? 200 : ring === 2 ? 160 : 130
  const size = RING_SIZE[ring]
  return {
    x: parent.x + RING_SIZE[parent.ring as MindmapRing].w / 2 + Math.cos(angle) * dist - size.w / 2,
    y: parent.y + RING_SIZE[parent.ring as MindmapRing].h / 2 + Math.sin(angle) * dist - size.h / 2,
  }
}

function formatTimer(sec: number) {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const MindNode = memo(function MindNode({ data }: NodeProps<Node<NodeUIData>>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const size = RING_SIZE[data.ring]
  useLayoutEffect(() => {
    if (data.editing) inputRef.current?.focus()
  }, [data.editing])

  const style: CSSProperties = {
    width: size.w,
    height: size.h,
    opacity: data.dimmed ? 0.35 : 1,
    pointerEvents: data.dimmed && data.pickMode ? 'none' : undefined,
    background:
      data.ring === 0
        ? COMPASS.accent
        : data.picked
          ? COMPASS.soft
          : data.ring === 2
            ? '#FAF8F6'
            : '#fff',
    color: data.ring === 0 ? '#fff' : '#1C1B1A',
    border:
      data.picked
        ? `2px solid ${COMPASS.accent}`
        : data.ring === 0
          ? 'none'
          : data.ring === 3
            ? `1.5px solid ${COMPASS.line}`
            : data.ring === 1
              ? `1.5px solid ${COMPASS.line}`
              : '1px solid #ECE7E2',
    boxShadow: data.picked ? `0 0 0 2px ${COMPASS.soft}` : undefined,
  }

  return (
    <div
      className="group relative flex items-center justify-center rounded-xl px-2 text-center text-[12px] font-medium leading-tight"
      style={style}
      title={
        data.pickMode && data.ring < 3
          ? '바깥 링에서만 골라. 안쪽은 늘 하던 생각이야.'
          : undefined
      }
      onClick={() => {
        if (data.pickMode && data.ring === 3) data.onPick?.()
        else if (!data.pickMode && data.ring > 0 && !data.editing) data.onStartEdit()
      }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      {data.editing ? (
        <input
          ref={inputRef}
          defaultValue={data.label}
          className="w-full bg-transparent text-center text-[12px] outline-none"
          style={{ color: 'inherit' }}
          onBlur={(e) => data.onEditDone(e.target.value, false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              data.onEditDone(data.label, true)
            } else if (e.key === 'Tab') {
              e.preventDefault()
              data.onEditDone((e.target as HTMLInputElement).value, false)
              data.onTabSibling?.()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              data.onEditDone((e.target as HTMLInputElement).value, false)
              data.onEnterSibling?.()
            }
          }}
        />
      ) : (
        <span className="line-clamp-2 w-full">{data.label || '…'}</span>
      )}
      {!data.pickMode && data.ring < 3 && data.ring > 0 && (
        <button
          type="button"
          className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[14px] font-bold text-white group-hover:flex"
          style={{ background: COMPASS.accent }}
          onClick={(e) => {
            e.stopPropagation()
            data.onAdd?.()
          }}
        >
          +
        </button>
      )}
      {!data.pickMode && data.ring === 0 && (
        <button
          type="button"
          className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[14px] font-bold text-white group-hover:flex"
          style={{ background: '#fff', color: COMPASS.accent }}
          onClick={(e) => {
            e.stopPropagation()
            data.onAdd?.()
          }}
        >
          +
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  )
})

const nodeTypes = { mind: MindNode }

export function CompassMindmap({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
  onOpenGoodtime,
  onOpenOdyssey,
}: CompassMindmapProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'mindmap',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<MindmapData>(emptyMindmapData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [forceManual, setForceManual] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [timerLeft, setTimerLeft] = useState(TIMER_SEC)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)
  const undoRef = useRef<MindmapMapState[]>([])
  const timerStartedRef = useRef(false)
  const secondsAccRef = useRef(0)

  const journalReady = useMemo(() => {
    const completes = compass.completeSnapshotsFor('goodtime')
    if (completes.length > 0) return true
    const draft = compass.draftFor('goodtime')
    if (!draft) return false
    const n = compass.journalEntries.filter((e) => e.runId === draft.id).length
    return n >= 10
  }, [compass])

  const journalEntries = useMemo(() => {
    const complete = compass.completeSnapshotsFor('goodtime').at(-1)
    if (complete) {
      return compass.journalEntries.filter((e) => e.runId === complete.id)
    }
    const draft = compass.draftFor('goodtime')
    if (draft) {
      return compass.journalEntries.filter((e) => e.runId === draft.id)
    }
    return compass.journalEntries
  }, [compass])

  const candidates = useMemo(() => {
    const agg = aggregateByActivity(journalEntries)
    const byEng = [...agg].sort((a, b) => b.eng - a.eng).slice(0, 5)
    const byEne = [...agg].sort((a, b) => b.ene - a.ene).slice(0, 5)
    const byFlow = agg.filter((a) => a.flow).slice(0, 5)
    return { byEng, byEne, byFlow }
  }, [journalEntries])

  useEffect(() => {
    if (!active) {
      setData(emptyMindmapData())
      return
    }
    let next = normalizeMindmapData(
      compass.getDraftData(active, emptyMindmapData()),
    )
    if (next.step === 'gate') {
      next = {
        ...next,
        step: journalReady || forceManual ? 'sources' : 'gate',
      }
    }
    if (readonly) next = { ...next, step: 'summary' }
    setData(next)
    setLockedMsg(false)
    setEditingId(null)
    timerStartedRef.current = false
    setTimerRunning(false)
    setTimerExpired(false)
    setTimerLeft(TIMER_SEC)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid rehydrate after autosave
  }, [active?.id, journalReady, forceManual, readonly])

  const save = useCallback(
    async (id: string, next: MindmapData) => {
      const synced = {
        ...next,
        roleIdeas: mindmapRoleIdeasFromData(next),
      }
      await compass.updateDraftData(id, synced as unknown as Record<string, unknown>)
    },
    [compass],
  )
  const { savedAt, error } = useDebouncedDraftSave(
    active,
    data,
    save,
    Boolean(active && !readonly && data.step !== 'gate'),
  )

  const patch = (p: Partial<MindmapData>) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => ({ ...d, ...p }))
  }

  const updateMap = (
    index: number,
    updater: (m: MindmapMapState) => MindmapMapState,
  ) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    setData((d) => {
      const maps = d.maps.map((m, i) => (i === index ? updater(m) : m))
      return { ...d, maps, roleIdeas: mindmapRoleIdeasFromData({ ...d, maps }) }
    })
  }

  const currentMap = data.maps[data.map_index] ?? emptyMindmapMap('engagement')
  const currentKey = MINDMAP_MAP_KEYS[data.map_index]

  // Timer
  useEffect(() => {
    if (!timerRunning || data.step !== 'draw') return
    const id = window.setInterval(() => {
      setTimerLeft((t) => {
        if (t <= 1) {
          setTimerRunning(false)
          setTimerExpired(true)
          secondsAccRef.current = TIMER_SEC
          return 0
        }
        secondsAccRef.current = TIMER_SEC - (t - 1)
        return t - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning, data.step])

  useEffect(() => {
    if (data.step !== 'draw') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        const prev = undoRef.current.pop()
        if (prev) {
          updateMap(data.map_index, () => prev)
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = editingId
        // handled via selection — skip if editing input
        if (document.activeElement?.tagName === 'INPUT') return
        if (sel) deleteNode(sel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.step, data.map_index, editingId])

  const pushUndo = () => {
    undoRef.current.push(structuredClone(currentMap))
    if (undoRef.current.length > 40) undoRef.current.shift()
  }

  const ensureCenter = (map: MindmapMapState, activity: string): MindmapMapState => {
    if (map.nodes.some((n) => n.ring === 0)) return map
    const id = newId()
    return {
      ...map,
      nodes: [
        {
          id,
          label: activity,
          ring: 0,
          parent: null,
          x: CENTER.x,
          y: CENTER.y,
        },
      ],
      edges: [],
    }
  }

  const startDrawForIndex = (index: 0 | 1 | 2) => {
    const key = MINDMAP_MAP_KEYS[index]
    const src = data.sources[key]
    if (!src?.activity) return
    updateMap(index, (m) => ensureCenter(m, src.activity))
    patch({ step: 'draw', map_index: index })
    setTimerLeft(TIMER_SEC)
    setTimerExpired(false)
    setTimerRunning(false)
    timerStartedRef.current = false
    secondsAccRef.current = 0
    undoRef.current = []
    setEditingId(null)
  }

  const startTimerIfNeeded = () => {
    if (!timerStartedRef.current) {
      timerStartedRef.current = true
      setTimerRunning(true)
    }
  }

  const addChild = (parentId: string) => {
    pushUndo()
    startTimerIfNeeded()
    const parent = currentMap.nodes.find((n) => n.id === parentId)
    if (!parent || parent.ring >= 3) return
    const ring = (parent.ring + 1) as MindmapRing
    const siblings = currentMap.nodes.filter((n) => n.parent === parentId)
    const pos = placeChild(parent, siblings.length, ring)
    const id = newId()
    updateMap(data.map_index, (m) => ({
      ...m,
      nodes: [
        ...m.nodes,
        { id, label: '', ring, parent: parentId, x: pos.x, y: pos.y },
      ],
      edges: [...m.edges, { source: parentId, target: id }],
    }))
    setEditingId(id)
  }

  const addSibling = (nodeId: string) => {
    const node = currentMap.nodes.find((n) => n.id === nodeId)
    if (!node?.parent) return
    addChild(node.parent)
  }

  const deleteNode = (nodeId: string) => {
    const node = currentMap.nodes.find((n) => n.id === nodeId)
    if (!node || node.ring === 0) return
    pushUndo()
    const toRemove = new Set<string>()
    const walk = (id: string) => {
      toRemove.add(id)
      currentMap.nodes
        .filter((n) => n.parent === id)
        .forEach((c) => walk(c.id))
    }
    walk(nodeId)
    updateMap(data.map_index, (m) => ({
      ...m,
      nodes: m.nodes.filter((n) => !toRemove.has(n.id)),
      edges: m.edges.filter(
        (e) => !toRemove.has(e.source) && !toRemove.has(e.target),
      ),
      picked: m.picked.filter((id) => !toRemove.has(id)),
    }))
    setEditingId(null)
  }

  const setLabel = (nodeId: string, label: string, cancel: boolean) => {
    const node = currentMap.nodes.find((n) => n.id === nodeId)
    if (!node) return
    if (cancel) {
      if (!node.label.trim()) deleteNode(nodeId)
      setEditingId(null)
      return
    }
    const trimmed = label.trim()
    if (!trimmed) {
      deleteNode(nodeId)
      return
    }
    updateMap(data.map_index, (m) => ({
      ...m,
      nodes: m.nodes.map((n) => (n.id === nodeId ? { ...n, label: trimmed } : n)),
    }))
    setEditingId(null)
  }

  const ring1Count = currentMap.nodes.filter((n) => n.ring === 1).length
  const ring3Count = currentMap.nodes.filter((n) => n.ring === 3).length
  const canFinishMap = ring1Count >= 3

  const finishDraw = () => {
    if (!canFinishMap) return
    updateMap(data.map_index, (m) => ({
      ...m,
      seconds_used: Math.max(m.seconds_used, secondsAccRef.current || TIMER_SEC - timerLeft),
    }))
    setTimerRunning(false)
    patch({ step: 'pick' })
  }

  const skipMap = () => {
    const completedMaps = data.maps.filter(
      (m, i) => i !== data.map_index && (m.role.name.trim() || m.skipped),
    )
    // can't skip if it would leave zero maps done and this is last chance — "3개 다 건너뛸 수는 없다"
    const othersSkippedOrEmpty = data.maps.every(
      (m, i) => i === data.map_index || m.skipped || !m.role.name.trim(),
    )
    const willBeAllSkipped =
      othersSkippedOrEmpty &&
      data.map_index === 2
    if (willBeAllSkipped && completedMaps.length === 0) {
      // if first two already skipped and trying to skip third
      const skippedCount = data.maps.filter((m) => m.skipped).length
      if (skippedCount >= 2) return
    }
    updateMap(data.map_index, (m) => ({
      ...m,
      skipped: true,
      seconds_used: secondsAccRef.current || TIMER_SEC - timerLeft,
    }))
    setTimerRunning(false)
    goNextAfterRole()
  }

  const togglePick = (nodeId: string) => {
    updateMap(data.map_index, (m) => {
      const has = m.picked.includes(nodeId)
      if (has) return { ...m, picked: m.picked.filter((id) => id !== nodeId) }
      if (m.picked.length < 3) return { ...m, picked: [...m.picked, nodeId] }
      // FIFO: drop first
      return { ...m, picked: [...m.picked.slice(1), nodeId] }
    })
  }

  const goNextAfterRole = () => {
    if (data.map_index < 2) {
      startDrawForIndex((data.map_index + 1) as 0 | 1 | 2)
    } else {
      patch({ step: 'summary' })
    }
  }

  const saveRoleAndNext = () => {
    const role = currentMap.role
    if (!role.description.trim() || !role.name.trim()) return
    updateMap(data.map_index, (m) => ({ ...m, skipped: false }))
    goNextAfterRole()
  }

  const rfNodes: Node<NodeUIData>[] = useMemo(() => {
    const pickMode = data.step === 'pick'
    return currentMap.nodes.map((n) => ({
      id: n.id,
      type: 'mind',
      position: { x: n.x, y: n.y },
      draggable: false,
      data: {
        label: n.label,
        ring: n.ring,
        editing: editingId === n.id,
        pickMode,
        picked: currentMap.picked.includes(n.id),
        dimmed: pickMode && n.ring < 3,
        onAdd: () => addChild(n.id),
        onLabel: () => {},
        onEditDone: (label, cancel) => setLabel(n.id, label, cancel),
        onStartEdit: () => {
          if (n.ring === 0) return
          setEditingId(n.id)
        },
        onPick: () => togglePick(n.id),
        onTabSibling: () => addSibling(n.id),
        onEnterSibling: () => addSibling(n.id),
      },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap, editingId, data.step, data.map_index])

  const rfEdges = useMemo(
    () =>
      currentMap.edges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        style: { stroke: COMPASS.line, strokeWidth: 1.5 },
      })),
    [currentMap.edges],
  )

  // ─── Gate ───
  if (data.step === 'gate' && !forceManual && !journalReady) {
    return (
      <div>
        <CompassExerciseHeader
          title="마인드맵"
          subtitle="굿타임에서 고른 셋으로 맵을 그리고 역할 세 개 만들기"
        />
        <div
          className="rounded-[18px] border border-[#ECE7E2] bg-white p-6 text-center"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-[15px] text-[#1C1B1A]">
            먼저 굿타임 저널을 며칠 써야 해. 거기서 재료를 가져오거든.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: COMPASS.accent }}
              onClick={onOpenGoodtime}
            >
              굿타임 저널 하러 가기
            </button>
            <button
              type="button"
              className="rounded-full border border-[#ECE7E2] px-4 py-2 text-[13px] font-semibold text-[#8A847E]"
              onClick={() => {
                setForceManual(true)
                patch({ step: 'sources' })
              }}
            >
              그냥 직접 적을래
            </button>
          </div>
        </div>
      </div>
    )
  }

  const allSourcesSame =
    data.sources.engagement?.activity &&
    data.sources.engagement.activity === data.sources.energy?.activity &&
    data.sources.engagement.activity === data.sources.flow?.activity

  const sourcesReady =
    Boolean(data.sources.engagement?.activity?.trim()) &&
    Boolean(data.sources.energy?.activity?.trim()) &&
    Boolean(data.sources.flow?.activity?.trim())

  const skippedCount = data.maps.filter((m) => m.skipped).length

  return (
    <ExerciseChrome
      exerciseKey="mindmap"
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
      lockedMsg={lockedMsg}
      onDismissLock={() => setLockedMsg(false)}
      hideComplete={data.step !== 'summary'}
      completeDisabled={data.different_enough === null}
      onComplete={() => {
        if (!active || data.different_enough === null) return
        const synced = {
          ...data,
          roleIdeas: mindmapRoleIdeasFromData(data),
        }
        void (async () => {
          await compass.updateDraftData(
            active.id,
            synced as unknown as Record<string, unknown>,
          )
          await compass.completeSnapshot(active.id)
        })()
      }}
      completeLabel="완료하기"
    >
      {/* ─── Sources ─── */}
      {(data.step === 'sources' || (data.step === 'gate' && (journalReady || forceManual))) && (
        <SourcesPanel
          candidates={candidates}
          sources={data.sources}
          setSource={(key, pick) =>
            patch({
              sources: { ...data.sources, [key]: pick },
            })
          }
          allSame={Boolean(allSourcesSame)}
          ready={sourcesReady}
          onStart={() => startDrawForIndex(0)}
          readonly={readonly}
        />
      )}

      {/* ─── Draw ─── */}
      {data.step === 'draw' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-[#1C1B1A]">
                맵 {data.map_index + 1} / 3 · {MINDMAP_MAP_LABELS[currentKey]}
              </p>
              <p className="text-[13px] text-[#8A847E]">
                머릿속에 떠오르는 대로. 말 되는지 따지지 마.
              </p>
            </div>
            <div
              className="text-[18px] font-bold tabular-nums"
              style={{
                color: timerLeft <= 60 ? '#C08A4A' : COMPASS.ink,
              }}
            >
              ⏱ {formatTimer(timerLeft)}
            </div>
          </div>
          {timerExpired && (
            <p className="mb-2 text-[13px] text-[#8A847E]">
              4분 지났어. 여기까지도 충분하고, 더 하고 싶으면 계속해.
            </p>
          )}
          {ring3Count < 5 && (
            <p className="mb-2 text-[13px] text-[#B5AFA8]">
              제일 바깥까지 나가야 재밌는 게 나와. 거기서 재료를 뽑거든.
            </p>
          )}
          <div
            className="overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
            style={{ height: Math.min(CANVAS_H, 520), boxShadow: cardShadow }}
          >
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.5}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={!readonly}
              proOptions={{ hideAttribution: true }}
              style={{ width: '100%', height: '100%' }}
            >
              <Background gap={24} size={1} color="#E8E4DF" />
            </ReactFlow>
          </div>
          {!readonly && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              {!canFinishMap && (
                <p className="mr-auto text-[13px] text-[#B5AFA8]">
                  가지 몇 개만 더 뻗어보자
                </p>
              )}
              <button
                type="button"
                className="text-[13px] text-[#8A847E]"
                disabled={skippedCount >= 2}
                onClick={skipMap}
              >
                건너뛰기
              </button>
              <button
                type="button"
                disabled={!canFinishMap}
                onClick={finishDraw}
                className="h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: COMPASS.accent }}
              >
                다 됐어 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Pick ─── */}
      {data.step === 'pick' && (
        <div>
          <p className="mb-1 text-[15px] font-semibold text-[#1C1B1A]">
            바깥 링에서 눈에 확 들어오는 거 3개만 골라.
          </p>
          <p className="mb-4 text-[13px] text-[#8A847E]">
            고민하지 말고, 튀어나오는 걸로.
          </p>
          <div
            className="overflow-hidden rounded-[18px] border border-[#ECE7E2] bg-white"
            style={{ height: Math.min(CANVAS_H, 480), boxShadow: cardShadow }}
          >
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.5}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} color="#E8E4DF" />
            </ReactFlow>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-[#8A847E]">고른 것:</span>
            {currentMap.picked.map((id) => {
              const n = currentMap.nodes.find((x) => x.id === id)
              return (
                <span
                  key={id}
                  className="rounded-full px-3 py-1 text-[13px] font-medium transition-all duration-200"
                  style={{ background: COMPASS.soft, color: COMPASS.ink }}
                >
                  {n?.label ?? id}
                </span>
              )
            })}
            <span className="ml-auto text-[13px] text-[#B5AFA8]">
              {currentMap.picked.length} / 3
            </span>
          </div>
          {!readonly && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={currentMap.picked.length !== 3}
                onClick={() => patch({ step: 'role' })}
                className="h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: COMPASS.accent }}
              >
                역할 만들기 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Role ─── */}
      {data.step === 'role' && (
        <RolePanel
          map={currentMap}
          readonly={readonly}
          onChangeRole={(role) =>
            updateMap(data.map_index, (m) => ({ ...m, role }))
          }
          onNext={saveRoleAndNext}
          isLast={data.map_index === 2}
        />
      )}

      {/* ─── Summary ─── */}
      {data.step === 'summary' && (
        <SummaryPanel
          data={data}
          readonly={readonly}
          onDifferent={(v) => patch({ different_enough: v })}
          onRedoMap={(index) => {
            updateMap(index, (m) => ({
              ...m,
              picked: [],
              role: emptyMindmapRole(),
              skipped: false,
            }))
            patch({ step: 'pick', map_index: index as 0 | 1 | 2 })
          }}
          onOpenOdyssey={onOpenOdyssey}
        />
      )}
    </ExerciseChrome>
  )
}

function SourcesPanel({
  candidates,
  sources,
  setSource,
  allSame,
  ready,
  onStart,
  readonly,
}: {
  candidates: {
    byEng: { label: string; eng: number; entry_ref: string }[]
    byEne: { label: string; ene: number; entry_ref: string }[]
    byFlow: { label: string; entry_ref: string }[]
  }
  sources: MindmapData['sources']
  setSource: (key: MindmapMapKey, pick: MindmapSourcePick) => void
  allSame: boolean
  ready: boolean
  onStart: () => void
  readonly: boolean
}) {
  return (
    <div className="space-y-6">
      <p className="text-[15px] text-[#1C1B1A]">
        마인드맵 세 개를 만들 거야. 각각 출발점이 달라.
      </p>
      <SourceGroup
        title="① 몰입됐던 것"
        subtitle="굿타임 저널에서 제일 빠져들었던 활동"
        items={candidates.byEng.map((c) => ({
          label: c.label,
          meta: `몰입 ${c.eng >= 0 ? '+' : ''}${c.eng.toFixed(0)}`,
          entry_ref: c.entry_ref,
        }))}
        value={sources.engagement}
        onChange={(p) => setSource('engagement', p)}
        readonly={readonly}
      />
      <SourceGroup
        title="② 기운을 줬던 것"
        subtitle="하고 나서 오히려 충전됐던 활동"
        items={candidates.byEne.map((c) => ({
          label: c.label,
          meta: `에너지 ${c.ene >= 0 ? '+' : ''}${c.ene.toFixed(0)}`,
          entry_ref: c.entry_ref,
        }))}
        value={sources.energy}
        onChange={(p) => setSource('energy', p)}
        readonly={readonly}
      />
      <SourceGroup
        title="③ flow에 들어갔던 것"
        subtitle="시간 가는 줄 몰랐던 경험"
        items={candidates.byFlow.map((c) => ({
          label: c.label,
          meta: '⚡',
          entry_ref: c.entry_ref,
        }))}
        value={sources.flow}
        onChange={(p) => setSource('flow', p)}
        readonly={readonly}
        allowEmptyList
      />
      {allSame && (
        <p className="text-[13px] text-[#8A847E]">
          셋 다 같아도 되는데, 다르면 나중에 더 재밌어져.
        </p>
      )}
      {!readonly && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!ready}
            onClick={onStart}
            className="h-12 rounded-full px-7 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            시작하기
          </button>
        </div>
      )}
    </div>
  )
}

function SourceGroup({
  title,
  subtitle,
  items,
  value,
  onChange,
  readonly,
  allowEmptyList,
}: {
  title: string
  subtitle: string
  items: { label: string; meta: string; entry_ref: string }[]
  value: MindmapSourcePick | null
  onChange: (p: MindmapSourcePick) => void
  readonly: boolean
  allowEmptyList?: boolean
}) {
  const [manual, setManual] = useState(
    value && !value.from_journal ? value.activity : '',
  )
  const isManual = value && !value.from_journal

  return (
    <div
      className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
      style={{ boxShadow: cardShadow }}
    >
      <h3 className="text-[15px] font-semibold text-[#1C1B1A]">{title}</h3>
      <p className="mt-0.5 text-[13px] text-[#8A847E]">{subtitle}</p>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => {
          const selected =
            value?.from_journal && value.activity === it.label
          return (
            <li key={it.label}>
              <button
                type="button"
                disabled={readonly}
                onClick={() =>
                  onChange({
                    activity: it.label,
                    from_journal: true,
                    entry_ref: it.entry_ref,
                  })
                }
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[14px]"
                style={
                  selected
                    ? { background: COMPASS.soft, color: COMPASS.ink }
                    : undefined
                }
              >
                <span>{selected ? '●' : '○'}</span>
                <span className="flex-1">{it.label}</span>
                <span className="text-[12px] text-[#8A847E]">{it.meta}</span>
              </button>
            </li>
          )
        })}
        {items.length === 0 && allowEmptyList && (
          <li className="px-3 text-[13px] text-[#B5AFA8]">
            표시된 flow가 없어. 직접 적어봐.
          </li>
        )}
        <li className="flex items-center gap-2 px-3 py-2">
          <span>{isManual ? '●' : '○'}</span>
          <span className="text-[14px]">직접 쓸래 →</span>
          <input
            disabled={readonly}
            value={manual}
            onChange={(e) => {
              setManual(e.target.value)
              onChange({
                activity: e.target.value,
                from_journal: false,
              })
            }}
            className="min-w-0 flex-1 rounded-lg border border-[#ECE7E2] px-2 py-1 text-[14px]"
            placeholder="활동 이름"
          />
        </li>
      </ul>
    </div>
  )
}

function RolePanel({
  map,
  readonly,
  onChangeRole,
  onNext,
  isLast,
}: {
  map: MindmapMapState
  readonly: boolean
  onChangeRole: (role: MindmapMapState['role']) => void
  onNext: () => void
  isLast: boolean
}) {
  const chips = map.picked.map(
    (id) => map.nodes.find((n) => n.id === id)?.label ?? '',
  )
  const canNext =
    map.role.description.trim().length > 0 && map.role.name.trim().length > 0

  return (
    <div
      className="mx-auto max-w-xl rounded-[22px] border border-[#ECE7E2] bg-white p-6"
      style={{ boxShadow: cardShadow }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[14px] font-semibold text-[#1C1B1A]">
        {chips.map((c, i) => (
          <span key={c + i} className="flex items-center gap-2">
            {i > 0 && <span className="text-[#B5AFA8]">+</span>}
            <span
              className="rounded-full px-3 py-1"
              style={{ background: COMPASS.soft }}
            >
              {c}
            </span>
          </span>
        ))}
      </div>
      <p className="text-[15px] text-[#1C1B1A]">
        이 셋을 합쳐서, 하는 일 하나를 만들어봐.
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-[#1C1B1A]">
        두 가지만 맞으면 돼:
        <br />· 너한테 재밌고 흥미로울 것
        <br />· 다른 누군가한테 도움이 될 것
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-[#8A847E]">
        현실적일 필요 없어. 실제로 있는 직업일 필요도 없고, 누가 돈 줄 만한
        일일 필요도 전혀 없어.
      </p>

      <label className="mt-5 block text-[13px] font-semibold text-[#8A847E]">
        이 사람은 뭘 해?
      </label>
      <textarea
        disabled={readonly}
        value={map.role.description}
        onChange={(e) =>
          onChangeRole({ ...map.role, description: e.target.value })
        }
        placeholder="이 사람은 ___를 위해 ___를 한다"
        className="mt-1 min-h-[120px] w-full resize-none rounded-2xl border border-[#ECE7E2] px-4 py-3 text-[15px] leading-relaxed"
      />

      <label className="mt-4 block text-[13px] font-semibold text-[#8A847E]">
        이 역할 이름을 붙이면?
      </label>
      <input
        disabled={readonly}
        value={map.role.name}
        onChange={(e) => onChangeRole({ ...map.role, name: e.target.value })}
        placeholder='예: "리듬 정리사"'
        className="mt-1 w-full rounded-xl border border-[#ECE7E2] px-3 py-2.5 text-[15px]"
      />

      <p className="mt-5 text-[13px] font-semibold text-[#8A847E]">냅킨 스케치</p>
      <NapkinSketch
        url={map.role.sketch_url}
        kind={map.role.sketch_kind}
        readonly={readonly}
        onChange={(sketch_url, sketch_kind) =>
          onChangeRole({ ...map.role, sketch_url, sketch_kind })
        }
      />
      <p className="mt-2 text-[12px] text-[#B5AFA8]">
        졸라맨이어도 됨. 알아볼 수만 있으면 돼.
      </p>

      {!readonly && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-[12px] text-[#B5AFA8]"
            onClick={() =>
              onChangeRole({ ...map.role, sketch_url: '', sketch_kind: '' })
            }
          >
            나중에 그릴래
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={onNext}
            className="h-11 rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: COMPASS.accent }}
          >
            {isLast ? '정리로 →' : '다음 맵으로 →'}
          </button>
        </div>
      )}
    </div>
  )
}

function SummaryPanel({
  data,
  readonly,
  onDifferent,
  onRedoMap,
  onOpenOdyssey,
}: {
  data: MindmapData
  readonly: boolean
  onDifferent: (v: boolean) => void
  onRedoMap: (index: number) => void
  onOpenOdyssey?: () => void
}) {
  return (
    <div>
      <h2 className="mb-4 text-[20px] font-bold text-[#1C1B1A]">세 가지 삶</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {data.maps.map((m) => (
          <div
            key={m.key}
            className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
            style={{ boxShadow: cardShadow }}
          >
            {m.role.sketch_url ? (
              <img
                src={m.role.sketch_url}
                alt=""
                className="mb-3 h-28 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-[#FAF8F6] text-[12px] text-[#B5AFA8]">
                {m.skipped ? '건너뜀' : '스케치 없음'}
              </div>
            )}
            <p className="text-[16px] font-bold text-[#1C1B1A]">
              {m.role.name || (m.skipped ? '—' : '이름 없음')}
            </p>
            <p className="mt-1 text-[12px] text-[#8A847E]">
              {MINDMAP_MAP_LABELS[m.key]}에서 나옴
            </p>
            <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-[#1C1B1A]">
              {m.role.description || '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <p className="text-[15px] font-semibold text-[#1C1B1A]">
          세 개가 서로 많이 달라?
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="radio"
              name="diff"
              disabled={readonly}
              checked={data.different_enough === true}
              onChange={() => onDifferent(true)}
            />
            응, 꽤 달라
          </label>
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="radio"
              name="diff"
              disabled={readonly}
              checked={data.different_enough === false}
              onChange={() => onDifferent(false)}
            />
            비슷한 것 같아
          </label>
        </div>
        {data.different_enough === false && !readonly && (
          <div className="mt-4 rounded-xl bg-[#FAF8F6] px-4 py-3 text-[14px] text-[#8A847E]">
            <p>
              같은 데서 계속 맴돌고 있을 수도 있어. 하나만 다시 해볼래? 다른
              맵의 바깥 링에서 아예 다른 3개를 골라봐.
            </p>
            <button
              type="button"
              className="mt-2 text-[13px] font-semibold"
              style={{ color: COMPASS.accent }}
              onClick={() => onRedoMap(1)}
            >
              맵 2 다시 뽑기
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 text-[13px] text-[#8A847E]">
        이 셋이 다음 연습(오디세이 플랜)의 재료가 돼.
      </p>
      {onOpenOdyssey && (
        <button
          type="button"
          className="mt-2 text-[13px] font-semibold"
          style={{ color: COMPASS.accent }}
          onClick={onOpenOdyssey}
        >
          오디세이 플랜 하러 가기
        </button>
      )}
    </div>
  )
}
