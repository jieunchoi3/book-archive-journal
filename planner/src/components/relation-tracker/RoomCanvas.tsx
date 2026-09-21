import { useMemo, useRef, useState } from 'react'
import { Globe, Minus, Plus, BookOpen } from 'lucide-react'
import type { RelationPerson } from '../../types/relationTracker'
import { MiiAvatar } from './MiiAvatar'
import { PersonProfileCard } from './PersonProfileCard'

interface RoomCanvasProps {
  people: RelationPerson[]
  zoom: number
  onZoomChange: (z: number) => void
  onOpenWorld: () => void
  onInvite: () => void
  onEditPerson: (id: string) => void
}

export function RoomCanvas({
  people,
  zoom,
  onZoomChange,
  onOpenWorld,
  onInvite,
  onEditPerson,
}: RoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = people.find((p) => p.id === selectedId)

  const positions = useMemo(() => {
    return people.map((p, i) => {
      const angle = (i / Math.max(people.length, 1)) * Math.PI * 2 - Math.PI / 2
      const r = 0.32
      return {
        id: p.id,
        x: p.roomX ?? 0.5 + Math.cos(angle) * r,
        y: p.roomY ?? 0.5 + Math.sin(angle) * r * 0.85,
      }
    })
  }, [people])

  return (
    <div
      ref={containerRef}
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

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4 pb-24">
        <div
          className="relative aspect-square w-full max-w-[min(520px,92vw)] transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[#c7c7cc]"
          />
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-[42%]">
            <MiiAvatar
              avatar={{
                skinTone: 2,
                hairStyle: 1,
                hairColor: 1,
                eyeStyle: 0,
                mouthStyle: 1,
                outfitColor: 0,
                outfitStyle: 0,
              }}
              size={88}
              label="Me"
            />
          </div>

          {people.map((person) => {
            const pos = positions.find((x) => x.id === person.id)
            if (!pos) return null
            const isSelected = selectedId === person.id
            return (
              <div
                key={person.id}
                className="absolute z-[5]"
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className={`absolute left-1/2 top-1/2 -z-10 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#d1d1d6] ${
                    isSelected ? 'border-[#6B8F71]' : ''
                  }`}
                />
                {isSelected && (
                  <div className="absolute bottom-full left-1/2 z-30 mb-3 -translate-x-1/2">
                    <PersonProfileCard
                      person={person}
                      onEdit={() => onEditPerson(person.id)}
                    />
                  </div>
                )}
                <MiiAvatar
                  avatar={person.avatar}
                  size={64}
                  label={person.name}
                  selected={isSelected}
                  onClick={() =>
                    setSelectedId(isSelected ? null : person.id)
                  }
                />
              </div>
            )
          })}
        </div>
      </div>

      {people.length > 0 && !selected && (
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
