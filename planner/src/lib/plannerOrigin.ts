const ORIGIN_KEY = 'planner:last-origin'

export function notePlannerOrigin(): { switched: boolean; previousOrigin: string | null } {
  try {
    const previousOrigin = localStorage.getItem(ORIGIN_KEY)
    const current = window.location.origin
    localStorage.setItem(ORIGIN_KEY, current)
    if (previousOrigin && previousOrigin !== current) {
      return { switched: true, previousOrigin }
    }
  } catch {
    /* ignore */
  }
  return { switched: false, previousOrigin: null }
}

export const PLANNER_ORIGIN_HINT_DISMISS_KEY = 'planner:origin-hint-dismissed'
