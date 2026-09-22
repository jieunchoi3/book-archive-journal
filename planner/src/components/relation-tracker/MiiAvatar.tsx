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
        className="relative flex items-end justify-center"
        style={{ width: size, minHeight: imgSize }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className={`h-auto w-auto max-w-none object-contain ${
            selected
              ? 'drop-shadow-[0_0_0_2px_#6B8F71] drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)]'
              : 'drop-shadow-[0_6px_12px_rgba(0,0,0,0.15)]'
          }`}
          style={{ height: imgSize, maxWidth: size * 1.35 }}
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
