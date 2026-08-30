import { useCallback, useRef, useState } from 'react'
import { hexToHsl, hslToHex, normalizeHexColor } from '../types/taste'

interface ColourWheelPickerProps {
  value: string
  onChange: (hex: string) => void
}

function pickHueFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number | null {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = clientX - cx
  const dy = clientY - cy
  const dist = Math.hypot(dx, dy)
  const outer = rect.width / 2
  const inner = outer * 0.38
  if (dist < inner || dist > outer) return null
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90
}

export function ColourWheelPicker({ value, onChange }: ColourWheelPickerProps) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const normalized = normalizeHexColor(value) ?? '#4A90D9'
  const initial = hexToHsl(normalized)
  const [hue, setHue] = useState(initial.h)
  const [lightness, setLightness] = useState(initial.l)

  const currentHex = hslToHex(hue, 100, lightness)

  const applyHue = useCallback(
    (nextHue: number) => {
      const wrapped = ((nextHue % 360) + 360) % 360
      setHue(wrapped)
      onChange(hslToHex(wrapped, 100, lightness))
    },
    [lightness, onChange],
  )

  const applyLightness = useCallback(
    (nextLightness: number) => {
      const clamped = Math.max(8, Math.min(92, nextLightness))
      setLightness(clamped)
      onChange(hslToHex(hue, 100, clamped))
    },
    [hue, onChange],
  )

  const handlePointer = (clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return
    const nextHue = pickHueFromPointer(clientX, clientY, rect)
    if (nextHue == null) return
    applyHue(nextHue)
  }

  const markerAngle = hue - 90
  const markerRad = (markerAngle * Math.PI) / 180
  const markerR = 42
  const markerX = 50 + Math.cos(markerRad) * markerR
  const markerY = 50 + Math.sin(markerRad) * markerR

  return (
    <div className="space-y-4">
      <div
        ref={wheelRef}
        className="relative mx-auto aspect-square w-full max-w-[220px] touch-none select-none"
        onPointerDown={(e) => {
          dragging.current = true
          wheelRef.current?.setPointerCapture(e.pointerId)
          handlePointer(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return
          handlePointer(e.clientX, e.clientY)
        }}
        onPointerUp={(e) => {
          dragging.current = false
          wheelRef.current?.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
      >
        <div
          className="absolute inset-0 rounded-full shadow-inner ring-1 ring-black/10"
          style={{
            background:
              'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
        />
        <div className="absolute inset-[19%] rounded-full bg-[#fffaf0] shadow-inner ring-1 ring-black/5" />
        <div
          className="absolute inset-[28%] rounded-full shadow-md ring-2 ring-white"
          style={{ backgroundColor: currentHex }}
        />
        <span
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
          style={{
            left: `${markerX}%`,
            top: `${markerY}%`,
            backgroundColor: hslToHex(hue, 100, 50),
          }}
        />
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[#8A7A6A]">
          <span>Brightness</span>
          <span className="tabular-nums text-[#3a2010]">{Math.round(lightness)}%</span>
        </span>
        <input
          type="range"
          min={8}
          max={92}
          value={lightness}
          onChange={(e) => applyLightness(Number(e.target.value))}
          className="w-full accent-[#3a2010]"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium text-[#8A7A6A]">Hex</span>
        <input
          type="text"
          value={currentHex}
          onChange={(e) => {
            const hex = normalizeHexColor(e.target.value)
            if (!hex) return
            const hsl = hexToHsl(hex)
            setHue(hsl.h)
            setLightness(hsl.l)
            onChange(hex)
          }}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-[13px] uppercase outline-none focus:border-[#3a2010]/30"
        />
      </label>
    </div>
  )
}
