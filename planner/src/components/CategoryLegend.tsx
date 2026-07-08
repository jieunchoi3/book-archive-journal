import { useEffect, useState, type ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { CATEGORY_STYLES } from '../lib/categories'

const STORAGE_KEY = 'planner:sidebarCollapsed'

interface CategoryLegendProps {
  renderQuickLaunch?: (collapsed: boolean) => ReactNode
}

export function CategoryLegend({ renderQuickLaunch }: CategoryLegendProps) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center pt-1">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-white hover:text-[#1C1C1E] hover:shadow-sm"
          aria-label="Show sidebar"
          title="Show sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>
        <ul className="mt-3 flex flex-col items-center gap-2">
          {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
            <li key={key}>
              <span
                className="block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: style.dot }}
                title={style.label}
              />
            </li>
          ))}
        </ul>
        {renderQuickLaunch?.(true)}
      </aside>
    )
  }

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
