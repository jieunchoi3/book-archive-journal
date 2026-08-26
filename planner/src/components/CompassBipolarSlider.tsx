import { useRef, type KeyboardEvent } from 'react'
import { COMPASS } from '../types/compass'

/** Bipolar slider −5…+5 with zero snap — shared by Goodtime & Prototype */
export function CompassBipolarSlider({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  disabled?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const setFromClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el || disabled) return
    const r = el.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    let v = Math.round(t * 10 - 5)
    if (Math.abs(v) === 0 || (t > 0.45 && t < 0.55)) v = 0
    onChange(Math.max(-5, Math.min(5, v)))
  }

  const onKey = (e: KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(-5, value - 1))
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(5, value + 1))
    }
    if (e.key === 'Home') {
      e.preventDefault()
      onChange(0)
    }
  }

  const pct = ((value + 5) / 10) * 100
  const fillLeft = value >= 0 ? 50 : pct
  const fillWidth = Math.abs(value) * 10

  return (
    <div className="flex w-[130px] shrink-0 flex-col items-center gap-0.5">
      <span className="text-[10px] tabular-nums text-[#8A847E]">
        {label} {value > 0 ? `+${value}` : value}
      </span>
      <div
        ref={trackRef}
        role="slider"
        aria-label={label}
        aria-valuemin={-5}
        aria-valuemax={5}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        className="relative h-4 w-full cursor-pointer touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E6B5E]"
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (disabled) return
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          setFromClientX(e.clientX)
        }}
        onPointerMove={(e) => {
          if (disabled || !e.buttons) return
          setFromClientX(e.clientX)
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#ECE7E2]" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{
            left: `${fillLeft}%`,
            width: `${fillWidth}%`,
            background: value >= 0 ? COMPASS.accent : '#B5AFA8',
          }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1C1B1A] shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}
