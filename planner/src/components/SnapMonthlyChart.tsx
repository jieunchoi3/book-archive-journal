interface MonthBar {
  monthKey: string
  label: string
  revenue: number
  count: number
}

interface SnapMonthlyChartProps {
  months: MonthBar[]
  selectedMonthKey: string | null
  onSelectMonth: (monthKey: string | null) => void
  formatGbp: (n: number) => string
}

const LABEL_H = 22
const CHART_H = 132

export function SnapMonthlyChart({
  months,
  selectedMonthKey,
  onSelectMonth,
  formatGbp,
}: SnapMonthlyChartProps) {
  const maxRevenue = Math.max(...months.map((m) => m.revenue), 1)

  return (
    <div className="overflow-x-auto pb-1 pt-1">
      <div
        className="flex min-w-max items-end gap-1.5 px-1"
        style={{ height: LABEL_H + CHART_H + 22 }}
      >
        {months.map((m) => {
          const h = m.revenue > 0 ? Math.max(6, (m.revenue / maxRevenue) * CHART_H) : 3
          const selected = selectedMonthKey === m.monthKey
          const showLabel = m.revenue > 0 && (selected || m.revenue === maxRevenue)
          return (
            <button
              key={m.monthKey}
              type="button"
              onClick={() => onSelectMonth(selected ? null : m.monthKey)}
              className="group flex w-10 flex-col items-center gap-0.5"
              title={`${m.label}: ${formatGbp(m.revenue)} (${m.count} shoots)`}
            >
              <span
                className={`flex h-[22px] items-end justify-center text-[8px] font-semibold leading-none ${
                  showLabel
                    ? 'text-[#007AFF]'
                    : 'text-muted opacity-0 group-hover:opacity-100'
                }`}
              >
                {m.count > 0 ? formatGbp(m.revenue) : ''}
              </span>
              <span
                className={`w-full rounded-t-md transition-colors ${
                  selected
                    ? 'bg-[#007AFF]'
                    : m.revenue > 0
                      ? 'bg-[#007AFF]/55 hover:bg-[#007AFF]/75'
                      : 'bg-[#E5E5EA]'
                }`}
                style={{ height: h }}
              />
              <span
                className={`mt-0.5 text-[9px] font-medium ${
                  selected ? 'text-[#007AFF]' : 'text-muted'
                }`}
              >
                {m.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
