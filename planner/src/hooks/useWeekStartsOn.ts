import { useCallback, useEffect, useState } from 'react'
import type { DayKey } from '../types/planner'
import { DAY_KEYS } from '../types/planner'
import { getWeekStartDate } from '../lib/weekUtils'
import {
  loadWeekStartsOn,
  saveWeekStartsOn,
  setWeekStartsOnRuntime,
  WEEK_START_LABELS,
} from '../lib/weekStartPreference'
import { usePlannerData } from '../context/PlannerDataContext'

export { WEEK_START_LABELS }

export function useWeekStartsOn() {
  const { user, weekStart, goToWeek } = usePlannerData()
  const userId = user.id
  const [weekStartsOn, setWeekStartsOnState] = useState<DayKey>(() => {
    const loaded = loadWeekStartsOn(userId)
    setWeekStartsOnRuntime(loaded)
    return loaded
  })

  useEffect(() => {
    const loaded = loadWeekStartsOn(userId)
    setWeekStartsOnRuntime(loaded)
    setWeekStartsOnState(loaded)
  }, [userId])

  const setWeekStartsOn = useCallback(
    (day: DayKey) => {
      if (!(DAY_KEYS as string[]).includes(day)) return
      saveWeekStartsOn(userId, day)
      setWeekStartsOnState(day)
      const nextStart = getWeekStartDate(new Date(), day)
      if (nextStart !== weekStart) {
        void goToWeek(nextStart)
      }
    },
    [userId, weekStart, goToWeek],
  )

  return { weekStartsOn, setWeekStartsOn, labels: WEEK_START_LABELS }
}
