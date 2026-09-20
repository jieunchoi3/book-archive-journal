import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MyRoomActions } from '../../hooks/useMyRoom'
import { RoomCanvas } from './RoomCanvas'
import { InvitePersonSheet, doorPlacement } from './InvitePersonSheet'
import { PersonProfileSheet } from './PersonProfileSheet'
import { PeopleListView } from './PeopleListView'
import { HistoryView } from './HistoryView'
import { ReflectionsView } from './ReflectionsView'
import { todayKey } from '../../types/compass'

type SubView = 'room' | 'people' | 'history' | 'reflections'

interface MyRoomViewProps {
  room: MyRoomActions
}

export function MyRoomView({ room }: MyRoomViewProps) {
  const [sub, setSub] = useState<SubView>('room')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteExistingId, setInviteExistingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [timelineDate, setTimelineDate] = useState<string>(() => todayKey())
  const [liveMode, setLiveMode] = useState(true)
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set())
  const [showOnboarding, setShowOnboarding] = useState(!room.store.onboardingDone)

  const asOf = liveMode ? todayKey() : timelineDate
  const peopleInView = useMemo(
    () => room.peopleInRoomAt(asOf),
    [room, asOf, room.store.positionHistory, room.store.people],
  )
  const positionsInView = useMemo(
    () => room.positionsAtDate(asOf),
    [room, asOf, room.store.positionHistory],
  )

  const selected = room.store.people.find((p) => p.id === selectedId) ?? null

  const timelineMarks = useMemo(() => {
    const dates = new Set<string>()
    for (const r of room.store.positionHistory) dates.add(r.effectiveOn)
    for (const s of room.store.snapshots) dates.add(s.savedOn)
    return [...dates].sort()
  }, [room.store.positionHistory, room.store.snapshots])

  const runDoorAnimation = useCallback((personId: string) => {
    setEnteringIds((prev) => new Set(prev).add(personId))
    window.setTimeout(() => {
      setEnteringIds((prev) => {
        const n = new Set(prev)
        n.delete(personId)
        return n
      })
    }, 750)
  }, [])

  const handleInviteNew = (input: Parameters<MyRoomActions['createPerson']>[0]) => {
    const { x, y } = doorPlacement()
    const id = room.createPerson({
      ...input,
      inviteToRoom: true,
      initialX: x,
      initialY: y,
    })
    runDoorAnimation(id)
    setLiveMode(true)
    setSub('room')
  }

  useEffect(() => {
    if (showOnboarding && room.store.people.length > 0) {
      room.completeOnboarding()
      setShowOnboarding(false)
    }
  }, [room, showOnboarding])

  const readOnly = !liveMode

  return (
    <div className="flex h-[100dvh] flex-col bg-[#1a1612] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <header className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <h1 className="my-room-serif text-lg text-[#FAF7F2]">My Room</h1>
          {!liveMode && (
            <p className="text-[10px] text-[#C4A882]">
              Viewing · {new Date(timelineDate).toLocaleDateString()}
            </p>
          )}
        </div>
        <nav className="flex gap-1 rounded-full bg-black/30 p-0.5 text-[10px] backdrop-blur-sm">
          {(
            [
              ['room', 'Room'],
              ['people', 'People'],
              ['history', 'History'],
              ['reflections', 'Reflect'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`rounded-full px-2.5 py-1 ${
                sub === id ? 'bg-[#FAF7F2] text-[#3D3229]' : 'text-[#E8DFD4]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {sub === 'room' && (
        <>
          <div className="relative min-h-0 flex-1">
            <RoomCanvas
              people={peopleInView}
              positions={positionsInView}
              readOnly={readOnly}
              enteringIds={enteringIds}
              onMovePerson={
                liveMode
                  ? (id, x, y) => room.movePerson(id, x, y)
                  : undefined
              }
              onSelectPerson={setSelectedId}
            />

            {room.store.people.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center px-6">
                <p className="my-room-serif text-2xl text-[#FAF7F2]">Your room is yours to create.</p>
                <p className="mt-2 text-sm text-[#C4A882]">Invite someone when you are ready.</p>
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 z-30 flex flex-col gap-2">
              {liveMode && room.gentleReminders.length > 0 && (
                <div className="rounded-xl bg-[#FAF7F2]/95 p-3 text-sm shadow-lg backdrop-blur">
                  <p className="text-[#3D3229]">
                    It&apos;s been a while since you saw{' '}
                    <strong>{room.gentleReminders[0].person.name}</strong>.
                  </p>
                  <p className="text-xs text-[#8B7355]">
                    Last met {room.gentleReminders[0].daysSince} days ago.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="my-room-primary-btn text-xs py-1.5"
                      onClick={() => setSelectedId(room.gentleReminders[0].person.id)}
                    >
                      Reach out
                    </button>
                    <button
                      type="button"
                      className="my-room-ghost-btn text-xs py-1.5"
                      onClick={() => room.snoozeReminder(room.gentleReminders[0].person.id, 14)}
                    >
                      Remind me later
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[#8B7355] underline"
                      onClick={() => room.dismissReminder(room.gentleReminders[0].person.id)}
                    >
                      Not now
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 backdrop-blur-md">
                <span className="text-[10px] text-[#C4A882] shrink-0">Timeline</span>
                <input
                  type="range"
                  className="flex-1 accent-[#C4A882]"
                  min={0}
                  max={Math.max(0, timelineMarks.length - 1)}
                  value={Math.max(0, timelineMarks.indexOf(liveMode ? todayKey() : timelineDate))}
                  onChange={(e) => {
                    const i = Number(e.target.value)
                    const d = timelineMarks[i] ?? todayKey()
                    setTimelineDate(d)
                    setLiveMode(d === todayKey())
                  }}
                />
                <button
                  type="button"
                  className="text-[10px] text-[#FAF7F2] underline"
                  onClick={() => {
                    setLiveMode(true)
                    setTimelineDate(todayKey())
                  }}
                >
                  Today
                </button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-24 right-4 z-30 flex flex-col gap-1">
            <button
              type="button"
              className="my-room-fab"
              onClick={() => {
                setInviteExistingId(null)
                setInviteOpen(true)
              }}
            >
              + Invite
            </button>
            <button
              type="button"
              className="my-room-fab-secondary text-xs"
              onClick={() => room.saveSnapshot(`Snapshot · ${todayKey()}`)}
            >
              Save room
            </button>
          </div>
        </>
      )}

      {sub === 'people' && (
        <PeopleListView
          store={room.store}
          onCreateMet={room.createPerson}
          onSelect={(id) => {
            setSelectedId(id)
            setSub('room')
          }}
          onInviteMet={(id) => {
            setInviteExistingId(id)
            setInviteOpen(true)
          }}
        />
      )}

      {sub === 'history' && (
        <HistoryView
          store={room.store}
          onOpenDate={(d) => {
            setTimelineDate(d)
            setLiveMode(d === todayKey())
            setSub('room')
          }}
        />
      )}

      {sub === 'reflections' && <ReflectionsView memories={room.store.memories} people={room.store.people} />}

      <InvitePersonSheet
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false)
          setInviteExistingId(null)
        }}
        onInvite={(input) =>
          handleInviteNew({
            ...input,
            inviteToRoom: true,
          })
        }
        existingName={
          inviteExistingId
            ? room.store.people.find((p) => p.id === inviteExistingId)?.name
            : undefined
        }
        onInviteExisting={
          inviteExistingId
            ? () => {
                const { x, y } = doorPlacement()
                room.inviteToRoom(inviteExistingId, x, y)
                runDoorAnimation(inviteExistingId)
              }
            : undefined
        }
      />

      {selected && (
        <PersonProfileSheet
          person={selected}
          store={room.store}
          open={Boolean(selectedId)}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => room.updatePerson(selected.id, patch)}
          onUpdateCharacter={(c) => room.updateCharacter(selected.id, c)}
          onMoveMode={() => setSelectedId(null)}
          onArchive={() => {
            room.archiveFromRoom(selected.id)
            setSelectedId(null)
          }}
          onAddMemory={(date, text) => room.addMemory(selected.id, date, text)}
          onInvite={() => {
            const { x, y } = doorPlacement()
            room.inviteToRoom(selected.id, x, y)
            runDoorAnimation(selected.id)
            setSelectedId(null)
          }}
        />
      )}

      {showOnboarding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6">
          <div className="max-w-sm rounded-2xl bg-[#FAF7F2] p-6 text-center shadow-xl">
            <p className="my-room-serif text-xl text-[#3D3229]">Welcome to your room</p>
            <p className="mt-3 text-sm text-[#5C4A3A]">
              Your room represents the people who occupy your life. Place them where it feels true —
              no scores, no graphs.
            </p>
            <button
              type="button"
              className="my-room-primary-btn mt-6 w-full"
              onClick={() => {
                room.completeOnboarding()
                setShowOnboarding(false)
                setInviteOpen(true)
              }}
            >
              Invite someone in
            </button>
            <button
              type="button"
              className="mt-2 text-xs text-[#8B7355] underline"
              onClick={() => {
                room.completeOnboarding()
                setShowOnboarding(false)
              }}
            >
              Explore empty room
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
