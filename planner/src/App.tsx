import { useState } from 'react'
import { AuthProvider } from './components/AuthProvider'
import { useAuth } from './hooks/useAuth'
import { PlannerDataProvider } from './context/PlannerDataContext'
import { usePlanner } from './hooks/usePlanner'
import { useItems } from './hooks/useItems'
import { useExpenses } from './hooks/useExpenses'
import { useLinkedApps } from './hooks/useLinkedApps'
import { ImportLocalDataBanner } from './components/ImportLocalDataBanner'
import { WeekView } from './components/WeekView'
import { MonthCalendarView } from './components/MonthCalendarView'
import { DiaryView } from './components/DiaryView'
import { ExpenseView } from './components/ExpenseView'
import { BottomNav, type AppView } from './components/BottomNav'

function AppContent() {
  const [view, setView] = useState<AppView>('weekly')
  const planner = usePlanner()
  const items = useItems(planner.weekStart)
  const expenses = useExpenses()
  const linkedApps = useLinkedApps()

  return (
    <>
      <ImportLocalDataBanner />
      {view === 'diary' ? (
        <DiaryView expenses={expenses} />
      ) : view === 'expenses' ? (
        <ExpenseView expenses={expenses} />
      ) : view === 'weekly' ? (
        <WeekView
          template={planner.template}
          weekStart={planner.weekStart}
          planner={planner}
          items={items}
          linkedApps={linkedApps}
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
        onChange={setView}
        badges={{ expenses: expenses.missingLogDays.length }}
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
