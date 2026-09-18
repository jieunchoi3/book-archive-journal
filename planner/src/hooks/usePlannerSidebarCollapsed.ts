import { useCallback, useEffect, useState } from 'react'

export const PLANNER_SIDEBAR_COLLAPSED_KEY = 'planner:sidebarCollapsed'

const SYNC_EVENT = 'planner-sidebar-collapsed'

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PLANNER_SIDEBAR_COLLAPSED_KEY) === 'true'
}

export function usePlannerSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readCollapsed)

  useEffect(() => {
    const sync = () => setCollapsedState(readCollapsed())
    window.addEventListener(SYNC_EVENT, sync)
    return () => window.removeEventListener(SYNC_EVENT, sync)
  }, [])

  const setCollapsed = useCallback((value: boolean) => {
    localStorage.setItem(PLANNER_SIDEBAR_COLLAPSED_KEY, String(value))
    setCollapsedState(value)
    window.dispatchEvent(new Event(SYNC_EVENT))
  }, [])

  return { collapsed, setCollapsed }
}
