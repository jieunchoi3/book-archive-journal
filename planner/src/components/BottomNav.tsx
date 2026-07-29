import type { ReactNode } from 'react'
import { BookHeart, Calendar, CalendarDays, Wallet } from 'lucide-react'

export type AppView = 'diary' | 'expenses' | 'monthly' | 'weekly'

interface BottomNavProps {
  active: AppView
  onChange: (view: AppView) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl justify-around px-2 py-2 sm:px-4">
        <NavButton
          label="Diary"
          icon={<BookHeart size={20} />}
          active={active === 'diary'}
          onClick={() => onChange('diary')}
        />
        <NavButton
          label="Expenses"
          icon={<Wallet size={20} />}
          active={active === 'expenses'}
          onClick={() => onChange('expenses')}
        />
        <NavButton
          label="Monthly"
          icon={<Calendar size={20} />}
          active={active === 'monthly'}
          onClick={() => onChange('monthly')}
        />
        <NavButton
          label="Weekly"
          icon={<CalendarDays size={20} />}
          active={active === 'weekly'}
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
  onClick,
}: {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors sm:px-4 ${
        active ? 'text-[#007AFF]' : 'text-muted hover:text-[#48484A]'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
