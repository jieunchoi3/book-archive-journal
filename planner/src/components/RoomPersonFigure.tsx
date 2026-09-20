import type { RoomPlacementPayload } from '../types/room'

interface RoomPersonFigureProps {
  name: string
  placement: RoomPlacementPayload
  selected: boolean
  scale?: number
}

function hueFromName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 360
  return h
}

export function RoomPersonFigure({ name, selected, scale = 1 }: RoomPersonFigureProps) {
  const hue = hueFromName(name)
  const first = name.trim().split(/\s+/)[0]?.slice(0, 1) ?? '?'

  return (
    <div
      className="flex flex-col items-center"
      style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}
    >
      <svg
        width="56"
        height="72"
        viewBox="0 0 56 72"
        className={`drop-shadow-md ${selected ? 'animate-[gentle-bob_2.5s_ease-in-out_infinite]' : ''}`}
        aria-hidden
      >
        <ellipse cx="28" cy="14" rx="11" ry="12" fill={`hsl(${hue} 35% 88%)`} stroke={`hsl(${hue} 25% 55%)`} strokeWidth="1.2" />
        <text x="28" y="18" textAnchor="middle" fontSize="11" fontWeight="600" fill={`hsl(${hue} 30% 35%)`}>
          {first.toUpperCase()}
        </text>
        <path
          d="M14 72 Q14 38 28 34 Q42 38 42 72"
          fill={`hsl(${hue} 40% 82%)`}
          stroke={`hsl(${hue} 25% 55%)`}
          strokeWidth="1.2"
        />
        <ellipse cx="28" cy="36" rx="9" ry="5" fill={`hsl(${hue} 40% 78%)`} />
      </svg>
      <span
        className={`mt-0.5 max-w-[5.5rem] truncate text-center text-[10px] font-medium leading-tight ${
          selected ? 'text-[#007AFF]' : 'text-[#3C3C43]/90'
        }`}
      >
        {name.split(/\s+/)[0]}
      </span>
    </div>
  )
}
