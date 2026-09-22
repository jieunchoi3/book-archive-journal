import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Globe, Minus, Plus, BookOpen } from 'lucide-react'
import type { RelationPerson } from '../../types/relationTracker'
import { DEFAULT_AVATAR } from '../../types/relationTracker'
import { MiiAvatar } from './MiiAvatar'

const ME_AVATAR = {
  ...DEFAULT_AVATAR,
  outfitColor: 0,
  hairStyle: 1,
  hairColor: 1,
}
import { AnchoredProfileCard } from './AnchoredProfileCard'

interface RoomCanvasProps {
  people: RelationPerson[]
  zoom: number
  onZoomChange: (z: number) => void
  onOpenWorld: () => void
  onInvite: () => void
  onEditPerson: (id: string) => void
  onDeletePerson: (id: string) => void
  onMovePerson: (id: string, roomX: number, roomY: number) => void
}

const CENTER = { x: 0.5, y: 0.5 }
const MIN_DIST_FROM_ME = 0.12
const PAD = 0.06

function defaultPosition(person: RelationPerson, index: number, total: number) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
  const r = 0.32
  return {
    x: person.roomX ?? CENTER.x + Math.cos(angle) * r,
    y: person.roomY ?? CENTER.y + Math.sin(angle) * r * 0.85,
  }
}

function clampPosition(x: number, y: number) {
  let nx = Math.min(1 - PAD, Math.max(PAD, x))
  let ny = Math.min(1 - PAD, Math.max(PAD, y))
  const dx = nx - CENTER.x
  const dy = ny - CENTER.y
  const dist = Math.hypot(dx, dy)
  if (dist < MIN_DIST_FROM_ME && dist > 0) {
    const s = MIN_DIST_FROM_ME / dist
    nx = CENTER.x + dx * s
    ny = CENTER.y + dy * s
  }
  return { x: nx, y: ny }
}

export function RoomCanvas({
  people,
  zoom,
  onZoomChange,
  onOpenWorld,
  onInvite,
  onEditPerson,
  onDeletePerson,
  onMovePerson,
}: RoomCanvasProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const anchorRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ id: string; x: number; y: number } | null>(
    null,
  )
  const dragMovedRef = useRef(false)
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null)
  const selected = people.find((p) => p.id === selectedId)

  useEffect(() => {
    if (!selectedId || draggingId) {
      setProfileAnchor(null)
      return
    }
    setProfileAnchor(anchorRefs.current.get(selectedId) ?? null)
  }, [selectedId, draggingId, people, dragOffset, zoom])

  const positions = useMemo(() => {
    return people.map((p, i) => ({
      id: p.id,
      ...defaultPosition(p, i, people.length),
    }))
  }, [people])

  const posById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const p of positions) m.set(p.id, { x: p.x, y: p.y })
    return m
  }, [positions])

  const clientToNormalized = useCallback((clientX: number, clientY: number) => {
    const board = boardRef.current
    if (!board) return null
    const rect = board.getBoundingClientRect()
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height
    return clampPosition(x, y)
  }, [])

  const startDrag = (personId: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragMovedRef.current = false
    setDraggingId(personId)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onDragMove = (e: React.PointerEvent) => {
    if (!draggingId) return
    dragMovedRef.current = true
    const next = clientToNormalized(e.clientX, e.clientY)
    if (!next) return
    setDragOffset({ id: draggingId, x: next.x, y: next.y })
  }

  const endDrag = (personId: string, e: React.PointerEvent) => {
    if (draggingId !== personId) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    const next =
      dragOffset?.id === personId
        ? { x: dragOffset.x, y: dragOffset.y }
        : posById.get(personId)
    if (next && dragMovedRef.current) {
      onMovePerson(personId, next.x, next.y)
      setSelectedId(null)
    } else if (!dragMovedRef.current) {
      setSelectedId((cur) => (cur === personId ? null : personId))
    }
    setDraggingId(null)
    setDragOffset(null)
  }

  return (
    <div
      className="relative flex min-h-[calc(100dvh-8rem)] flex-1 flex-col overflow-hidden bg-[#ececec]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 50%, #f5f5f5 0%, #e8e8e8 100%)',
      }}
    >
      <button
        type="button"
        onClick={onOpenWorld}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white"
        aria-label="World map"
      >
        <Globe size={20} className="text-[#48484A]" />
      </button>

      <p className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 text-center text-[11px] text-muted">
        Drag people closer or further from you
      </p>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4 pb-24">
        <div
          ref={boardRef}
          className="relative aspect-square w-full max-w-[min(520px,92vw)] touch-none transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          {[0.28, 0.42, 0.56].map((size) => (
            <div
              key={size}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#d1d1d6]/80"
              style={{ width: `${size * 100}%`, height: `${size * 100}%` }}
            />
          ))}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-[42%]">
            <MiiAvatar avatar={ME_AVATAR} size={88} label="Me" />
          </div>

          {people.map((person) => {
            const stored = posById.get(person.id)!
            const live =
              dragOffset?.id === person.id
                ? { x: dragOffset.x, y: dragOffset.y }
                : stored
            const isSelected = selectedId === person.id
            const isDragging = draggingId === person.id
            return (
              <div
                key={person.id}
                ref={(el) => {
                  if (el) anchorRefs.current.set(person.id, el)
                  else anchorRefs.current.delete(person.id)
                }}
                className={`absolute z-[5] ${isDragging ? 'z-20 cursor-grabbing' : 'cursor-grab'}`}
                style={{
                  left: `${live.x * 100}%`,
                  top: `${live.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onPointerDown={(e) => startDrag(person.id, e)}
                onPointerMove={onDragMove}
                onPointerUp={(e) => endDrag(person.id, e)}
                onPointerCancel={(e) => endDrag(person.id, e)}
              >
                <div className={isDragging ? 'scale-105 opacity-95' : ''}>
                  <MiiAvatar
                    avatar={person.avatar}
                    size={64}
                    label={person.name}
                    selected={isSelected || isDragging}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && !draggingId && (
        <AnchoredProfileCard
          anchorEl={profileAnchor}
          person={selected}
          onEdit={() => onEditPerson(selected.id)}
          onDelete={() => {
            onDeletePerson(selected.id)
            setSelectedId(null)
          }}
        />
      )}

      {people.length > 0 && !selected && !draggingId && (
        <p className="pointer-events-none absolute left-1/2 top-[4.5rem] -translate-x-1/2 text-center text-[13px] text-[#FF3B30]">
          {people.length} {people.length === 1 ? 'person has' : 'people have'}{' '}
          entered your room
        </p>
      )}

      <div className="absolute bottom-20 left-4 z-20 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1.5 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={() => onZoomChange(zoom - 0.1)}
          className="rounded-full p-2 hover:bg-surface"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <span className="min-w-[3rem] text-center text-[12px] font-medium tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onZoomChange(zoom + 0.1)}
          className="rounded-full p-2 hover:bg-surface"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <div className="mx-1 h-5 w-px bg-hairline" />
        <button
          type="button"
          className="rounded-full p-2 hover:bg-surface"
          aria-label="Memories"
        >
          <BookOpen size={16} />
        </button>
      </div>

      <button
        type="button"
        onClick={onInvite}
        className="absolute bottom-20 right-4 z-20 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-medium shadow-md hover:bg-[#fafafa]"
      >
        <span className="text-lg leading-none">+</span>
        Invite new friend
      </button>
    </div>
  )
}
