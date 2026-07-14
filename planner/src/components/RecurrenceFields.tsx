import type { Recurrence, RecurrenceFreq, RRuleDay } from '../types/item'
import { FREQ_LABELS, RRULE_DAY_LABELS, RRULE_DAYS } from '../types/item'

interface RecurrenceFieldsProps {
  recurrence: Recurrence | null
  onRecurrenceChange: (r: Recurrence | null) => void
  showNoneOption?: boolean
  compact?: boolean
  defaultWeeklyDay?: RRuleDay
}

export function RecurrenceFields({
  recurrence,
  onRecurrenceChange,
  showNoneOption = true,
  compact = false,
  defaultWeeklyDay,
}: RecurrenceFieldsProps) {
  const freq = recurrence?.freq ?? 'none'

  const setFreq = (value: RecurrenceFreq | 'none') => {
    if (value === 'none') {
      onRecurrenceChange(null)
      return
    }
    onRecurrenceChange({
      freq: value,
      interval: recurrence?.interval ?? 1,
      byDay:
        value === 'weekly'
          ? (recurrence?.byDay ?? (defaultWeeklyDay ? [defaultWeeklyDay] : ['MO']))
          : undefined,
      until: recurrence?.until ?? null,
    })
  }

  const toggleByDay = (day: RRuleDay) => {
    if (!recurrence) return
    const current = recurrence.byDay ?? []
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    onRecurrenceChange({
      ...recurrence,
      byDay: next.length ? next : [day],
    })
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label
        className={`block font-medium uppercase tracking-wide text-muted ${
          compact ? 'text-[10px]' : 'text-[10px]'
        }`}
      >
        반복
      </label>
      <select
        value={freq}
        onChange={(e) => setFreq(e.target.value as RecurrenceFreq | 'none')}
        className={`w-full rounded-lg border border-hairline bg-white focus:outline-none ${
          compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'
        }`}
      >
        {showNoneOption && (
          <option value="none">{FREQ_LABELS.none}</option>
        )}
        {(Object.entries(FREQ_LABELS) as [RecurrenceFreq | 'none', string][])
          .filter(([k]) => k !== 'none')
          .map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
      </select>

      {recurrence?.freq === 'weekly' && (
        <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
          <div className="flex flex-wrap gap-1">
            {RRULE_DAYS.map((day) => {
              const selected = recurrence.byDay?.includes(day) ?? false
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleByDay(day)}
                  className={`rounded-md font-medium transition-colors ${
                    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
                  } ${
                    selected
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#636366] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {RRULE_DAY_LABELS[day]}
                </button>
              )
            })}
          </div>
          <div
            className={`flex items-center gap-2 text-[#636366] ${
              compact ? 'text-[11px]' : 'text-[12px]'
            }`}
          >
            <span>매</span>
            <input
              type="number"
              min={1}
              max={52}
              value={recurrence.interval}
              onChange={(e) =>
                onRecurrenceChange({
                  ...recurrence,
                  interval: Math.max(1, parseInt(e.target.value, 10) || 1),
                })
              }
              className={`rounded-lg border border-hairline text-center focus:outline-none ${
                compact ? 'w-12 px-1.5 py-0.5 text-[11px]' : 'w-14 px-2 py-1 text-[12px]'
              }`}
            />
            <span>주마다</span>
          </div>
        </div>
      )}

      {recurrence && recurrence.freq !== 'weekly' && (
        <div
          className={`flex items-center gap-2 text-[#636366] ${
            compact ? 'text-[11px]' : 'text-[12px]'
          }`}
        >
          <span>매</span>
          <input
            type="number"
            min={1}
            max={99}
            value={recurrence.interval}
            onChange={(e) =>
              onRecurrenceChange({
                ...recurrence,
                interval: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className={`rounded-lg border border-hairline text-center focus:outline-none ${
              compact ? 'w-12 px-1.5 py-0.5 text-[11px]' : 'w-14 px-2 py-1 text-[12px]'
            }`}
          />
          <span>
            {recurrence.freq === 'daily' && '일마다'}
            {recurrence.freq === 'monthly' && '달마다'}
            {recurrence.freq === 'yearly' && '년마다'}
          </span>
        </div>
      )}
    </div>
  )
}
