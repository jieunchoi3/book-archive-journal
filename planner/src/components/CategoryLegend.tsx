import type { ReactNode } from 'react'
import { PanelLeftClose } from 'lucide-react'
import { CATEGORY_STYLES } from '../lib/categories'
import { usePlannerSidebarCollapsed } from '../hooks/usePlannerSidebarCollapsed'

interface CategoryLegendProps {
  renderQuickLaunch?: (collapsed: boolean) => ReactNode
}

export function CategoryLegend({ renderQuickLaunch }: CategoryLegendProps) {
  const { setCollapsed } = usePlannerSidebarCollapsed()

  return (
    <aside className="w-52 shrink-0">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Categories
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white hover:text-[#1C1C1E] hover:shadow-sm"
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
      <ul className="space-y-1">
        {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
          <li
            key={key}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-[#3C3C43]"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: style.dot }}
            />
            {style.label}
          </li>
        ))}
      </ul>
      {renderQuickLaunch?.(false)}
    </aside>
  )
}
