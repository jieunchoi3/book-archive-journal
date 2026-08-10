import type { ReactNode } from 'react'
import { BookHeart, Calendar, CalendarDays, Wallet } from 'lucide-react'

export type AppView = 'diary' | 'expenses' | 'monthly' | 'weekly'

interface BottomNavProps {
  active: AppView
  onChange: (view: AppView) => void
  /** Optional badge counts per tab (e.g. missing expense days). */
  badges?: Partial<Record<AppView, number>>
}

export function BottomNav({ active, onChange, badges }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl justify-around px-2 py-2 sm:px-4">
        <NavButton
          label="Diary"
          icon={<BookHeart size={20} />}
          active={active === 'diary'}
          badge={badges?.diary}
          onClick={() => onChange('diary')}
        />
        <NavButton
          label="Expenses"
          icon={<Wallet size={20} />}
          active={active === 'expenses'}
          badge={badges?.expenses}
          onClick={() => onChange('expenses')}
        />
        <NavButton
          label="Monthly"
          icon={<Calendar size={20} />}
          active={active === 'monthly'}
          badge={badges?.monthly}
          onClick={() => onChange('monthly')}
        />
        <NavButton
          label="Weekly"
          icon={<CalendarDays size={20} />}
          active={active === 'weekly'}
          badge={badges?.weekly}
          onClick={() => onChange('weekly')}
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
}: {
  label: string
  icon: ReactNode
  active: boolean
  badge?: number
  onClick: () => void
}) {
  const showBadge = typeof badge === 'number' && badge > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors sm:px-4 ${
        active ? 'text-[#007AFF]' : 'text-muted hover:text-[#48484A]'
      }`}
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
