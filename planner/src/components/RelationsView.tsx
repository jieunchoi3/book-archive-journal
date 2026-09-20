import { useState } from 'react'
import { BookUser, Camera, Clock3, Plus } from 'lucide-react'
import type { RoomActions } from '../hooks/useRoom'
import { RoomWorld } from './RoomWorld'
import { MetPeopleLibrary } from './MetPeopleLibrary'
import { RoomPersonSheet } from './RoomPersonSheet'
import { RoomInviteSheet } from './RoomInviteSheet'
import { todayKey } from '../types/compass'
import type { RoomPerson } from '../types/room'
import { ROOM_REFLECTION_PROMPTS } from '../types/room'

interface RelationsViewProps {
  room: RoomActions
}

export function RelationsView({ room }: RelationsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const today = todayKey()

  const selectedPerson = room.store.people.find((p) => p.id === selectedId) ?? null
  const selectedPlacement = selectedId ? room.placements.get(selectedId) : null

  const reflectionPrompt =
    ROOM_REFLECTION_PROMPTS[Math.floor(Date.now() / 86_400_000) % ROOM_REFLECTION_PROMPTS.length]

  return (
    <div className="relative min-h-screen bg-[#2C2419] pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
      {/* Minimal chrome — room is the experience */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <div className="pointer-events-auto rounded-2xl bg-black/30 px-3 py-2 backdrop-blur-md">
          <p className="text-[15px] font-semibold text-white">My Room</p>
          <p className="text-[11px] text-white/70">Your life, as a space</p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-[12px] font-medium text-white backdrop-blur-md"
          >
            <BookUser size={16} />
            Met
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1 rounded-full bg-[#007AFF] px-3 py-2 text-[12px] font-semibold text-white"
          >
            <Plus size={16} />
            New
          </button>
        </div>
      </div>

      {room.syncError && (
        <div className="absolute left-3 right-3 top-20 z-20 rounded-xl bg-[#FF3B30]/90 px-3 py-2 text-[12px] text-white">
          {room.syncError}
        </div>
      )}

      {room.gentleNudges[0] && (
        <div className="absolute bottom-24 left-3 right-3 z-20 rounded-2xl bg-[#FFF9F0]/95 px-4 py-3 text-[13px] text-[#3C3C43] shadow-lg">
          <p>
            It&apos;s been a while since you saw {room.gentleNudges[0].name.split(/\s+/)[0]}. A gentle
            nudge — only if it feels right.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
            <button
              type="button"
              className="font-semibold text-[#007AFF]"
              onClick={() => {
                setSelectedId(room.gentleNudges[0].id)
                void room.logContact(room.gentleNudges[0].id)
              }}
            >
              Log contact
            </button>
            <button type="button" className="text-muted" onClick={() => void room.snoozeNudge(room.gentleNudges[0].id, 30)}>
              Later
            </button>
            <button type="button" className="text-muted" onClick={() => void room.dismissNudge(room.gentleNudges[0].id)}>
              Not now
            </button>
          </div>
        </div>
      )}

      <RoomWorld
        people={room.inRoomPeople}
        placements={room.placements}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMove={(id, pl) => void room.movePerson(id, pl)}
        asOfLabel={room.asOf}
        isToday={room.asOf === today}
      />

      {/* Time travel rail */}
      <div className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-20 px-3">
        <div className="flex items-center gap-2 rounded-2xl bg-black/40 p-2 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setTimeOpen((o) => !o)}
            className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] text-white/90"
          >
            <Clock3 size={16} />
            Time
          </button>
          {timeOpen && (
            <input
              type="date"
              value={room.asOf}
              max={today}
              onChange={(e) => room.setAsOf(e.target.value || today)}
              className="rounded-lg border-0 bg-white/10 px-2 py-1 text-[12px] text-white"
            />
          )}
          {room.asOf !== today && (
            <button
              type="button"
              className="text-[12px] font-medium text-[#7EB8FF]"
              onClick={() => room.setAsOf(today)}
            >
              Today
            </button>
          )}
          <button
            type="button"
            className="ml-auto flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] text-white/80"
            onClick={() => {
              const label = prompt('Name this moment (optional)', today) ?? today
              void room.saveSnapshot(label)
            }}
          >
            <Camera size={16} />
            Save moment
          </button>
        </div>
        {!timeOpen && (
          <p className="mt-1 px-1 text-center text-[10px] text-white/40">{reflectionPrompt}</p>
        )}
      </div>

      {room.showOnboarding && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-6">
          <div className="max-w-sm rounded-3xl bg-[#FBF8F2] p-6 text-center shadow-xl">
            <h2 className="text-[18px] font-semibold text-[#1C1C1E]">Welcome to your room</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#636366]">
              You have {room.metNotInRoom.length + room.inRoomPeople.length} people you&apos;ve met in
              your inventory. They are <strong>not</strong> placed automatically — invite who belongs
              in your room, then drag them where they feel right.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-[#007AFF] py-3 text-[14px] font-semibold text-white"
              onClick={() => {
                room.dismissOnboarding()
                setLibraryOpen(true)
              }}
            >
              Browse people to invite
            </button>
            <button
              type="button"
              className="mt-2 w-full py-2 text-[13px] text-muted"
              onClick={() => room.dismissOnboarding()}
            >
              Enter empty room
            </button>
          </div>
        </div>
      )}

      <MetPeopleLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        metPeople={room.metNotInRoom}
        onInvite={(id) => {
          void room.inviteIntoRoom(id)
          setLibraryOpen(false)
        }}
        onSelectMet={(p: RoomPerson) => setSelectedId(p.id)}
      />

      {inviteOpen && <RoomInviteSheet room={room} onClose={() => setInviteOpen(false)} />}

      {selectedPerson && selectedPlacement && (
        <RoomPersonSheet
          room={room}
          person={selectedPerson}
          placement={selectedPlacement}
          inRoom
          onClose={() => setSelectedId(null)}
        />
      )}

      {selectedPerson && !selectedPlacement && (
        <RoomPersonSheet
          room={room}
          person={selectedPerson}
          placement={null}
          inRoom={false}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
