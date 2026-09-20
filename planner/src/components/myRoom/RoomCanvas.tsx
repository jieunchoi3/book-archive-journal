import { useCallback, useEffect, useRef, useState } from 'react'
import type { MyRoomPerson } from '../../types/myRoom'
import { RoomBackdrop } from './RoomBackdrop'
import { RoomCharacter } from './RoomCharacter'
import { DOOR_X, DOOR_Y, ROOM_H, ROOM_W, SELF_X, SELF_Y } from './roomConstants'
import { defaultCharacter } from '../../types/myRoom'

interface RoomCanvasProps {
  people: MyRoomPerson[]
  positions: Map<string, { x: number; y: number }>
  readOnly?: boolean
  onMovePerson?: (personId: string, x: number, y: number) => void
  onSelectPerson?: (personId: string) => void
  enteringIds?: Set<string>
}

export function RoomCanvas({
  people,
  positions,
  readOnly = false,
  onMovePerson,
  onSelectPerson,
  enteringIds,
}: RoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.45)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const dragPerson = useRef<{
    id: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const [localPos, setLocalPos] = useState<Map<string, { x: number; y: number }>>(new Map())

  useEffect(() => {
    setLocalPos(new Map(positions))
  }, [positions])

  const fitRoom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const pad = 40
    const sx = (el.clientWidth - pad * 2) / ROOM_W
    const sy = (el.clientHeight - pad * 2) / ROOM_H
    const s = Math.min(sx, sy, 0.55)
    setScale(s)
    setPan({
      x: (el.clientWidth - ROOM_W * s) / 2,
      y: (el.clientHeight - ROOM_H * s) / 2,
    })
  }, [])

  useEffect(() => {
    fitRoom()
    const ro = new ResizeObserver(() => fitRoom())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [fitRoom])

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      setScale((prev) => {
        const next = Math.min(1.4, Math.max(0.15, prev * factor))
        const ratio = next / prev
        setPan((p) => ({
          x: mx - (mx - p.x) * ratio,
          y: my - (my - p.y) * ratio,
        }))
        return next
      })
    },
    [],
  )

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    zoomAt(e.clientX, e.clientY, factor)
  }

  const worldFromClient = (clientX: number, clientY: number) => {
    const el = containerRef.current!
    const rect = el.getBoundingClientRect()
    const mx = clientX - rect.left
    const my = clientY - rect.top
    return {
      x: (mx - pan.x) / scale,
      y: (my - pan.y) / scale,
    }
  }

  const onPointerDownBackground = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-person]')) return
    panStart.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragPerson.current && !readOnly) {
      const w = worldFromClient(e.clientX, e.clientY)
      const { id, offsetX, offsetY } = dragPerson.current
      const nx = w.x - offsetX
      const ny = w.y - offsetY
      setLocalPos((prev) => {
        const next = new Map(prev)
        next.set(id, { x: nx, y: ny })
        return next
      })
      return
    }
    if (panStart.current) {
      const dx = e.clientX - panStart.current.px
      const dy = e.clientY - panStart.current.py
      setPan({
        x: panStart.current.ox + dx,
        y: panStart.current.oy + dy,
      })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragPerson.current && !readOnly) {
      const w = worldFromClient(e.clientX, e.clientY)
      const { id, offsetX, offsetY } = dragPerson.current
      onMovePerson?.(id, w.x - offsetX, w.y - offsetY)
      dragPerson.current = null
    }
    panStart.current = null
  }

  const startDragPerson = (e: React.PointerEvent, personId: string) => {
    if (readOnly) return
    e.stopPropagation()
    const pos = localPos.get(personId) ?? positions.get(personId)
    if (!pos) return
    const w = worldFromClient(e.clientX, e.clientY)
    dragPerson.current = {
      id: personId,
      offsetX: w.x - pos.x,
      offsetY: w.y - pos.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const zoomIn = () => {
    const el = containerRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.15)
  }
  const zoomOut = () => {
    const el = containerRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, 0.87)
  }
  const resetCamera = () => {
    setScale(0.45)
    fitRoom()
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-[#1a1612]"
      onWheel={onWheel}
      onPointerDown={onPointerDownBackground}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="absolute right-3 top-16 z-30 flex flex-col gap-1">
        <button type="button" className="my-room-zoom-btn" onClick={zoomIn} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="my-room-zoom-btn" onClick={zoomOut} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="my-room-zoom-btn text-[10px]" onClick={fitRoom}>
          Fit
        </button>
        <button type="button" className="my-room-zoom-btn text-[10px]" onClick={resetCamera}>
          Reset
        </button>
      </div>
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          width: ROOM_W,
          height: ROOM_H,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
      >
        <RoomBackdrop />

        <div
          className="absolute z-10"
          style={{ left: SELF_X - 36, top: SELF_Y - 55 }}
        >
          <RoomCharacter appearance={defaultCharacter()} isSelf scale={1.1} />
        </div>

        {people.map((p) => {
          const pos = localPos.get(p.id) ?? positions.get(p.id)
          if (!pos) return null
          const entering = enteringIds?.has(p.id)
          const displayX = pos.x
          const displayY = pos.y
          return (
            <button
              key={p.id}
              type="button"
              data-person
              className={`group absolute z-20 cursor-grab active:cursor-grabbing ${
                entering ? 'animate-room-enter' : ''
              }`}
              style={{
                left: displayX - 36,
                top: displayY - 55,
                ...(entering
                  ? {
                      ['--enter-from-x' as string]: `${DOOR_X - 80 - (displayX - 36)}px`,
                      ['--enter-from-y' as string]: `${DOOR_Y - 55 - (displayY - 55)}px`,
                    }
                  : {}),
              }}
              onPointerDown={(e) => startDragPerson(e, p.id)}
              onClick={(e) => {
                if (dragPerson.current) return
                e.stopPropagation()
                onSelectPerson?.(p.id)
              }}
            >
              <RoomCharacter appearance={p.character} label={p.name} scale={1} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface RoomCameraControls {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  reset: () => void
}
