import { useState } from 'react'
import { AuthProvider } from './components/AuthProvider'
import { useAuth } from './hooks/useAuth'
import { PlannerDataProvider } from './context/PlannerDataContext'
import { usePlanner } from './hooks/usePlanner'
import { useItems } from './hooks/useItems'
import { useExpenses } from './hooks/useExpenses'
import { useSnapBookings } from './hooks/useSnapBookings'
import { useLinkedApps } from './hooks/useLinkedApps'
import { useCompass } from './hooks/useCompass'
import { ImportLocalDataBanner } from './components/ImportLocalDataBanner'
import { WeekView } from './components/WeekView'
import { MonthCalendarView } from './components/MonthCalendarView'
import { DiaryView } from './components/DiaryView'
import { ExpenseView } from './components/ExpenseView'
import { SnapView } from './components/SnapView'
import { TasteStickerView } from './components/TasteStickerView'
import { CompassView } from './components/CompassView'
import { BottomNav, type AppView } from './components/BottomNav'
import type { CompassRoute } from './types/compass'
import { DAY_KEYS, type DayKey } from './types/planner'
import { getDateKeyForDay } from './lib/weekUtils'
import { todayKey } from './types/compass'

function AppContent() {
  const [view, setView] = useState<AppView>('weekly')
  const [compassRoute, setCompassRoute] = useState<CompassRoute>({
    page: 'overview',
  })
  const planner = usePlanner()
  const items = useItems(planner.weekStart)
  const expenses = useExpenses()
  const snap = useSnapBookings()
  const linkedApps = useLinkedApps()
  const compass = useCompass()

  const openCompassAsk = (questionId?: string) => {
    setCompassRoute(
      questionId
        ? { page: 'askDetail', questionId }
        : { page: 'ask' },
    )
    setView('compass')
  }

  const onAddWeeklyTask = (label: string) => {
    const today = todayKey()
    let dayKey: DayKey = 'mon'
    for (const k of DAY_KEYS) {
      if (getDateKeyForDay(planner.weekStart, k) === today) {
        dayKey = k
        break
      }
    }
    const day = planner.template.days.find((d) => d.key === dayKey)
    const block = day?.blocks[0]
    if (!block) return
    planner.addTask(dayKey, block.id, `Compass · ${label}`, null)
    setView('weekly')
  }

  return (
    <>
      <ImportLocalDataBanner />
      {view === 'diary' ? (
        <DiaryView expenses={expenses} />
      ) : view === 'expenses' ? (
        <ExpenseView expenses={expenses} />
      ) : view === 'snap' ? (
        <SnapView snap={snap} />
      ) : view === 'taste' ? (
        <TasteStickerView />
      ) : view === 'compass' ? (
        <CompassView
          compass={compass}
          route={compassRoute}
          onRouteChange={setCompassRoute}
          onAddWeeklyTask={onAddWeeklyTask}
        />
      ) : view === 'weekly' ? (
        <WeekView
          template={planner.template}
          weekStart={planner.weekStart}
          planner={planner}
          items={items}
          linkedApps={linkedApps}
          compass={compass}
          onOpenCompassAsk={openCompassAsk}
        />
      ) : (
        <MonthCalendarView
          items={items}
          planner={planner}
          linkedApps={linkedApps}
          onOpenWeekly={() => setView('weekly')}
        />
      )}
      <BottomNav
        active={view}
        onChange={(v) => {
          if (v === 'compass') setCompassRoute({ page: 'overview' })
          setView(v)
        }}
        badges={{
          expenses: expenses.missingLogDays.length,
          snap: snap.unpaidCount,
          compass: compass.badgeCount,
        }}
      />
    </>
  )
}

function PlannerRoot() {
  const { user } = useAuth()

  return (
    <PlannerDataProvider user={user} onSignOut={() => {}}>
      <AppContent />
    </PlannerDataProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <PlannerRoot />
    </AuthProvider>
  )
}

export default App
