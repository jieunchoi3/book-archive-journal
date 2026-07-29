interface Slice {
  id: string
  label: string
  value: number
  color: string
}

interface ExpensePieChartProps {
  slices: Slice[]
  size?: number
  emptyLabel?: string
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end)
  const e = polar(cx, cy, r, start)
  const large = end - start > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${e.x} ${e.y} A ${r} ${r} 0 ${large} 0 ${s.x} ${s.y} Z`
}

export function ExpensePieChart({
  slices,
  size = 200,
  emptyLabel = 'No spending yet this month',
}: ExpensePieChartProps) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-[#F3E5D8] text-center text-[12px] text-[#8B5A2B]"
        style={{ width: size, height: size }}
      >
        <span className="px-6">{emptyLabel}</span>
      </div>
    )
  }

  let angle = 0
  const paths = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const sweep = (slice.value / total) * 360
      const start = angle
      const end = angle + sweep
      angle = end
      // Full circle edge case
      if (sweep >= 359.9) {
        return (
          <circle key={slice.id} cx={cx} cy={cy} r={r} fill={slice.color} />
        )
      }
      return (
        <path
          key={slice.id}
          d={arcPath(cx, cy, r, start, end)}
          fill={slice.color}
        />
      )
    })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {paths}
      <circle cx={cx} cy={cy} r={r * 0.52} fill="white" />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-[#1C1C1E]"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        Out
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="fill-[#8E8E93]"
        style={{ fontSize: 11 }}
      >
        {Math.round(total).toLocaleString()}
      </text>
    </svg>
  )
}
