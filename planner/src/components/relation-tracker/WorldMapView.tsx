import { useMemo, useState } from 'react'
import { ArrowLeft, List, Map as MapIcon } from 'lucide-react'
import type { RelationPerson } from '../../types/relationTracker'
import { MiiAvatar } from './MiiAvatar'
import { PersonProfileCard } from './PersonProfileCard'

/** Simple equirectangular projection for minimal map pins */
function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * 100
  const y = ((90 - lat) / 180) * 100
  return { x, y }
}

interface WorldMapViewProps {
  people: RelationPerson[]
  onBack: () => void
  onEditPerson: (id: string) => void
}

export function WorldMapView({
  people,
  onBack,
  onEditPerson,
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
          <div className="relative mx-auto aspect-[2/1] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-inner">
            <svg
              viewBox="0 0 1000 500"
              className="h-full w-full text-[#d4e4d4]"
              aria-label="World map"
            >
              <rect width="1000" height="500" fill="#f0f4ef" />
              <path
                fill="currentColor"
                d="M158,120c20-8,45-5,62,8,18,14,28,38,24,60-6,32-38,48-68,42-28-6-48-32-44-58,3-22,18-42,26-52zm720,80c15-12,38-18,58-10,22,8,38,30,36,52-2,24-22,44-46,48-26,4-52-12-58-36-6-24,4-48,10-54zM420,180c-8-15-5-35,8-48,14-14,36-20,55-14,22,8,36,30,32,52-4,26-30,44-54,40-20-4-36-18-41-30zm-180,200c12-8,28-10,42-4,16,6,28,22,26,38-2,18-18,32-36,34-20,2-38-10-44-28-6-18,2-36,12-40zm520,20c10-6,24-8,36-2,14,6,24,20,22,34-2,16-16,28-32,28-16,0-30-12-32-28-2-14,4-28,6-32z"
              />
              <ellipse cx="500" cy="250" rx="480" ry="230" fill="none" stroke="#e5e5ea" strokeWidth="1" />
            </svg>
            {pins.map((p) => {
              const { x, y } = project(p.lat!, p.lng!)
              return (
                <button
                  key={p.id}
                  type="button"
                  className="absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="flex flex-col items-center">
                    <MiiAvatar avatar={p.avatar} size={40} />
                    <span className="mt-0.5 max-w-[80px] truncate rounded bg-white/90 px-1.5 py-0.5 text-[10px] shadow-sm">
                      {p.city ?? p.name}
                    </span>
                  </div>
                </button>
              )
            })}
            {selected && (
              <div className="absolute right-3 top-3 z-10 max-w-[280px]">
                <PersonProfileCard
                  person={selected}
                  compact
                  onEdit={() => onEditPerson(selected.id)}
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
