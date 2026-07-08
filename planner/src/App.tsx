import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { PlannerDataProvider } from './context/PlannerDataContext'
import { usePlanner } from './hooks/usePlanner'
import { useItems } from './hooks/useItems'
import { useLinkedApps } from './hooks/useLinkedApps'
import { ImportLocalDataBanner } from './components/ImportLocalDataBanner'
import { WeekView } from './components/WeekView'
import { TasksBoardView } from './components/TasksBoardView'
import { BottomNav, type AppView } from './components/BottomNav'

function AppContent() {
  const [view, setView] = useState<AppView>('weekly')
  const planner = usePlanner()
  const items = useItems(planner.weekStart)
  const linkedApps = useLinkedApps()

  return (
    <>
      <ImportLocalDataBanner />
      {view === 'weekly' ? (
        <WeekView
          template={planner.template}
          weekStart={planner.weekStart}
          planner={planner}
          items={items}
          linkedApps={linkedApps}
        />
      ) : (
        <TasksBoardView items={items} linkedApps={linkedApps} />
      )}
      <BottomNav active={view} onChange={setView} />
    </>
  )
}

function App() {
  const { session, loading, error } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
        <p className="max-w-sm text-center text-[13px] text-red-600">
          {error ?? 'Could not start the planner.'}
        </p>
      </div>
    )
  }

  return (
    <PlannerDataProvider user={session.user} onSignOut={() => {}}>
      <AppContent />
    </PlannerDataProvider>
  )
}

export default App
