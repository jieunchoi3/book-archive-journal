import { parseDateKey } from '../lib/weekUtils'
import {
  diaryEntryHasPhoto,
  diaryGridImageUrl,
  isDiaryEntryEmpty,
  type DiaryEntry,
} from '../types/diary'

interface DiaryTaggedEntriesListProps {
  label: string
  entries: DiaryEntry[]
  onOpenDay: (dateKey: string) => void
}

export function DiaryTaggedEntriesList({
  label,
  entries,
  onOpenDay,
}: DiaryTaggedEntriesListProps) {
  const sorted = [...entries].sort((a, b) => b.dateKey.localeCompare(a.dateKey))

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-white px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1C1C1E]">No notes in {label}</p>
        <p className="mt-1 text-[13px] text-muted">
          Tag a diary entry with this hashtag and it will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        {sorted.length} {sorted.length === 1 ? 'note' : 'notes'} in {label}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((entry) => {
          const imageUrl = diaryGridImageUrl(entry)
          const dateLabel = parseDateKey(entry.dateKey).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          const hasContent = !isDiaryEntryEmpty(entry) || diaryEntryHasPhoto(entry)

          return (
            <button
              key={entry.dateKey}
              type="button"
              onClick={() => onOpenDay(entry.dateKey)}
              className="overflow-hidden rounded-2xl border border-hairline bg-white text-left shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-[4/3] bg-[#F2F2F7]">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[12px] text-muted">
                    {hasContent ? 'Note' : 'Empty'}
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="text-[11px] font-medium text-muted">{dateLabel}</p>
                <p className="line-clamp-2 text-[14px] font-semibold text-[#1C1C1E]">
                  {entry.title.trim() || 'Untitled'}
                </p>
                {entry.body.trim() ? (
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-[#636366]">
                    {entry.body.trim()}
                  </p>
                ) : null}
                {(entry.mainTag || entry.subTag) && (
                  <p className="text-[11px] font-medium text-[#FF2D55]">
                    {[entry.mainTag, entry.subTag].filter(Boolean).map((t) => `#${t}`).join(' / ')}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
