import type { CharacterAppearance } from '../../types/myRoom'
import {
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  type AccessoryId,
} from '../../types/myRoom'

interface RoomCharacterProps {
  appearance: CharacterAppearance
  scale?: number
  label?: string
  isSelf?: boolean
  className?: string
}

function Hair({ style, color }: { style: number; color: string }) {
  if (style === 1) {
    return (
      <path
        d="M -22 -38 Q -28 -58 0 -62 Q 28 -58 22 -38 L 20 -32 Q 0 -48 -20 -32 Z"
        fill={color}
      />
    )
  }
  if (style === 2) {
    return (
      <>
        <ellipse cx="0" cy="-48" rx="26" ry="18" fill={color} />
        <path d="M -26 -40 Q -32 -20 -28 8 L -22 4 Q -24 -18 -20 -36 Z" fill={color} />
        <path d="M 26 -40 Q 32 -20 28 8 L 22 4 Q 24 -18 20 -36 Z" fill={color} />
      </>
    )
  }
  if (style === 3) {
    return (
      <path
        d="M -24 -36 L -26 10 Q -14 4 0 6 Q 14 4 26 10 L 24 -36 Q 0 -58 -24 -36 Z"
        fill={color}
      />
    )
  }
  return (
    <path
      d="M -20 -38 Q -24 -52 0 -54 Q 24 -52 20 -38 L 18 -34 Q 0 -44 -18 -34 Z"
      fill={color}
    />
  )
}

function Outfit({ style, color }: { style: number; color: string }) {
  if (style === 1) {
    return <path d="M -26 8 L -32 52 L 32 52 L 26 8 Q 0 18 -26 8 Z" fill={color} />
  }
  if (style === 2) {
    return (
      <>
        <path d="M -22 10 L -28 54 L 28 54 L 22 10 Z" fill={color} />
        <path d="M -8 10 L 0 28 L 8 10" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      </>
    )
  }
  if (style === 3) {
    return (
      <path
        d="M -30 12 Q 0 24 30 12 L 34 54 L -34 54 Z"
        fill={color}
      />
    )
  }
  return <ellipse cx="0" cy="32" rx="30" ry="26" fill={color} />
}

function Accessory({ id }: { id: AccessoryId }) {
  switch (id) {
    case 'glasses':
      return (
        <g stroke="#333" strokeWidth="2" fill="none">
          <circle cx="-10" cy="-18" r="7" />
          <circle cx="10" cy="-18" r="7" />
          <path d="M -3 -18 L 3 -18" />
        </g>
      )
    case 'headphones':
      return (
        <g fill="#444">
          <path d="M -28 -22 Q -32 -42 0 -44 Q 32 -42 28 -22" fill="none" stroke="#444" strokeWidth="4" />
          <rect x="-32" y="-28" width="10" height="16" rx="3" />
          <rect x="22" y="-28" width="10" height="16" rx="3" />
        </g>
      )
    case 'camera':
      return (
        <g transform="translate(22, 18)">
          <rect x="-10" y="-8" width="18" height="12" rx="2" fill="#333" />
          <circle cx="0" cy="-2" r="4" fill="#888" />
        </g>
      )
    case 'bag':
      return (
        <path
          d="M 24 16 L 28 40 Q 22 44 18 40 L 20 16 Z"
          fill="#6B5344"
        />
      )
    case 'book':
      return (
        <rect x="-28" y="20" width="14" height="18" rx="1" fill="#8B6914" />
      )
    case 'coffee':
      return (
        <g transform="translate(-26, 22)">
          <rect x="0" y="0" width="12" height="14" rx="2" fill="#fff" stroke="#aaa" />
          <path d="M 12 4 Q 18 4 18 10" fill="none" stroke="#aaa" />
        </g>
      )
    case 'flowers':
      return (
        <g transform="translate(20, -8)">
          <circle cx="0" cy="0" r="5" fill="#E8A0BF" />
          <circle cx="-6" cy="4" r="4" fill="#F5C6D6" />
          <circle cx="6" cy="4" r="4" fill="#F5C6D6" />
        </g>
      )
    case 'hat':
      return (
        <ellipse cx="0" cy="-52" rx="28" ry="8" fill="#5C4033" />
      )
    case 'scarf':
      return (
        <path d="M -18 4 Q 0 16 18 4 L 14 22 Q 0 28 -14 22 Z" fill="#9B6B7A" opacity="0.9" />
      )
    default:
      return null
  }
}

export function RoomCharacter({
  appearance,
  scale = 1,
  label,
  isSelf,
  className,
}: RoomCharacterProps) {
  const skin = SKIN_TONES[appearance.skinTone % SKIN_TONES.length]
  const hairColor = HAIR_COLORS[appearance.hairColor % HAIR_COLORS.length]
  const outfitColor = OUTFIT_COLORS[appearance.outfitColor % OUTFIT_COLORS.length]

  return (
    <svg
      viewBox="-40 -70 80 130"
      className={className}
      style={{ width: 72 * scale, height: 110 * scale, overflow: 'visible' }}
      aria-hidden={!label}
    >
      <g>
        <Outfit style={appearance.outfitStyle % 4} color={isSelf ? '#6B7B8C' : outfitColor} />
        <circle cx="0" cy="-22" r="18" fill={skin} />
        <Hair style={appearance.hairStyle % 4} color={isSelf ? '#3D2914' : hairColor} />
        {appearance.accessories.map((a) => (
          <Accessory key={a} id={a} />
        ))}
        {isSelf && (
          <text
            y="68"
            textAnchor="middle"
            className="fill-[#5C4A3A] text-[11px] font-medium"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            You
          </text>
        )}
      </g>
      {label && !isSelf && (
        <text
          y="68"
          textAnchor="middle"
          className="fill-[#5C4A3A] text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {label}
        </text>
      )}
    </svg>
  )
}
