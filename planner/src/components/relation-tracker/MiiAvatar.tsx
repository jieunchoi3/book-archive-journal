import type { AvatarConfig } from '../../types/relationTracker'
import {
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
} from '../../types/relationTracker'

interface MiiAvatarProps {
  avatar: AvatarConfig
  size?: number
  label?: string
  selected?: boolean
  onClick?: () => void
}

export function MiiAvatar({
  avatar,
  size = 72,
  label,
  selected,
  onClick,
}: MiiAvatarProps) {
  const skin = SKIN_TONES[avatar.skinTone] ?? SKIN_TONES[2]
  const hair = HAIR_COLORS[avatar.hairColor] ?? HAIR_COLORS[0]
  const outfit = OUTFIT_COLORS[avatar.outfitColor] ?? OUTFIT_COLORS[0]
  const bald = avatar.hairStyle === 0 && avatar.hairColor === 0

  const body = (
    <div
      className="relative flex shrink-0 flex-col items-center"
      style={{ width: size }}
    >
      <div
        className={`relative overflow-hidden rounded-full border-2 border-white shadow-md ${
          selected ? 'ring-2 ring-[#6B8F71] ring-offset-2' : ''
        }`}
        style={{
          width: size * 0.85,
          height: size * 0.85,
          background: skin,
        }}
      >
        {!bald && avatar.hairStyle >= 2 && (
          <div
            className="absolute left-1/2 top-[8%] -translate-x-1/2 rounded-full"
            style={{
              width: size * 0.55,
              height: size * 0.35,
              background: hair,
            }}
          />
        )}
        {!bald && avatar.hairStyle === 1 && (
          <div
            className="absolute left-[18%] top-[10%] rounded-full"
            style={{
              width: size * 0.28,
              height: size * 0.45,
              background: hair,
            }}
          />
        )}
        {!bald && avatar.hairStyle === 1 && (
          <div
            className="absolute right-[18%] top-[10%] rounded-full"
            style={{
              width: size * 0.28,
              height: size * 0.45,
              background: hair,
            }}
          />
        )}
        <div
          className="absolute left-[28%] top-[38%] rounded-full bg-[#1c1c1e]"
          style={{
            width: size * 0.08,
            height: avatar.eyeStyle === 2 ? size * 0.04 : size * 0.1,
          }}
        />
        <div
          className="absolute right-[28%] top-[38%] rounded-full bg-[#1c1c1e]"
          style={{
            width: size * 0.08,
            height: avatar.eyeStyle === 2 ? size * 0.04 : size * 0.1,
          }}
        />
        {avatar.mouthStyle === 2 ? (
          <div
            className="absolute bottom-[28%] left-1/2 h-[2px] w-[22%] -translate-x-1/2 bg-[#8b6914]"
          />
        ) : (
          <div
            className="absolute bottom-[26%] left-1/2 -translate-x-1/2 rounded-b-full border-b-2 border-[#c68642]"
            style={{ width: size * 0.2, height: size * 0.08 }}
          />
        )}
        {avatar.outfitStyle === 1 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[18%] bg-[#8b6914] opacity-90"
          />
        )}
      </div>
      <div
        className="-mt-1 rounded-b-xl"
        style={{
          width: size * 0.7,
          height: size * 0.35,
          background: outfit,
        }}
      />
      {label && (
        <span className="mt-1 max-w-[120%] truncate text-center text-[11px] font-medium text-[#48484A]">
          {label}
        </span>
      )}
    </div>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="cursor-pointer">
        {body}
      </button>
    )
  }
  return <div className="select-none">{body}</div>
}
