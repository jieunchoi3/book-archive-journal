import { formatMoney } from '../types/expense'

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
  highlightedId?: string | null
  onHighlightChange?: (id: string | null) => void
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
  highlightedId = null,
  onHighlightChange,
}: ExpensePieChartProps) {
  const active = slices.filter((s) => s.value > 0)
  const total = active.reduce((a, s) => a + s.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  const holeR = r * 0.52
  const highlighted = highlightedId
    ? (active.find((s) => s.id === highlightedId) ?? null)
    : null

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

  const bindSlice = (id: string) =>
    onHighlightChange
      ? {
          onPointerEnter: () => onHighlightChange(id),
          onPointerLeave: () => onHighlightChange(null),
        }
      : {}

  if (active.length === 1) {
    const only = active[0]!
    const dimmed = highlightedId != null && highlightedId !== only.id
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 overflow-visible"
        role="img"
        aria-label="Spending breakdown chart"
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={only.color}
          opacity={dimmed ? 0.35 : 1}
          className={`transition-opacity duration-150 ${onHighlightChange ? 'cursor-pointer' : ''}`}
          {...bindSlice(only.id)}
        />
        <circle cx={cx} cy={cy} r={holeR} fill="white" pointerEvents="none" />
        <ChartCenter cx={cx} cy={cy} total={total} highlighted={highlighted} />
      </svg>
    )
  }

  let angle = 0
  const paths = active.map((slice, index) => {
    const start = angle
    const isLast = index === active.length - 1
    const end = isLast ? 360 : angle + (slice.value / total) * 360
    angle = end

    const isHighlighted = highlightedId === slice.id
    const dimmed = highlightedId != null && !isHighlighted
    const d = slicePath(cx, cy, r, start, end)
    const common = {
      fill: slice.color,
      opacity: dimmed ? 0.35 : 1,
      className: `transition-all duration-150 ${onHighlightChange ? 'cursor-pointer' : ''}`,
      ...bindSlice(slice.id),
    }

    if (!d) {
      return <circle key={slice.id} cx={cx} cy={cy} r={r} {...common} />
    }

    return (
      <path
        key={slice.id}
        d={d}
        {...common}
        transform={
          isHighlighted
            ? `translate(${cx} ${cy}) scale(1.04) translate(${-cx} ${-cy})`
            : undefined
        }
      />
    )
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
      <circle cx={cx} cy={cy} r={holeR} fill="white" pointerEvents="none" />
      <ChartCenter cx={cx} cy={cy} total={total} highlighted={highlighted} />
    </svg>
  )
}

function ChartCenter({
  cx,
  cy,
  total,
  highlighted,
}: {
  cx: number
  cy: number
  total: number
  highlighted: Slice | null
}) {
  const title = highlighted?.label ?? 'Out'
  const titleSize = highlighted && highlighted.label.length > 12 ? 10 : 13

  return (
    <g pointerEvents="none">
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-[#1C1C1E]"
        style={{ fontSize: titleSize, fontWeight: 600 }}
      >
        {title.length > 18 ? `${title.slice(0, 17)}…` : title}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="fill-[#8E8E93]"
        style={{ fontSize: 11 }}
      >
        {highlighted
          ? formatMoney(highlighted.value)
          : Math.round(total).toLocaleString()}
      </text>
    </g>
  )
}
