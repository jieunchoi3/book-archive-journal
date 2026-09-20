import { useCallback, useRef, useState } from 'react'
import type { RoomPerson, RoomPlacementPayload } from '../types/room'
import { RoomPersonFigure } from './RoomPersonFigure'

const WORLD_W = 3200
const WORLD_H = 2400

interface RoomWorldProps {
  people: RoomPerson[]
  placements: Map<string, RoomPlacementPayload>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (personId: string, placement: RoomPlacementPayload) => void
  asOfLabel: string
  isToday: boolean
}

export function RoomWorld({
  people,
  placements,
  selectedId,
  onSelect,
  onMove,
  asOfLabel,
  isToday,
}: RoomWorldProps) {
  const [transform, setTransform] = useState({ scale: 0.38, x: 24, y: 8 })
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
  const dragPreviewRef = useRef(dragPreview)
  dragPreviewRef.current = dragPreview

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setTransform((t) => ({
      ...t,
      scale: Math.min(1.25, Math.max(0.18, t.scale - e.deltaY * 0.0008)),
    }))
  }, [])

  const pointerDownPan = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return
    dragRef.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      originX: transform.x,
      originY: transform.y,
    }
    onSelect(null)
  }

  const personDown = (personId: string, e: React.PointerEvent) => {
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
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
      const dx = (e.clientX - d.startX) / transform.scale / WORLD_W
      const dy = (e.clientY - d.startY) / transform.scale / WORLD_H
      const nx = Math.min(0.94, Math.max(0.06, d.placement.x + dx))
      const ny = Math.min(0.88, Math.max(0.22, d.placement.y + dy))
      setDragPreview({
        personId: d.personId,
        placement: { x: nx, y: ny, zone: ny > 0.82 ? 'door' : 'middle' },
      })
    }
  }

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
      className="relative h-[calc(100vh-8rem-env(safe-area-inset-bottom,0px))] min-h-[420px] w-full overflow-hidden rounded-none sm:rounded-3xl"
      onWheel={onWheel}
      onPointerDown={pointerDownPan}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerLeave={pointerUp}
    >
      <div
        className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/25 px-3 py-1 text-[11px] text-white/90 backdrop-blur-sm"
      >
        {isToday ? 'Today' : asOfLabel}
      </div>

      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: WORLD_W,
          height: WORLD_H,
        }}
      >
        {/* Floor */}
        <div
          className="absolute inset-[80px] rounded-[12px]"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 45%, #F3EBE0 0%, #E8DDD0 55%, #D9CFC2 100%)',
            boxShadow: 'inset 0 0 120px rgba(80,60,40,0.12)',
          }}
        />
        {/* Walls */}
        <div className="absolute left-[80px] right-[80px] top-[80px] h-3 rounded-t-lg bg-gradient-to-b from-[#C4B5A5] to-[#B8A896]" />
        <div className="absolute bottom-[80px] left-[80px] right-[80px] h-3 rounded-b-lg bg-[#A89888]/80" />
        <div className="absolute bottom-[80px] left-[80px] top-[80px] w-3 rounded-l-lg bg-[#B8A896]/70" />
        <div className="absolute bottom-[80px] right-[80px] top-[80px] w-3 rounded-r-lg bg-[#B8A896]/70" />

        {/* You — center of the room */}
        <div
          className="pointer-events-none absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2"
          style={{ width: 120, height: 120 }}
        >
          <div className="mx-auto h-16 w-16 rounded-full bg-[#007AFF]/15 ring-2 ring-[#007AFF]/40" />
          <p className="mt-2 text-center text-[12px] font-medium text-[#636366]/80">You</p>
        </div>

        {/* Door */}
        <div className="pointer-events-none absolute bottom-[100px] left-1/2 w-48 -translate-x-1/2">
          <div className="h-28 rounded-t-xl border-2 border-[#6B5344]/40 bg-gradient-to-b from-[#8B7355]/30 to-[#6B5344]/20" />
          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-[#6B5344]/70">Door</p>
        </div>

        {people.map((person) => {
          const preview = dragPreview?.personId === person.id ? dragPreview.placement : null
          const placement = preview ?? placements.get(person.id)
          if (!placement) return null
          const left = placement.x * WORLD_W
          const top = placement.y * WORLD_H
          return (
            <div
              key={person.id}
              role="button"
              tabIndex={0}
              className="absolute touch-none"
              style={{ left: left - 28, top: top - 72, width: 56 }}
              onPointerDown={(e) => personDown(person.id, e)}
            >
              <RoomPersonFigure
                name={person.name}
                placement={placement}
                selected={selectedId === person.id}
              />
            </div>
          )
        })}
      </div>

      <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/50 mix-blend-difference">
        Scroll to zoom · drag floor to pan · drag people to place them
      </p>
    </div>
  )
}
