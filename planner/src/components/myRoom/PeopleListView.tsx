import { useState } from 'react'
import type { MyRoomStore } from '../../types/myRoom'
import { RELATIONSHIP_OPTIONS, defaultCharacter } from '../../types/myRoom'
import { inRoomAt } from '../../lib/myRoomTimeline'
import { todayKey } from '../../types/compass'
import { RoomCharacter } from './RoomCharacter'
import type { MyRoomActions } from '../../hooks/useMyRoom'

interface PeopleListViewProps {
  store: MyRoomStore
  onSelect: (id: string) => void
  onInviteMet: (id: string) => void
  onCreateMet?: MyRoomActions['createPerson']
}

export function PeopleListView({
  store,
  onSelect,
  onInviteMet,
  onCreateMet,
}: PeopleListViewProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState<string>(RELATIONSHIP_OPTIONS[0])

  const today = todayKey()

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] px-4 pb-24 pt-20">
      <p className="mb-4 text-sm text-[#5C4A3A]">
        Everyone you&apos;ve met lives here. Only some need to be in your room right now.
      </p>

      {adding && (
        <div className="mb-4 rounded-xl border border-[#E8DFD4] bg-white p-4">
          <input
            className="my-room-input mb-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="my-room-input mb-3"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="my-room-primary-btn flex-1 text-xs"
              disabled={!name.trim() || !onCreateMet}
              onClick={() => {
                onCreateMet?.({
                  name: name.trim(),
                  relationship,
                  dateMet: null,
                  lastMet: null,
                  valueNote: '',
                  character: defaultCharacter(),
                  inviteToRoom: false,
                })
                setName('')
                setAdding(false)
              }}
            >
              Save to met list
            </button>
            <button type="button" className="my-room-ghost-btn text-xs" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="mb-4 text-sm text-[#5C4A3A] underline"
        onClick={() => setAdding(true)}
      >
        + Add someone I&apos;ve met (not in room yet)
      </button>

      <ul className="space-y-2">
        {store.people.map((p) => {
          const inRoom = inRoomAt(p.id, store.positionHistory, today)
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl bg-[#F7F2EB] p-3"
            >
              <RoomCharacter appearance={p.character} scale={0.55} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="my-room-serif text-left text-base text-[#3D3229]"
                  onClick={() => onSelect(p.id)}
                >
                  {p.name}
                </button>
                <p className="text-xs text-[#8B7355]">
                  {p.relationship}
                  {inRoom ? ' · In your room' : ' · Met only'}
                </p>
              </div>
              {!inRoom && (
                <button
                  type="button"
                  className="my-room-primary-btn shrink-0 text-xs py-1.5"
                  onClick={() => onInviteMet(p.id)}
                >
                  Invite
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {store.people.length === 0 && (
        <p className="text-center text-sm text-[#8B7355]">No one here yet.</p>
      )}
    </div>
  )
}
