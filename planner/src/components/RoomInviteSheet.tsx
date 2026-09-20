import { useState } from 'react'
import type { RoomActions } from '../hooks/useRoom'

interface RoomInviteSheetProps {
  room: RoomActions
  onClose: () => void
}

export function RoomInviteSheet({ room, onClose }: RoomInviteSheetProps) {
  const [name, setName] = useState('')
  const [how, setHow] = useState('')
  const [note, setNote] = useState('')

  const submit = async () => {
    await room.invitePerson({ name, howWeMet: how, note })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-[#FBF8F2] p-5 shadow-xl">
        <h2 className="mb-1 text-[18px] font-semibold">Invite to the door</h2>
        <p className="mb-4 text-[13px] text-muted">
          New people start at the door — you choose how much room they take.
        </p>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-2 w-full rounded-xl border border-hairline bg-white px-3 py-2 text-[14px]"
        />
        <input
          placeholder="How you met (optional)"
          value={how}
          onChange={(e) => setHow(e.target.value)}
          className="mb-2 w-full rounded-xl border border-hairline bg-white px-3 py-2 text-[14px]"
        />
        <textarea
          placeholder="Why might they matter? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mb-4 w-full rounded-xl border border-hairline bg-white px-3 py-2 text-[14px]"
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-xl px-4 py-2 text-[13px] text-muted" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            className="rounded-xl bg-[#007AFF] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            onClick={() => void submit()}
          >
            Place at door
          </button>
        </div>
      </div>
    </div>
  )
}
