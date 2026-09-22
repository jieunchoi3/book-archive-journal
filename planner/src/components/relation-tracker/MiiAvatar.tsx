import type { AvatarConfig } from '../../types/relationTracker'
import { WiiCharacter } from './wii/WiiCharacter'

interface MiiAvatarProps {
  avatar: AvatarConfig
  size?: number
  label?: string
  selected?: boolean
  onClick?: () => void
  /** Highlight one trait in customizer grids */
  preview?: Partial<AvatarConfig>
}

export function MiiAvatar({
  avatar,
  size = 72,
  label,
  selected,
  onClick,
  preview,
}: MiiAvatarProps) {
  const height = size * 1.65

  const body = (
    <div
      className="relative flex shrink-0 flex-col items-center"
      style={{ width: size }}
    >
      <div
        className={`relative ${selected ? 'rounded-full ring-2 ring-[#6B8F71] ring-offset-2 ring-offset-transparent' : ''}`}
        style={{ width: size, height }}
      >
        <WiiCharacter
          avatar={avatar}
          preview={preview}
          className="h-full w-full"
        />
      </div>
      {label && (
        <span className="mt-0.5 max-w-[120%] truncate text-center text-[11px] font-medium text-[#48484A]">
          {label}
        </span>
      )}
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer border-0 bg-transparent p-0"
      >
        {body}
      </button>
    )
  }
  return <div className="select-none">{body}</div>
}
