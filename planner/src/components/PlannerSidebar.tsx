import { CommitmentsPanel } from './CommitmentsPanel'
import { QuickLaunchPanel } from './QuickLaunchPanel'
import type { LinkedAppsActions } from '../hooks/useLinkedApps'

interface PlannerSidebarProps {
  linkedApps: LinkedAppsActions
}

export function PlannerSidebar({ linkedApps }: PlannerSidebarProps) {
  return (
    <div className="flex shrink-0 flex-col">
      <CommitmentsPanel
        renderQuickLaunch={(collapsed) => (
          <QuickLaunchPanel linkedApps={linkedApps} collapsed={collapsed} />
        )}
      />
    </div>
  )
}
