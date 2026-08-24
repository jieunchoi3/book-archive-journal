import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  COMPASS,
  emptyMindmapData,
  newId,
  type MindmapData,
  type MindmapNode,
  type MindmapRoleIdea,
} from '../types/compass'
import type { CompassActions } from '../hooks/useCompass'
import {
  ExerciseChrome,
  useDebouncedDraftSave,
  useExerciseSnapshot,
  cardShadow,
} from './CompassExerciseShell'

interface CompassMindmapProps {
  compass: CompassActions
  snapshotId?: string
  onNavigateSnapshot: (id: string | undefined) => void
  onCompare?: (ids: [string, string]) => void
  onRequestSnapshotAi?: (snapshotId: string) => void
  onSendToOdyssey?: (idea: MindmapRoleIdea) => void
}

function MindNode({
  data,
}: NodeProps<
  Node<{
    label: string
    ring: number
    combine: boolean
    selected: boolean
    onAdd: () => void
    onLabel: (v: string) => void
    onSelect: () => void
  }>
>) {
  return (
    <div
      className="relative rounded-xl border px-3 py-2 text-[12px] font-medium shadow-sm"
      style={{
        borderColor: data.selected ? COMPASS.accent : '#ECE7E2',
        background: data.selected ? COMPASS.soft : '#fff',
        minWidth: 88,
      }}
      onClick={(e) => {
        if (data.combine) {
          e.stopPropagation()
          data.onSelect()
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        const next = window.prompt('라벨', data.label)
        if (next != null) data.onLabel(next)
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#A9C3B8]" />
      {data.label || '이름'}
      {data.ring < 2 && !data.combine && (
        <button
          type="button"
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white opacity-0 group-hover:opacity-100 hover:opacity-100"
          style={{ background: COMPASS.accent }}
          onClick={(e) => {
            e.stopPropagation()
            data.onAdd()
          }}
        >
          +
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[#A9C3B8]" />
    </div>
  )
}

const nodeTypes = { mind: MindNode }

export function CompassMindmap({
  compass,
  snapshotId,
  onNavigateSnapshot,
  onCompare,
  onRequestSnapshotAi,
  onSendToOdyssey,
}: CompassMindmapProps) {
  const { all, active, ensureDraft, readonly } = useExerciseSnapshot(
    compass,
    'mindmap',
    snapshotId,
    onNavigateSnapshot,
  )
  const [data, setData] = useState<MindmapData>(emptyMindmapData())
  const [lockedMsg, setLockedMsg] = useState(false)
  const [combine, setCombine] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [ideaDraft, setIdeaDraft] = useState<MindmapRoleIdea | null>(null)

  useEffect(() => {
    if (!active) {
      setData(emptyMindmapData())
      return
    }
    let d = compass.getDraftData(active, emptyMindmapData())
    if (d.nodes.length === 0 && active.status === 'draft') {
      const flowTop = [...compass.journalEntries]
        .filter((e) => e.isFlow)
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 3)
      if (flowTop.length === 0) {
        const byEng = [...compass.journalEntries]
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 3)
        flowTop.push(...byEng)
      }
      const uniq = [...new Map(flowTop.map((e) => [e.activity.toLowerCase(), e])).values()].slice(
        0,
        3,
      )
      if (uniq.length) {
        d = {
          ...d,
          nodes: uniq.map((e, i) => ({
            id: newId(),
            parentId: null,
            label: e.activity,
            x: 400 + i * 280,
            y: 120,
            ring: 0 as const,
          })),
        }
      }
    }
    setData(d)
    setLockedMsg(false)
  }, [active, compass])

  const save = useCallback(
    async (id: string, next: MindmapData) => {
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

  const addChild = (parentId: string) => {
    if (readonly) {
      setLockedMsg(true)
      return
    }
    const parent = data.nodes.find((n) => n.id === parentId)
    if (!parent) return
    const ring = (parent.ring + 1) as 0 | 1 | 2
    if (ring > 2) return
    const child: MindmapNode = {
      id: newId(),
      parentId,
      label: '',
      x: parent.x + 40,
      y: parent.y + 100,
      ring,
    }
    setData((d) => ({ ...d, nodes: [...d.nodes, child] }))
  }

  const flowNodes: Node[] = useMemo(
    () =>
      data.nodes.map((n) => ({
        id: n.id,
        type: 'mind',
        position: { x: n.x, y: n.y },
        data: {
          label: n.label,
          ring: n.ring,
          combine,
          selected: selected.includes(n.id),
          onAdd: () => addChild(n.id),
          onLabel: (v: string) => {
            if (readonly) {
              setLockedMsg(true)
              return
            }
            setData((d) => ({
              ...d,
              nodes: d.nodes.map((x) => (x.id === n.id ? { ...x, label: v } : x)),
            }))
          },
          onSelect: () => {
            setSelected((prev) => {
              if (prev.includes(n.id)) return prev.filter((x) => x !== n.id)
              if (prev.length >= 3) return [...prev.slice(1), n.id]
              return [...prev, n.id]
            })
          },
        },
        className: 'group',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.nodes, combine, selected, readonly],
  )

  const edges = useMemo(
    () =>
      data.nodes
        .filter((n) => n.parentId)
        .map((n) => ({
          id: `${n.parentId}-${n.id}`,
          source: n.parentId!,
          target: n.id,
          style: { stroke: COMPASS.line },
        })),
    [data.nodes],
  )

  const makeRoleIdea = () => {
    const words = selected
      .map((id) => data.nodes.find((n) => n.id === id)?.label)
      .filter(Boolean) as string[]
    if (words.length < 2) return
    setIdeaDraft({
      id: newId(),
      words,
      title: '',
      daySketch: '',
    })
  }

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
      help="관심사를 가지로 펼치고, 조합해 역할 아이디어를 만들어요. 3링까지."
      lockedMsg={lockedMsg}
      onComplete={() => active && void compass.completeSnapshot(active.id)}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setCombine((v) => !v)
            setSelected([])
          }}
          className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
          style={
            combine
              ? { background: COMPASS.accent, color: '#fff' }
              : { background: '#FAF8F6', color: '#8A847E' }
          }
        >
          조합 모드 {combine ? '켜짐' : '꺼짐'}
        </button>
        {!readonly && data.nodes.length === 0 && (
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
            onClick={() => {
              const label = window.prompt('중심 관심사')
              if (!label?.trim()) return
              setData((d) => ({
                ...d,
                nodes: [
                  {
                    id: newId(),
                    parentId: null,
                    label: label.trim(),
                    x: 700,
                    y: 200,
                    ring: 0,
                  },
                ],
              }))
            }}
          >
            중심 노드 추가
          </button>
        )}
        {combine && selected.length >= 2 && (
          <button
            type="button"
            onClick={makeRoleIdea}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
            style={{ background: COMPASS.accent }}
          >
            역할 아이디어 만들기
          </button>
        )}
      </div>

      <div
        className="overflow-auto rounded-[18px] border border-[#ECE7E2] bg-[#FAF8F6]"
        style={{ boxShadow: cardShadow }}
      >
        <div style={{ width: 1600, height: 1000 }}>
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.4}
            maxZoom={1.5}
            nodesDraggable={!readonly && !combine}
            nodesConnectable={false}
            onNodeDragStop={(_e, node) => {
              if (readonly) return
              setData((d) => ({
                ...d,
                nodes: d.nodes.map((n) =>
                  n.id === node.id
                    ? { ...n, x: node.position.x, y: node.position.y }
                    : n,
                ),
              }))
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} color="#ECE7E2" />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {data.roleIdeas.length > 0 && (
        <ul className="mt-4 space-y-2">
          {data.roleIdeas.map((r) => (
            <li
              key={r.id}
              className="rounded-[18px] border border-[#ECE7E2] bg-white p-4"
              style={{ boxShadow: cardShadow }}
            >
              <p className="text-[12px] text-[#8A847E]">
                {r.words.map((w) => `[${w}]`).join(' + ')}
              </p>
              <p className="mt-1 text-[15px] font-semibold">{r.title || '제목 없음'}</p>
              <p className="mt-1 text-[13px] text-[#5A5550]">{r.daySketch}</p>
              {onSendToOdyssey && (
                <button
                  type="button"
                  className="mt-3 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{ background: COMPASS.accent }}
                  onClick={() => onSendToOdyssey(r)}
                >
                  오디세이 플랜에 담기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {ideaDraft && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 p-4 sm:items-center">
          <div
            className="w-full max-w-md rounded-[18px] bg-white p-5"
            style={{ boxShadow: cardShadow }}
          >
            <h3 className="text-[16px] font-semibold">역할 아이디어</h3>
            <p className="mt-1 text-[12px] text-[#8A847E]">
              {ideaDraft.words.map((w) => `[${w}]`).join(' + ')}
            </p>
            <input
              value={ideaDraft.title}
              onChange={(e) =>
                setIdeaDraft((d) => (d ? { ...d, title: e.target.value } : d))
              }
              placeholder="제목"
              className="mt-3 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[14px]"
            />
            <textarea
              value={ideaDraft.daySketch}
              onChange={(e) =>
                setIdeaDraft((d) => (d ? { ...d, daySketch: e.target.value } : d))
              }
              placeholder="이건 어떤 하루일까"
              rows={3}
              className="mt-2 w-full rounded-xl border border-[#ECE7E2] bg-[#FAF8F6] px-3 py-2 text-[13px]"
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setIdeaDraft(null)}>
                취소
              </button>
              {onSendToOdyssey && (
                <button
                  type="button"
                  className="rounded-full border border-[#ECE7E2] px-4 py-2 text-[13px] font-semibold"
                  style={{ color: COMPASS.accent }}
                  onClick={() => {
                    setData((d) => ({
                      ...d,
                      roleIdeas: [...d.roleIdeas, ideaDraft],
                    }))
                    onSendToOdyssey(ideaDraft)
                    setIdeaDraft(null)
                    setSelected([])
                  }}
                >
                  오디세이 플랜에 담기
                </button>
              )}
              <button
                type="button"
                className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
                style={{ background: COMPASS.accent }}
                onClick={() => {
                  setData((d) => ({
                    ...d,
                    roleIdeas: [...d.roleIdeas, ideaDraft],
                  }))
                  setIdeaDraft(null)
                  setSelected([])
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </ExerciseChrome>
  )
}
