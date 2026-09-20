import { useState } from 'react'
import type { MyRoomPerson, PersonMemory } from '../../types/myRoom'
import { roomHistoryForPerson } from '../../lib/myRoomTimeline'
import type { MyRoomStore } from '../../types/myRoom'
import { RoomCharacter } from './RoomCharacter'
import { CharacterCustomizer } from './CharacterCustomizer'
import type { CharacterAppearance } from '../../types/myRoom'
import { inRoomAt } from '../../lib/myRoomTimeline'
import { todayKey } from '../../types/compass'

interface PersonProfileSheetProps {
  person: MyRoomPerson
  store: MyRoomStore
  open: boolean
  onClose: () => void
  onUpdate: (patch: Partial<MyRoomPerson>) => void
  onUpdateCharacter: (c: CharacterAppearance) => void
  onMoveMode: () => void
  onArchive: () => void
  onAddMemory: (date: string, text: string) => void
  onInvite: () => void
}

function formatDate(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

function historyLabels(history: ReturnType<typeof roomHistoryForPerson>): string[] {
  const lines: string[] = []
  let prevIn: boolean | null = null
  for (const r of history) {
    if (prevIn === null && r.inRoom) {
      lines.push(`${formatDate(r.effectiveOn)} · Entered my room`)
    } else if (prevIn === true && r.inRoom) {
      lines.push(`${formatDate(r.effectiveOn)} · Moved in the room`)
    } else if (prevIn === true && !r.inRoom) {
      lines.push(`${formatDate(r.effectiveOn)} · Left active room`)
    } else if (prevIn === false && r.inRoom) {
      lines.push(`${formatDate(r.effectiveOn)} · Returned to my room`)
    }
    prevIn = r.inRoom
  }
  return lines
}

export function PersonProfileSheet({
  person,
  store,
  open,
  onClose,
  onUpdate,
  onUpdateCharacter,
  onArchive,
  onAddMemory,
  onInvite,
}: PersonProfileSheetProps) {
  const [tab, setTab] = useState<'profile' | 'customize' | 'memory'>('profile')
  const [memText, setMemText] = useState('')
  const [memDate, setMemDate] = useState(todayKey())
  const [editName, setEditName] = useState(false)
  const [name, setName] = useState(person.name)

  if (!open) return null

  const inRoom = inRoomAt(person.id, store.positionHistory, todayKey())
  const history = roomHistoryForPerson(person.id, store.positionHistory)
  const memories = store.memories.filter((m) => m.personId === person.id)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[#FAF7F2] p-5 shadow-xl sm:rounded-2xl">
        <div className="flex flex-col items-center gap-2 border-b border-[#E8DFD4] pb-4">
          <RoomCharacter appearance={person.character} scale={1.2} />
          {editName ? (
            <input
              className="my-room-input text-center"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                onUpdate({ name: name.trim() || person.name })
                setEditName(false)
              }}
            />
          ) : (
            <h2 className="my-room-serif text-xl text-[#3D3229]">{person.name}</h2>
          )}
          <p className="text-sm text-[#8B7355]">{person.relationship}</p>
        </div>

        <div className="mt-3 flex gap-2 text-xs">
          {(['profile', 'customize', 'memory'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 capitalize ${
                tab === t ? 'bg-[#5C4A3A] text-white' : 'bg-[#EDE6DC] text-[#5C4A3A]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="mt-4 space-y-4 text-sm text-[#5C4A3A]">
            <div>
              <p className="text-xs font-semibold uppercase text-[#8B7355]">Met</p>
              <p>{formatDate(person.dateMet)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#8B7355]">Last met</p>
              <p>{formatDate(person.lastMet)}</p>
            </div>
            {person.valueNote && (
              <blockquote className="border-l-2 border-[#C4A882] pl-3 italic text-[#3D3229]">
                {person.valueNote}
              </blockquote>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[#8B7355]">Room history</p>
              <ul className="space-y-1 text-xs">
                {historyLabels(history).map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {history.length === 0 && <li className="text-[#8B7355]">Not in room yet</li>}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {!inRoom && (
                <button type="button" className="my-room-primary-btn text-xs" onClick={onInvite}>
                  Invite into room
                </button>
              )}
              {inRoom && (
                <button type="button" className="my-room-ghost-btn text-xs" onClick={onArchive}>
                  Archive from room
                </button>
              )}
              <button type="button" className="my-room-ghost-btn text-xs" onClick={() => setEditName(true)}>
                Edit name
              </button>
            </div>
          </div>
        )}

        {tab === 'customize' && (
          <div className="mt-4">
            <CharacterCustomizer
              title={person.name}
              value={person.character}
              onChange={onUpdateCharacter}
            />
          </div>
        )}

        {tab === 'memory' && (
          <div className="mt-4 space-y-4">
            <MemoryList items={memories} />
            <label className="block">
              <span className="text-xs font-medium text-[#8B7355]">Date</span>
              <input
                type="date"
                className="my-room-input mt-1"
                value={memDate}
                onChange={(e) => setMemDate(e.target.value)}
              />
            </label>
            <textarea
              className="my-room-input min-h-[80px]"
              placeholder="A moment you want to remember…"
              value={memText}
              onChange={(e) => setMemText(e.target.value)}
            />
            <button
              type="button"
              className="my-room-primary-btn w-full"
              disabled={!memText.trim()}
              onClick={() => {
                onAddMemory(memDate, memText)
                setMemText('')
              }}
            >
              Add memory
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MemoryList({ items }: { items: PersonMemory[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[#8B7355]">No memories yet.</p>
  }
  return (
    <ul className="space-y-3">
      {[...items].reverse().map((m) => (
        <li key={m.id} className="rounded-xl bg-[#F7F2EB] p-3 text-sm">
          <p className="text-xs text-[#8B7355]">
            {new Date(m.date).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="mt-1 text-[#3D3229]">{m.text}</p>
        </li>
      ))}
    </ul>
  )
}
