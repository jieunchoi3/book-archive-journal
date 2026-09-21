import type { RelationPerson } from '../../types/relationTracker'

interface CheckInItem {
  person: RelationPerson
  days: number
  freq: string
}

interface CheckInBannerProps {
  items: CheckInItem[]
  onReachOut: (id: string) => void
  onLater: (id: string) => void
}

function freqLabel(freq: string) {
  if (freq === 'weekly') return 'every week or so'
  if (freq === 'monthly') return 'every couple of months'
  return 'every few months'
}

export function CheckInBanner({
  items,
  onReachOut,
  onLater,
}: CheckInBannerProps) {
  if (items.length === 0) return null

  return (
    <div className="border-b border-hairline bg-[#F9F8F3]/95 px-4 py-3 text-[13px] leading-relaxed text-[#48484A] backdrop-blur-sm">
      <p className="mb-2 font-medium text-[#1C1C1E]">
        Check in — a few people you may want to reconnect with.
      </p>
      <div className="space-y-2">
        {items.slice(0, 2).map(({ person, days, freq }) => (
          <div key={person.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              <strong>{person.name}</strong>
              {' · '}
              Last interaction · {days} days ago.
              {freq && (
                <span className="text-muted">
                  {' '}
                  You wanted to stay in touch {freqLabel(freq)}.
                </span>
              )}
            </span>
            <span className="inline-flex gap-1.5">
              <button
                type="button"
                onClick={() => onReachOut(person.id)}
                className="rounded-full border border-[#6B8F71] px-2.5 py-0.5 text-[12px] font-medium text-[#4a5f4d] hover:bg-[#6B8F71]/10"
              >
                Reach out
              </button>
              <button
                type="button"
                onClick={() => onLater(person.id)}
                className="rounded-full border border-hairline px-2.5 py-0.5 text-[12px] text-muted hover:bg-white"
              >
                Later
              </button>
            </span>
          </div>
        ))}
      </div>
      {items.length > 2 && (
        <button type="button" className="mt-2 text-[12px] text-[#6B8F71] underline">
          See all
        </button>
      )}
    </div>
  )
}
