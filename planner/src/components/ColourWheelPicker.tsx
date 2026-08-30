import { useCallback, useRef, useState } from 'react'
import { hexToHsl, hslToHex, normalizeHexColor } from '../types/taste'

interface ColourWheelPickerProps {
  value: string
  onChange: (hex: string) => void
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
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
  const inner = outer * 0.72
  if (dist < inner || dist > outer) return null
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90
}

function pickSlFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { s: number; l: number } {
  const x = clamp((clientX - rect.left) / rect.width, 0, 1)
  const y = clamp((clientY - rect.top) / rect.height, 0, 1)
  return {
    s: x * 100,
    l: (1 - y) * 100,
  }
}

export function ColourWheelPicker({ value, onChange }: ColourWheelPickerProps) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const hueDragging = useRef(false)
  const padDragging = useRef(false)

  const normalized = normalizeHexColor(value) ?? '#4A90D9'
  const initial = hexToHsl(normalized)
  const [hue, setHue] = useState(initial.h)
  const [saturation, setSaturation] = useState(initial.s)
  const [lightness, setLightness] = useState(initial.l)

  const emit = useCallback(
    (h: number, s: number, l: number) => {
      onChange(hslToHex(h, s, l))
    },
    [onChange],
  )

  const applySl = useCallback(
    (s: number, l: number) => {
      const nextS = clamp(s, 0, 100)
      const nextL = clamp(l, 0, 100)
      setSaturation(nextS)
      setLightness(nextL)
      emit(hue, nextS, nextL)
    },
    [emit, hue],
  )

  const applyHue = useCallback(
    (nextHue: number) => {
      const wrapped = ((nextHue % 360) + 360) % 360
      setHue(wrapped)
      emit(wrapped, saturation, lightness)
    },
    [emit, saturation, lightness],
  )

  const handleHuePointer = (clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return
    const nextHue = pickHueFromPointer(clientX, clientY, rect)
    if (nextHue == null) return
    applyHue(nextHue)
  }

  const handlePadPointer = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect()
    if (!rect) return
    const { s, l } = pickSlFromPointer(clientX, clientY, rect)
    applySl(s, l)
  }

  const currentHex = hslToHex(hue, saturation, lightness)

  const markerAngle = hue - 90
  const markerRad = (markerAngle * Math.PI) / 180
  const markerR = 46
  const markerX = 50 + Math.cos(markerRad) * markerR
  const markerY = 50 + Math.sin(markerRad) * markerR

  const padMarkerX = saturation
  const padMarkerY = 100 - lightness

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-[240px]">
        <div
          ref={wheelRef}
          className="absolute inset-0 touch-none select-none"
          onPointerDown={(e) => {
            const rect = wheelRef.current?.getBoundingClientRect()
            if (!rect) return
            const nextHue = pickHueFromPointer(e.clientX, e.clientY, rect)
            if (nextHue == null) return
            hueDragging.current = true
            wheelRef.current?.setPointerCapture(e.pointerId)
            applyHue(nextHue)
          }}
          onPointerMove={(e) => {
            if (!hueDragging.current) return
            handleHuePointer(e.clientX, e.clientY)
          }}
          onPointerUp={(e) => {
            hueDragging.current = false
            wheelRef.current?.releasePointerCapture(e.pointerId)
          }}
          onPointerCancel={() => {
            hueDragging.current = false
          }}
        >
          <div
            className="absolute inset-0 rounded-full shadow-inner ring-1 ring-black/10"
            style={{
              background:
                'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
            }}
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

        <div
          ref={padRef}
          className="absolute inset-[22%] touch-none select-none overflow-hidden rounded-full shadow-md ring-2 ring-white"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
          }}
          onPointerDown={(e) => {
            padDragging.current = true
            padRef.current?.setPointerCapture(e.pointerId)
            handlePadPointer(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => {
            if (!padDragging.current) return
            handlePadPointer(e.clientX, e.clientY)
          }}
          onPointerUp={(e) => {
            padDragging.current = false
            padRef.current?.releasePointerCapture(e.pointerId)
          }}
          onPointerCancel={() => {
            padDragging.current = false
          }}
        >
          <span
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
            style={{
              left: `${padMarkerX}%`,
              top: `${padMarkerY}%`,
              backgroundColor: currentHex,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[#8A7A6A]">
            <span>Saturation</span>
            <span className="tabular-nums text-[#3a2010]">{Math.round(saturation)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={saturation}
            onChange={(e) => applySl(Number(e.target.value), lightness)}
            className="w-full accent-[#3a2010]"
            style={{
              background: `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`,
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[#8A7A6A]">
            <span>Brightness</span>
            <span className="tabular-nums text-[#3a2010]">{Math.round(lightness)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={lightness}
            onChange={(e) => applySl(saturation, Number(e.target.value))}
            className="w-full accent-[#3a2010]"
          />
        </label>
      </div>

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
            setSaturation(hsl.s)
            setLightness(hsl.l)
            onChange(hex)
          }}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-[13px] uppercase outline-none focus:border-[#3a2010]/30"
        />
      </label>
    </div>
  )
}
