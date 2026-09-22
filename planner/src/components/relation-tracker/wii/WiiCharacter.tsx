import type { AvatarConfig } from '../../../types/relationTracker'
import {
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
} from '../../../types/relationTracker'

interface WiiCharacterProps {
  avatar: AvatarConfig
  /** Override single trait for picker previews */
  preview?: Partial<AvatarConfig>
  className?: string
}

export function WiiCharacter({ avatar, preview, className }: WiiCharacterProps) {
  const cfg = { ...avatar, ...preview }
  const skin = SKIN_TONES[cfg.skinTone] ?? SKIN_TONES[2]
  const hair = HAIR_COLORS[cfg.hairColor] ?? HAIR_COLORS[0]
  const shirt = OUTFIT_COLORS[cfg.outfitColor] ?? OUTFIT_COLORS[0]
  const pants = '#6b6b70'
  const bald = cfg.hairStyle === 0

  return (
    <svg
      viewBox="0 0 120 200"
      className={className}
      aria-hidden
      style={{ overflow: 'visible', background: 'none' }}
    >
      <g>
        {/* Legs */}
        <rect x="42" y="148" width="14" height="42" rx="6" fill={pants} />
        <rect x="64" y="148" width="14" height="42" rx="6" fill={pants} />
        {/* Torso */}
        <path
          d="M38 118 Q60 108 82 118 L78 152 Q60 158 42 152 Z"
          fill={shirt}
        />
        {cfg.outfitStyle === 1 && (
          <path d="M48 118 L60 128 L72 118" fill="none" stroke={pants} strokeWidth="2" />
        )}
        {/* Neck */}
        <rect x="52" y="108" width="16" height="14" rx="4" fill={skin} />
        {/* Hair back layer */}
        {!bald && cfg.hairStyle === 4 && (
          <ellipse cx="60" cy="72" rx="38" ry="40" fill={hair} />
        )}
        {/* Head */}
        <ellipse cx="60" cy="72" rx="32" ry="36" fill={skin} />
        {/* Hair front */}
        {!bald && <Hair style={cfg.hairStyle} color={hair} />}
        {/* Face */}
        <Eyes style={cfg.eyeStyle} />
        <Mouth style={cfg.mouthStyle} />
        {/* Cheek blush */}
        <ellipse cx="42" cy="82" rx="6" ry="3" fill="#e8a090" opacity="0.35" />
        <ellipse cx="78" cy="82" rx="6" ry="3" fill="#e8a090" opacity="0.35" />
      </g>
    </svg>
  )
}

function Eyes({ style }: { style: number }) {
  const y = 70
  if (style === 2) {
    return (
      <>
        <path d={`M44 ${y} Q50 ${y - 6} 56 ${y}`} stroke="#1c1c1e" strokeWidth="2.5" fill="none" />
        <path d={`M64 ${y} Q70 ${y - 6} 76 ${y}`} stroke="#1c1c1e" strokeWidth="2.5" fill="none" />
      </>
    )
  }
  if (style === 3) {
    return (
      <>
        <ellipse cx="50" cy={y} rx="5" ry="9" fill="#1c1c1e" />
        <ellipse cx="70" cy={y} rx="5" ry="9" fill="#1c1c1e" />
        <circle cx="51" cy={y - 2} r="1.5" fill="white" />
        <circle cx="71" cy={y - 2} r="1.5" fill="white" />
      </>
    )
  }
  if (style === 4) {
    return (
      <>
        <line x1="44" y1={y} x2="56" y2={y} stroke="#1c1c1e" strokeWidth="2.5" />
        <line x1="64" y1={y} x2="76" y2={y} stroke="#1c1c1e" strokeWidth="2.5" />
      </>
    )
  }
  if (style === 1) {
    return (
      <>
        <ellipse cx="50" cy={y} rx="7" ry="8" fill="white" stroke="#1c1c1e" strokeWidth="1" />
        <ellipse cx="70" cy={y} rx="7" ry="8" fill="white" stroke="#1c1c1e" strokeWidth="1" />
        <circle cx="50" cy={y + 1} r="3.5" fill="#1c1c1e" />
        <circle cx="70" cy={y + 1} r="3.5" fill="#1c1c1e" />
        <circle cx="51" cy={y - 1} r="1.2" fill="white" />
        <circle cx="71" cy={y - 1} r="1.2" fill="white" />
      </>
    )
  }
  // default round Mii eyes
  return (
    <>
      <ellipse cx="50" cy={y} rx="6" ry="7" fill="white" stroke="#333" strokeWidth="0.5" />
      <ellipse cx="70" cy={y} rx="6" ry="7" fill="white" stroke="#333" strokeWidth="0.5" />
      <circle cx="50" cy={y + 1} r="4" fill="#1c1c1e" />
      <circle cx="70" cy={y + 1} r="4" fill="#1c1c1e" />
      <circle cx="51.5" cy={y - 1} r="1.5" fill="white" />
      <circle cx="71.5" cy={y - 1} r="1.5" fill="white" />
    </>
  )
}

function Mouth({ style }: { style: number }) {
  const y = 88
  if (style === 2) {
    return <line x1="52" y1={y} x2="68" y2={y} stroke="#8b6914" strokeWidth="2" strokeLinecap="round" />
  }
  if (style === 3) {
    return <ellipse cx="60" cy={y + 2} rx="5" ry="4" fill="#6b3a2a" />
  }
  if (style === 4) {
    return (
      <path
        d={`M54 ${y} Q60 ${y + 4} 66 ${y}`}
        stroke="#8b6914"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    )
  }
  if (style === 1) {
    return (
      <path
        d={`M50 ${y - 2} Q60 ${y + 8} 70 ${y - 2}`}
        fill="#fff"
        stroke="#8b6914"
        strokeWidth="1.5"
      />
    )
  }
  return (
    <path
      d={`M50 ${y} Q60 ${y + 6} 70 ${y}`}
      stroke="#c68642"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
  )
}

function Hair({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 1:
      return (
        <>
          <path d="M32 68 Q60 28 88 68 L85 58 Q60 22 35 58 Z" fill={color} />
          <ellipse cx="38" cy="62" rx="10" ry="18" fill={color} />
          <ellipse cx="82" cy="62" rx="10" ry="18" fill={color} />
        </>
      )
    case 2:
      return (
        <>
          <path d="M30 70 Q60 24 90 70 L88 52 Q60 18 32 52 Z" fill={color} />
          <circle cx="28" cy="78" r="10" fill={color} />
          <circle cx="92" cy="78" r="10" fill={color} />
        </>
      )
    case 3:
      return (
        <path
          d="M28 72 Q34 38 60 32 Q86 38 92 72 L88 64 Q60 42 32 64 Z"
          fill={color}
        />
      )
    case 4:
      return null
    case 5:
      return (
        <>
          <ellipse cx="60" cy="48" rx="22" ry="16" fill={color} />
          <circle cx="60" cy="36" r="14" fill={color} />
        </>
      )
    case 6:
      return <ellipse cx="60" cy="58" rx="34" ry="28" fill={color} />
    case 7:
      return (
        <path d="M28 70 Q45 30 75 40 Q92 55 88 72 L82 62 Q70 45 40 55 Q32 62 28 70 Z" fill={color} />
      )
    default:
      return null
  }
}
