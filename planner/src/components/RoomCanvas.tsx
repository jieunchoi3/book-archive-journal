import { useCallback, useRef, useState } from 'react'
import type { RoomPerson, RoomPlacementPayload } from '../types/room'
import { zoneLabel } from '../lib/roomReconstruct'

const CANVAS_W = 2400
const CANVAS_H = 1800

interface RoomCanvasProps {
  people: RoomPerson[]
  placements: Map<string, RoomPlacementPayload>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (personId: string, placement: RoomPlacementPayload) => void
}

export function RoomCanvas({
  people,
  placements,
  selectedId,
  onSelect,
  onMove,
}: RoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ scale: 0.42, x: 40, y: 20 })
  const [dragPreview, setDragPreview] = useState<{
    personId: string
    placement: RoomPlacementPayload
  } | null>(null)

  const dragRef = useRef<{
    mode: 'pan' | 'person'
    personId?: string
    startX: number
    startY: number
    originX: number
    originY: number
    placement?: RoomPlacementPayload
  } | null>(null)

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setTransform((t) => ({
      ...t,
      scale: Math.min(1.4, Math.max(0.2, t.scale - e.deltaY * 0.001)),
    }))
  }, [])

  const pointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) {
      dragRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        originX: transform.x,
        originY: transform.y,
      }
      onSelect(null)
    }
  }

  const personPointerDown = (personId: string, e: React.PointerEvent) => {
    e.stopPropagation()
    const placement = placements.get(personId)
    if (!placement) return
    dragRef.current = {
      mode: 'person',
      personId,
      startX: e.clientX,
      startY: e.clientY,
      originX: 0,
      originY: 0,
      placement: { ...placement },
    }
    onSelect(personId)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const pointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    if (d.mode === 'pan') {
      setTransform((t) => ({
        ...t,
        x: d.originX + (e.clientX - d.startX),
        y: d.originY + (e.clientY - d.startY),
      }))
      return
    }
    if (d.mode === 'person' && d.personId && d.placement) {
      const dx = (e.clientX - d.startX) / transform.scale / CANVAS_W
      const dy = (e.clientY - d.startY) / transform.scale / CANVAS_H
      const nx = Math.min(0.92, Math.max(0.08, d.placement.x + dx))
      const ny = Math.min(0.92, Math.max(0.12, d.placement.y + dy))
      const zone = inferZone(nx, ny)
      const next = { ...d.placement, x: nx, y: ny, zone }
      setDragPreview({ personId: d.personId, placement: next })
    }
  }

  const dragPreviewRef = useRef(dragPreview)
  dragPreviewRef.current = dragPreview

  const pointerUp = () => {
    const d = dragRef.current
    const preview = dragPreviewRef.current
    if (d?.mode === 'person' && d.personId && preview?.personId === d.personId) {
      onMove(d.personId, preview.placement)
    }
    dragRef.current = null
    setDragPreview(null)
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[min(62vh,520px)] w-full overflow-hidden rounded-3xl bg-[#EDE6DC] ring-1 ring-hairline"
      onWheel={onWheel}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerLeave={pointerUp}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: CANVAS_W,
          height: CANVAS_H,
        }}
      >
        <div
          className="absolute inset-[120px] rounded-[48px] border-2 border-[#C4B5A5]/60 bg-gradient-to-b from-[#F7F2EA] to-[#EBE2D6] shadow-inner"
          style={{ boxShadow: 'inset 0 0 80px rgba(139,105,20,0.08)' }}
        />
        <div className="absolute bottom-[80px] left-1/2 h-24 w-40 -translate-x-1/2 rounded-t-2xl border-2 border-[#8B6914]/30 bg-[#D4C4B0]/50">
          <p className="pt-2 text-center text-[11px] font-medium uppercase tracking-widest text-[#8B6914]/70">
            Door
          </p>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#C7A882]/40" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#C7A882]/25" />

        {people.map((person) => {
          const preview = dragPreview?.personId === person.id ? dragPreview.placement : null
          const placement = preview ?? placements.get(person.id)
          if (!placement) return null
          const left = placement.x * CANVAS_W
          const top = placement.y * CANVAS_H
          const selected = selectedId === person.id
          const faded = !placement.isActiveInRoom || placement.zone === 'archive'
          return (
            <button
              key={person.id}
              type="button"
              className={`absolute flex flex-col items-center gap-1 transition-opacity ${faded ? 'opacity-45' : 'opacity-100'}`}
              style={{
                left: left - 36,
                top: top - 36,
                width: 72,
              }}
              onPointerDown={(e) => personPointerDown(person.id, e)}
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full text-[15px] font-semibold shadow-md ring-2 ${
                  selected ? 'ring-[#007AFF] bg-[#007AFF]/15 text-[#007AFF]' : 'ring-white bg-white text-[#636366]'
                }`}
              >
                {initials(person.name)}
              </span>
              <span className="max-w-[88px] truncate text-center text-[11px] font-medium text-[#3C3C43]">
                {person.name}
              </span>
            </button>
          )
        })}
      </div>
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-[#8E8E93]">
        Pinch or scroll to zoom · drag floor to pan · drag people to move
      </p>
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function inferZone(x: number, y: number): RoomPlacementPayload['zone'] {
  const dx = x - 0.5
  const dy = y - 0.48
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (y > 0.78) return 'door'
  if (dist < 0.12) return 'inner'
  if (dist < 0.22) return 'middle'
  return 'edge'
}

export function placementSummary(p: RoomPlacementPayload): string {
  return zoneLabel(p.zone)
}
