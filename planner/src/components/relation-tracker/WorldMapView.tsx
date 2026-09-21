import { useMemo, useState } from 'react'
import { ArrowLeft, List, Map as MapIcon } from 'lucide-react'
import type { RelationPerson } from '../../types/relationTracker'
import { MiiAvatar } from './MiiAvatar'
import { PersonProfileCard } from './PersonProfileCard'

/** Equirectangular projection aligned with public/world-map.svg (950×620). */
function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * 100
  const y = ((90 - lat) / 180) * 100
  return { x, y }
}

interface WorldMapViewProps {
  people: RelationPerson[]
  onBack: () => void
  onEditPerson: (id: string) => void
  onDeletePerson: (id: string) => void
}

export function WorldMapView({
  people,
  onBack,
  onEditPerson,
  onDeletePerson,
}: WorldMapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listMode, setListMode] = useState(false)
  const selected = people.find((p) => p.id === selectedId)

  const pins = useMemo(
    () =>
      people.filter(
        (p) => typeof p.lat === 'number' && typeof p.lng === 'number',
      ),
    [people],
  )

  const stats = useMemo(() => {
    const countries = new Set(
      people.map((p) => p.countryCode ?? p.location.split(',').pop()?.trim()),
    )
    return {
      count: people.length,
      countries: countries.size,
    }
  }, [people])

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-1 flex-col bg-[#F9F8F3]">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#48484A]"
        >
          <ArrowLeft size={18} />
          Room
        </button>
        <h1 className="font-serif text-[17px] font-semibold text-[#1C1C1E]">
          My people around the world
        </h1>
        <button
          type="button"
          onClick={() => setListMode((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] shadow-sm"
        >
          {listMode ? <MapIcon size={14} /> : <List size={14} />}
          {listMode ? 'Map' : 'List'}
        </button>
      </header>

      <div className="relative flex flex-1 flex-col p-4 pb-28">
        {!listMode ? (
          <div className="relative mx-auto w-full max-w-4xl flex-1">
            <div
              className="relative aspect-[950/620] w-full overflow-hidden rounded-2xl border border-[#d8e4d8] bg-[#e8f2e8] shadow-[inset_0_2px_12px_rgba(0,0,0,0.04)]"
              role="img"
              aria-label="World map showing where your people live"
            >
              <img
                src="/world-map.svg"
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
              {pins.map((p) => {
                const { x, y } = project(p.lat!, p.lng!)
                const active = selectedId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`absolute z-10 -translate-x-1/2 -translate-y-full transition-transform ${
                      active ? 'scale-110' : 'hover:scale-105'
                    }`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => setSelectedId(active ? null : p.id)}
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={`mb-0.5 block h-2 w-2 rounded-full ${
                          active ? 'bg-[#6B8F71]' : 'bg-[#6B8F71]/70'
                        }`}
                      />
                      <MiiAvatar avatar={p.avatar} size={44} />
                      <span className="mt-1 max-w-[96px] truncate rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-medium shadow-sm">
                        {p.city ?? p.name}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            {selected && (
              <div className="absolute right-4 top-4 z-20 max-w-[min(280px,calc(100%-2rem))] sm:right-6 sm:top-6">
                <PersonProfileCard
                  person={selected}
                  compact
                  onEdit={() => onEditPerson(selected.id)}
                  onDelete={() => {
                    onDeletePerson(selected.id)
                    setSelectedId(null)
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <ul className="mx-auto w-full max-w-lg space-y-2">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                <MiiAvatar avatar={p.avatar} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[#1C1C1E]">{p.name}</p>
                  <p className="truncate text-[12px] text-muted">{p.location}</p>
                </div>
                <span className="text-[12px] text-muted">{p.relationshipType}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-center font-serif text-[15px] italic text-[#636366]">
          Different places, same room.
        </p>
      </div>

      <div className="fixed inset-x-4 bottom-20 z-10 mx-auto flex max-w-xl items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-lg">
        <span className="text-[13px] text-[#48484A]">
          {stats.count} people · {stats.countries} countries
        </span>
        <span className="font-serif text-[12px] italic text-muted">
          Good people are everywhere.
        </span>
      </div>
    </div>
  )
}
