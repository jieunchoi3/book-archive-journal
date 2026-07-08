import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  formatMonthYear,
  getMonthGrid,
  getMonthYearFromWeekStart,
  getTodayKey,
  parseDateKey,
  weekStartFromDateKey,
} from '../lib/weekUtils'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthCalendarPopoverProps {
  weekStart: string
  open: boolean
  onClose: () => void
  onSelectWeek: (weekStart: string) => void
}

export function MonthCalendarPopover({
  weekStart,
  open,
  onClose,
  onSelectWeek,
}: MonthCalendarPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [viewMonth, setViewMonth] = useState(() => getMonthYearFromWeekStart(weekStart))

  useEffect(() => {
    if (open) {
      setViewMonth(getMonthYearFromWeekStart(weekStart))
    }
  }, [open, weekStart])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const { year, month } = viewMonth
  const weeks = getMonthGrid(year, month)
  const todayKey = getTodayKey()

  const goPrevMonth = () => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const goNextMonth = () => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const handleDateClick = (dateKey: string) => {
    onSelectWeek(weekStartFromDateKey(dateKey))
    onClose()
  }

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-2xl border border-hairline bg-[#FDFCF9] p-3 shadow-lg"
      role="dialog"
      aria-label="Month calendar"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white hover:text-[#48484A]"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-semibold text-[#1C1C1E]">
          {formatMonthYear(year, month)}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white hover:text-[#48484A]"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0 px-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="space-y-0.5">
        {weeks.map((week) => {
          const isActiveWeek = week[0].dateKey === weekStart
          return (
            <div
              key={week[0].dateKey}
              className={`grid grid-cols-7 rounded-lg ${
                isActiveWeek ? 'bg-[#E4F2E4]' : ''
              }`}
            >
              {week.map(({ dateKey, inMonth }) => {
                const isToday = dateKey === todayKey
                const dayNum = parseDateKey(dateKey).getDate()

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => handleDateClick(dateKey)}
                    className="flex h-8 items-center justify-center"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-medium tabular-nums transition-colors ${
                        isToday
                          ? 'bg-[#3D8B40] text-white'
                          : inMonth
                            ? 'text-[#1C1C1E] hover:bg-white/70'
                            : 'text-[#C7C7CC] hover:bg-white/50 hover:text-[#8E8E93]'
                      }`}
                    >
                      {dayNum}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface MonthCalendarTriggerProps {
  weekStart: string
  label: string
  onSelectWeek: (weekStart: string) => void
}

export function MonthCalendarTrigger({
  weekStart,
  label,
  onSelectWeek,
}: MonthCalendarTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-[#F2F2F7]"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="text-muted group-hover:text-[#48484A]"
          aria-hidden
        >
          <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="5" y1="1.5" x2="5" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="11" y1="1.5" x2="11" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-[13px] text-muted group-hover:text-[#48484A]">{label}</span>
      </button>

      <MonthCalendarPopover
        weekStart={weekStart}
        open={open}
        onClose={() => setOpen(false)}
        onSelectWeek={onSelectWeek}
      />
    </div>
  )
}
