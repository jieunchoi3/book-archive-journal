import { useState } from 'react'
import type { RoomActions } from '../hooks/useRoom'
import type { RoomPerson, RoomPlacementPayload } from '../types/room'
import { placementSummary } from './RoomCanvas'
import { zoneLabel } from '../lib/roomReconstruct'

interface RoomPersonSheetProps {
  room: RoomActions
  person: RoomPerson
  placement: RoomPlacementPayload
  onClose: () => void
}

export function RoomPersonSheet({ room, person, placement, onClose }: RoomPersonSheetProps) {
  const [note, setNote] = useState(person.note)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#FBF8F2] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-[#1C1C1E]">{person.name}</h2>
            <p className="text-[13px] text-muted">{placementSummary(placement)}</p>
          </div>
          <button type="button" className="text-[13px] text-[#007AFF]" onClick={onClose}>
            Done
          </button>
        </div>

        {person.howWeMet && (
          <p className="mb-2 text-[13px]">
            <span className="font-medium text-[#636366]">How you met · </span>
            {person.howWeMet}
          </p>
        )}
        {person.fieldIndustry && (
          <p className="mb-2 text-[13px] text-[#3C3C43]">{person.fieldIndustry}</p>
        )}
        {person.location && (
          <p className="mb-2 text-[13px] text-muted">{person.location}</p>
        )}
        {person.mbti && (
          <p className="mb-3 text-[12px] text-muted">MBTI · {person.mbti}</p>
        )}

        <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[#C7A882]">
          Notes
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => void room.updatePerson(person.id, { note })}
          rows={5}
          className="mb-4 w-full rounded-2xl border border-hairline bg-white px-3 py-2 text-[14px]"
        />

        <div className="flex flex-wrap gap-2">
          <ActionBtn onClick={() => void room.logContact(person.id)} label="Log contact today" />
          <ActionBtn
            onClick={() =>
              void room.movePerson(person.id, {
                ...placement,
                zone: 'inner',
                x: 0.5,
                y: 0.46,
                emotionalPresence: 'close',
              })
            }
            label="Move closer"
          />
          <ActionBtn onClick={() => void room.markHistorical(person.id)} label="Archive influence" />
          <ActionBtn
            variant="danger"
            onClick={() => {
              if (confirm(`Remove ${person.name} from your room?`)) {
                void room.deletePerson(person.id)
                onClose()
              }
            }}
            label="Remove"
          />
        </div>

        <p className="mt-4 text-[11px] text-muted">
          {zoneLabel(placement.zone)} — spatial, not a score. Contact frequency and closeness stay
          separate.
        </p>
      </div>
    </div>
  )
}

function ActionBtn({
  onClick,
  label,
  variant = 'default',
}: {
  onClick: () => void
  label: string
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
        variant === 'danger'
          ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
          : 'bg-white text-[#007AFF] ring-1 ring-hairline'
      }`}
    >
      {label}
    </button>
  )
}
