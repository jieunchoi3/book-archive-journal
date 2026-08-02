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

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, startAngle)
  const end = polar(cx, cy, r, endAngle)
  const sweep = endAngle - startAngle
  if (sweep >= 359.99) {
    return null
  }
  const largeArc = sweep > 180 ? 1 : 0
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

export function ExpensePieChart({
  slices,
  size = 200,
  emptyLabel = 'No spending yet this month',
}: ExpensePieChartProps) {
  const active = slices.filter((s) => s.value > 0)
  const total = active.reduce((a, s) => a + s.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  const holeR = r * 0.52

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

  if (active.length === 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 overflow-visible"
        role="img"
        aria-label="Spending breakdown chart"
      >
        <circle cx={cx} cy={cy} r={r} fill={active[0]!.color} />
        <circle cx={cx} cy={cy} r={holeR} fill="white" />
        <ChartCenter cx={cx} cy={cy} total={total} />
      </svg>
    )
  }

  let angle = 0
  const paths = active.map((slice, index) => {
    const start = angle
    const isLast = index === active.length - 1
    const end = isLast ? 360 : angle + (slice.value / total) * 360
    angle = end

    const d = slicePath(cx, cy, r, start, end)
    if (!d) {
      return <circle key={slice.id} cx={cx} cy={cy} r={r} fill={slice.color} />
    }
    return <path key={slice.id} d={d} fill={slice.color} />
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label="Spending breakdown chart"
    >
      {paths}
      <circle cx={cx} cy={cy} r={holeR} fill="white" />
      <ChartCenter cx={cx} cy={cy} total={total} />
    </svg>
  )
}

function ChartCenter({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <>
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
    </>
  )
}
