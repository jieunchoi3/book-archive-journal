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

export function SnapMonthlyChart({
  months,
  selectedMonthKey,
  onSelectMonth,
  formatGbp,
}: SnapMonthlyChartProps) {
  const maxRevenue = Math.max(...months.map((m) => m.revenue), 1)
  const chartHeight = 120

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-end gap-1.5 px-1" style={{ height: chartHeight + 28 }}>
        {months.map((m) => {
          const h = m.revenue > 0 ? Math.max(4, (m.revenue / maxRevenue) * chartHeight) : 2
          const selected = selectedMonthKey === m.monthKey
          return (
            <button
              key={m.monthKey}
              type="button"
              onClick={() => onSelectMonth(selected ? null : m.monthKey)}
              className="group flex w-9 flex-col items-center gap-1"
              title={`${m.label}: ${formatGbp(m.revenue)} (${m.count} shoots)`}
            >
              <span className="text-[9px] font-medium text-muted opacity-0 transition-opacity group-hover:opacity-100">
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
                className={`text-[9px] font-medium ${
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
