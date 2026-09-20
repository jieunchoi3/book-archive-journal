import type { MyRoomStore } from '../../types/myRoom'
import { peopleInRoom } from '../../lib/myRoomTimeline'

interface HistoryViewProps {
  store: MyRoomStore
  onOpenDate: (date: string) => void
}

export function HistoryView({ store, onOpenDate }: HistoryViewProps) {
  const snapshotRows = store.snapshots.map((s) => ({
    date: s.savedOn,
    label: s.label,
    count: s.positions.length,
    kind: 'snapshot' as const,
  }))

  const historyDates = [...new Set(store.positionHistory.map((r) => r.effectiveOn))].map(
    (date) => ({
      date,
      label: `Room · ${date}`,
      count: peopleInRoom(store.people, store.positionHistory, date).length,
      kind: 'auto' as const,
    }),
  )

  const merged = [...snapshotRows, ...historyDates]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(
      (row, i, arr) => arr.findIndex((x) => x.date === row.date && x.label === row.label) === i,
    )

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] px-4 pb-24 pt-20">
      <p className="mb-4 text-sm text-[#5C4A3A]">
        Revisit moments when your room looked different — reconstructed from your saved positions.
      </p>
      <ul className="space-y-2">
        {merged.map((row) => (
          <li key={`${row.date}-${row.label}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl bg-[#F7F2EB] px-4 py-3 text-left"
              onClick={() => onOpenDate(row.date)}
            >
              <div>
                <p className="my-room-serif text-[#3D3229]">
                  {new Date(row.date).toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-[#8B7355]">{row.label}</p>
              </div>
              <span className="text-sm text-[#5C4A3A]">{row.count} people</span>
            </button>
          </li>
        ))}
      </ul>
      {merged.length === 0 && (
        <p className="text-center text-sm text-[#8B7355]">
          History will appear as you invite people and move them around.
        </p>
      )}
    </div>
  )
}
