import { usePlannerData, type LinkedAppsActions } from '../context/PlannerDataContext'

export type { LinkedAppsActions }

export function useLinkedApps(): LinkedAppsActions {
  const data = usePlannerData()
  return {
    linkedApps: data.linkedApps,
    addLinkedApp: data.addLinkedApp,
    updateLinkedApp: data.updateLinkedApp,
    deleteLinkedApp: data.deleteLinkedApp,
    openLinkedApp: data.openLinkedApp,
  }
}
