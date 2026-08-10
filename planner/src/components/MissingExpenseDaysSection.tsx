import { Check, Wallet } from 'lucide-react'
import { parseDateKey } from '../lib/weekUtils'

interface MissingExpenseDaysSectionProps {
  missingDays: string[]
  onSelectDate: (dateKey: string) => void
  onMarkNoSpend: (dateKey: string) => void
  onMarkAllNoSpend: () => void
}

function formatDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${y}. ${m}. ${d}`
}

function formatGapLabel(dateKey: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = parseDateKey(dateKey)
  day.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000))
  if (days === 1) return '어제'
  if (days > 1 && days < 14) return `${days}일 전`
  return formatDateLong(dateKey)
}

export function MissingExpenseDaysSection({
  missingDays,
  onSelectDate,
  onMarkNoSpend,
  onMarkAllNoSpend,
}: MissingExpenseDaysSectionProps) {
  if (missingDays.length === 0) return null

  return (
    <section
      className="sticky top-0 z-20 mb-4 overflow-hidden rounded-xl border border-[#8B5A2B]/22 bg-[#FBF6F0]/95 shadow-sm backdrop-blur-md"
      aria-label="미기록 지출"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[#8B5A2B]/12 px-4 py-2.5">
        <Wallet size={14} className="shrink-0 text-[#8B5A2B]" aria-hidden />
        <h2 className="text-[12px] font-semibold tracking-wide text-[#8B5A2B]">
          미기록 날짜
        </h2>
        <span className="rounded-full bg-[#8B5A2B]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#8B5A2B]">
          {missingDays.length}
        </span>
        <p className="w-full text-[11px] text-[#8B5A2B]/80 sm:ml-auto sm:w-auto">
          지출 없으면 「지출 없음」을 눌러 주세요
        </p>
        {missingDays.length > 1 && (
          <button
            type="button"
            onClick={onMarkAllNoSpend}
            className="rounded-lg bg-[#8B5A2B]/10 px-2 py-1 text-[11px] font-medium text-[#8B5A2B] hover:bg-[#8B5A2B]/16 sm:ml-0"
          >
            모두 지출 없음
          </button>
        )}
      </div>

      <ul className="flex max-h-52 flex-col gap-1.5 overflow-y-auto px-3 py-2.5">
        {missingDays.map((dateKey) => (
          <li
            key={dateKey}
            className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 ring-1 ring-[#8B5A2B]/10"
          >
            <button
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block text-[13px] font-semibold text-[#1C1C1E]">
                {formatGapLabel(dateKey)}
              </span>
              <span className="text-[11px] text-muted">{formatDateLong(dateKey)}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className="shrink-0 rounded-lg bg-[#F2F2F7] px-2.5 py-1.5 text-[11px] font-medium text-[#48484A] hover:bg-[#E5E5EA]"
            >
              기록하기
            </button>
            <button
              type="button"
              onClick={() => onMarkNoSpend(dateKey)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#E8F8EC] px-2.5 py-1.5 text-[11px] font-medium text-[#1B7F3A] hover:bg-[#D7F0DE]"
            >
              <Check size={12} />
              지출 없음
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
