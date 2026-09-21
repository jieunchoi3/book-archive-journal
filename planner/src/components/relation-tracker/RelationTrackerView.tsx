import { useState } from 'react'
import { Home } from 'lucide-react'
import { useRelationTracker } from '../../hooks/useRelationTracker'
import type { RelationPerson } from '../../types/relationTracker'
import { CheckInBanner } from './CheckInBanner'
import { NewFriendSheet } from './NewFriendSheet'
import { RoomCanvas } from './RoomCanvas'
import { WorldMapView } from './WorldMapView'

type SubView = 'room' | 'world'

export function RelationTrackerView() {
  const tracker = useRelationTracker()
  const [subView, setSubView] = useState<SubView>('room')
  const [sheet, setSheet] = useState<
    { mode: 'new' } | { mode: 'edit'; person: RelationPerson } | null
  >(null)

  const handleSave = (draft: Omit<RelationPerson, 'id'>) => {
    if (sheet?.mode === 'edit') {
      tracker.updatePerson(sheet.person.id, draft)
    } else {
      tracker.addPerson(draft)
    }
    setSheet(null)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#F9F8F3] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-hairline bg-[#F9F8F3]/95 px-4 py-2.5 backdrop-blur-md">
        <Home size={18} className="text-[#6B8F71]" />
        <div>
          <span className="font-serif text-[17px] font-semibold text-[#1C1C1E]">
            My Room
          </span>
          <p className="text-[10px] text-muted">Relation tracker</p>
        </div>
        <nav className="ml-auto flex gap-1 rounded-full bg-white/80 p-0.5 shadow-sm">
          {(['room', 'world'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubView(key)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize ${
                subView === key
                  ? 'bg-[#ebe6dc] text-[#1C1C1E]'
                  : 'text-muted'
              }`}
            >
              {key === 'room' ? 'Room' : 'World'}
            </button>
          ))}
        </nav>
      </header>

      <CheckInBanner
        items={tracker.checkIns}
        onReachOut={tracker.markReachedOut}
        onLater={tracker.dismissCheckIn}
      />

      {subView === 'room' ? (
        <RoomCanvas
          people={tracker.people}
          zoom={tracker.zoom}
          onZoomChange={tracker.setZoom}
          onOpenWorld={() => setSubView('world')}
          onInvite={() => setSheet({ mode: 'new' })}
          onEditPerson={(id) => {
            const person = tracker.people.find((p) => p.id === id)
            if (person) setSheet({ mode: 'edit', person })
          }}
        />
      ) : (
        <WorldMapView
          people={tracker.people}
          onBack={() => setSubView('room')}
          onEditPerson={(id) => {
            const person = tracker.people.find((p) => p.id === id)
            if (person) setSheet({ mode: 'edit', person })
          }}
        />
      )}

      {sheet && (
        <NewFriendSheet
          initial={
            sheet.mode === 'edit'
              ? sheet.person
              : undefined
          }
          onCancel={() => setSheet(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
