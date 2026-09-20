import { useMemo, useState } from 'react'
import { Home, Plus, RefreshCw, Sparkles } from 'lucide-react'
import type { RoomActions } from '../hooks/useRoom'
import { RoomCanvas } from './RoomCanvas'
import { RoomPersonSheet } from './RoomPersonSheet'
import { RoomInviteSheet } from './RoomInviteSheet'
import { todayKey } from '../types/compass'
import { distanceFromCenter, placementsForAll } from '../lib/roomReconstruct'
import { ROOM_REFLECTION_PROMPTS } from '../types/room'

interface RelationsViewProps {
  room: RoomActions
}

export function RelationsView({ room }: RelationsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const today = todayKey()

  const selectedPerson = room.store.people.find((p) => p.id === selectedId) ?? null
  const selectedPlacement = selectedId ? room.placements.get(selectedId) : null

  const timelineHint = useMemo(() => {
    if (room.asOf === today) return null
    const then = placementsForAll(room.store.people, room.store.events, room.asOf)
    const now = room.placements
    let closer = 0
    let farther = 0
    for (const p of room.store.people) {
      const a = then.get(p.id)
      const b = now.get(p.id)
      if (!a || !b) continue
      const da = distanceFromCenter(a)
      const db = distanceFromCenter(b)
      if (db < da - 0.02) closer++
      if (db > da + 0.02) farther++
    }
    return { closer, farther }
  }, [room.asOf, room.placements, room.store.events, room.store.people, today])

  const reflectionPrompt =
    ROOM_REFLECTION_PROMPTS[
      Math.floor(Date.now() / 86_400_000) % ROOM_REFLECTION_PROMPTS.length
    ]

  return (
    <div className="min-h-screen bg-[#FBF8F2] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 sm:pb-24">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFEB] text-[#3E6B5E] shadow-sm">
            <Home size={22} />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">My Room</h1>
            <p className="text-[13px] text-muted">Who is in your room right now?</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void room.refresh()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-hairline"
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={room.loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1 rounded-2xl bg-[#007AFF] px-3 py-2 text-[13px] font-semibold text-white"
          >
            <Plus size={16} />
            Invite
          </button>
        </div>
      </header>

      {room.syncError && (
        <div className="mb-3 rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-[12px] text-[#FF3B30]">
          Sync issue: {room.syncError}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-hairline">
        <label className="text-[12px] font-medium text-[#636366]">
          Time travel
          <input
            type="date"
            value={room.asOf}
            max={today}
            onChange={(e) => room.setAsOf(e.target.value || today)}
            className="ml-2 rounded-lg border border-hairline px-2 py-1 text-[13px]"
          />
        </label>
        {room.asOf !== today && (
          <button
            type="button"
            className="text-[12px] font-semibold text-[#007AFF]"
            onClick={() => room.setAsOf(today)}
          >
            Back to today
          </button>
        )}
        {timelineHint && (timelineHint.closer > 0 || timelineHint.farther > 0) && (
          <p className="text-[12px] text-muted">
            Since {room.asOf}: {timelineHint.closer} moved closer · {timelineHint.farther} moved
            farther
          </p>
        )}
        <span className="text-[12px] text-muted">{room.store.people.length} people</span>
      </div>

      {room.gentleNudges.length > 0 && (
        <div className="mb-3 space-y-2">
          {room.gentleNudges.slice(0, 2).map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-[#FFF9F0] px-4 py-3 text-[13px] ring-1 ring-[#E8D5C4]"
            >
              <p className="text-[#3C3C43]">
                {p.name} has been quiet lately. Would you like to check in?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-[12px] font-semibold text-[#007AFF]"
                  onClick={() => {
                    setSelectedId(p.id)
                    void room.logContact(p.id)
                  }}
                >
                  Log contact
                </button>
                <button
                  type="button"
                  className="text-[12px] text-muted"
                  onClick={() => void room.snoozeNudge(p.id, 30)}
                >
                  Remind later
                </button>
                <button
                  type="button"
                  className="text-[12px] text-muted"
                  onClick={() => void room.dismissNudge(p.id)}
                >
                  Not now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-start gap-2 rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-hairline">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-[#C7A882]" />
        <p className="text-[13px] text-[#636366]">{reflectionPrompt}</p>
      </div>

      <RoomCanvas
        people={room.store.people}
        placements={room.placements}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMove={(id, placement) => void room.movePerson(id, placement)}
      />

      <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 ring-1 ring-hairline"
          onClick={() => void room.importNotion()}
        >
          Re-import Notion list
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 ring-1 ring-hairline"
          onClick={() => void room.importFromCompassTeam()}
        >
          Import from Compass team
        </button>
      </div>

      {inviteOpen && <RoomInviteSheet room={room} onClose={() => setInviteOpen(false)} />}
      {selectedPerson && selectedPlacement && (
        <RoomPersonSheet
          room={room}
          person={selectedPerson}
          placement={selectedPlacement}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
