import type { ReactNode } from 'react'
import {
  BookHeart,
  Calendar,
  CalendarDays,
  Compass,
  Sticker,
  Wallet,
} from 'lucide-react'

export type AppView =
  | 'diary'
  | 'expenses'
  | 'taste'
  | 'monthly'
  | 'weekly'
  | 'compass'

interface BottomNavProps {
  active: AppView
  onChange: (view: AppView) => void
  /** Optional badge counts per tab (e.g. missing expense days). */
  badges?: Partial<Record<AppView, number>>
}

export function BottomNav({ active, onChange, badges }: BottomNavProps) {
  const transparent = active === 'taste'

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 ${
        transparent
          ? 'border-t border-transparent bg-transparent'
          : 'border-t border-hairline bg-white/95 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex max-w-xl justify-around px-1 py-2 sm:px-3">
        <NavButton
          label="Diary"
          icon={<BookHeart size={20} />}
          active={active === 'diary'}
          badge={badges?.diary}
          onClick={() => onChange('diary')}
          light={transparent}
        />
        <NavButton
          label="Expenses"
          icon={<Wallet size={20} />}
          active={active === 'expenses'}
          badge={badges?.expenses}
          onClick={() => onChange('expenses')}
          light={transparent}
        />
        <NavButton
          label="Taste"
          icon={<Sticker size={20} />}
          active={active === 'taste'}
          badge={badges?.taste}
          onClick={() => onChange('taste')}
          light={transparent}
        />
        <NavButton
          label="Monthly"
          icon={<Calendar size={20} />}
          active={active === 'monthly'}
          badge={badges?.monthly}
          onClick={() => onChange('monthly')}
          light={transparent}
        />
        <NavButton
          label="Weekly"
          icon={<CalendarDays size={20} />}
          active={active === 'weekly'}
          badge={badges?.weekly}
          onClick={() => onChange('weekly')}
          light={transparent}
        />
        <NavButton
          label="Compass"
          icon={<Compass size={20} />}
          active={active === 'compass'}
          badge={badges?.compass}
          onClick={() => onChange('compass')}
          light={transparent}
        />
      </div>
    </nav>
  )
}

function NavButton({
  label,
  icon,
  active,
  badge,
  onClick,
  light,
}: {
  label: string
  icon: ReactNode
  active: boolean
  badge?: number
  onClick: () => void
  light?: boolean
}) {
  const showBadge = typeof badge === 'number' && badge > 0
  const colorClass = light
    ? active
      ? 'text-[#fffac0]'
      : 'text-white/75 hover:text-white'
    : active
      ? 'text-[#007AFF]'
      : 'text-muted hover:text-[#48484A]'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors sm:px-3 ${colorClass}`}
    >
      <span className="relative">
        {icon}
        {showBadge && (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] font-bold leading-none text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
