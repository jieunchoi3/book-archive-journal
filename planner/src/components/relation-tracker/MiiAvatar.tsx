import type { AvatarConfig } from '../../types/relationTracker'
import { resolveAvatarSrc } from '../../lib/avatarPresets'

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
  const src = resolveAvatarSrc(avatar)
  const imgSize = size * 1.35

  const body = (
    <div
      className="relative flex shrink-0 flex-col items-center"
      style={{ width: size }}
    >
      <div
        className={`relative flex items-end justify-center overflow-visible ${
          selected ? 'ring-2 ring-[#6B8F71] ring-offset-2 rounded-2xl' : ''
        }`}
        style={{ width: size, height: imgSize }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="max-h-full w-auto object-contain drop-shadow-md"
          style={{ height: imgSize, width: 'auto', maxWidth: size * 1.2 }}
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
      <button type="button" onClick={onClick} className="cursor-pointer">
        {body}
      </button>
    )
  }
  return <div className="select-none">{body}</div>
}
