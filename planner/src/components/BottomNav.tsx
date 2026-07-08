import type { ReactNode } from 'react'
import { CalendarDays, CheckSquare } from 'lucide-react'

export type AppView = 'tasks' | 'weekly'

interface BottomNavProps {
  active: AppView
  onChange: (view: AppView) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg justify-around px-4 py-2">
        <NavButton
          label="Tasks"
          icon={<CheckSquare size={20} />}
          active={active === 'tasks'}
          onClick={() => onChange('tasks')}
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
      className={`flex flex-col items-center gap-0.5 rounded-lg px-6 py-1.5 transition-colors ${
        active ? 'text-[#007AFF]' : 'text-muted hover:text-[#48484A]'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
