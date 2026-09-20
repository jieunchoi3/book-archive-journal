import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { RoomPerson } from '../types/room'

interface MetPeopleLibraryProps {
  open: boolean
  onClose: () => void
  metPeople: RoomPerson[]
  onInvite: (personId: string) => void
  onSelectMet: (person: RoomPerson) => void
}

export function MetPeopleLibrary({
  open,
  onClose,
  metPeople,
  onInvite,
  onSelectMet,
}: MetPeopleLibraryProps) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return metPeople
    return metPeople.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.howWeMet.toLowerCase().includes(s) ||
        p.fieldIndustry.toLowerCase().includes(s),
    )
  }, [metPeople, q])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-md flex-col bg-[#FBF8F2] shadow-2xl">
        <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1C1C1E]">People you&apos;ve met</h2>
            <p className="text-[12px] text-muted">Invite who belongs in your room today</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-black/5">
            <X size={20} />
          </button>
        </header>

        <div className="border-b border-hairline px-4 py-2">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-hairline">
            <Search size={16} className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search names…"
              className="flex-1 bg-transparent text-[14px] outline-none"
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-muted">No matches</li>
          ) : (
            filtered.map((p) => (
              <li
                key={p.id}
                className="mb-1 flex items-start justify-between gap-2 rounded-2xl px-3 py-3 hover:bg-white/80"
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectMet(p)}>
                  <p className="truncate text-[15px] font-medium text-[#1C1C1E]">{p.name}</p>
                  {p.howWeMet && (
                    <p className="truncate text-[12px] text-muted">Met · {p.howWeMet}</p>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onInvite(p.id)}
                  className="shrink-0 rounded-full bg-[#007AFF] px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Invite in
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
