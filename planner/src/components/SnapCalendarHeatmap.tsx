import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SnapBooking } from '../types/snap'
import { formatGbp } from '../types/snap'
import { revenueGbp } from '../lib/snapRevenue'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

interface SnapCalendarHeatmapProps {
  bookings: SnapBooking[]
  year: number
  month: number
  selectedDateKey: string | null
  onSelectDate: (dateKey: string | null) => void
  onMonthChange: (year: number, month: number) => void
}

function heatColor(count: number): string {
  if (count <= 0) return '#F2F2F7'
  if (count === 1) return '#007AFF33'
  if (count === 2) return '#007AFF66'
  return '#007AFF'
}

export function SnapCalendarHeatmap({
  bookings,
  year,
  month,
  selectedDateKey,
  onSelectDate,
  onMonthChange,
}: SnapCalendarHeatmapProps) {
  const monthLabel = new Date(year, month, 1).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  })

  const dayMap = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; names: string[] }>()
    for (const b of bookings) {
      const key = b.date.slice(0, 10)
      const [y, m] = key.split('-').map(Number)
      if (y !== year || m !== month + 1) continue
      const cur = map.get(key) ?? { count: 0, revenue: 0, names: [] }
      cur.count += 1
      cur.revenue += revenueGbp(b)
      cur.names.push(b.customerName)
      map.set(key, cur)
    }
    return map
  }, [bookings, year, month])

  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const lastDate = new Date(year, month + 1, 0).getDate()
    const startPad = (first.getDay() + 6) % 7
    const out: Array<{ dateKey: string | null; day: number | null }> = []
    for (let i = 0; i < startPad; i++) out.push({ dateKey: null, day: null })
    for (let d = 1; d <= lastDate; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      out.push({ dateKey, day: d })
    }
    return out
  }, [year, month])

  const monthShoots = [...dayMap.values()].reduce((s, v) => s + v.count, 0)
  const monthRevenue = [...dayMap.values()].reduce((s, v) => s + v.revenue, 0)

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    onMonthChange(d.getFullYear(), d.getMonth())
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-full p-1.5 text-muted hover:bg-[#F2F2F7]"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-[#1C1C1E]">{monthLabel}</p>
          <p className="text-[11px] text-muted">
            {monthShoots}회 · {formatGbp(monthRevenue)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-full p-1.5 text-muted hover:bg-[#F2F2F7]"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-medium text-muted">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.dateKey || cell.day == null) {
            return <div key={`empty-${i}`} className="aspect-square" />
          }
          const info = dayMap.get(cell.dateKey)
          const count = info?.count ?? 0
          const selected = selectedDateKey === cell.dateKey
          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate(selected ? null : cell.dateKey)}
              title={
                count > 0
                  ? `${cell.dateKey}: ${count}회, ${formatGbp(info!.revenue)}`
                  : cell.dateKey
              }
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] transition-all ${
                selected ? 'ring-2 ring-[#007AFF] ring-offset-1' : 'hover:brightness-95'
              }`}
              style={{ backgroundColor: heatColor(count) }}
            >
              <span className={`font-medium ${count > 0 ? 'text-[#007AFF]' : 'text-muted'}`}>
                {cell.day}
              </span>
              {count > 0 && (
                <span className="text-[8px] font-semibold text-[#007AFF]">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-[#F2F2F7]" /> 없음
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-[#007AFF33]" /> 1회
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-[#007AFF66]" /> 2회
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-[#007AFF]" /> 3회+
        </span>
      </div>
    </div>
  )
}
