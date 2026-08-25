import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type NapkinSketchKind = 'draw' | 'photo' | ''

interface NapkinSketchProps {
  url: string
  kind: NapkinSketchKind
  readonly?: boolean
  onChange: (url: string, kind: NapkinSketchKind) => void
  /** Smaller text button label for skip */
  laterLabel?: string
}

/** Shared napkin sketch: one black pen (3px) + eraser + photo upload. No colors/shapes. */
export function NapkinSketch({
  url,
  kind,
  readonly,
  onChange,
  laterLabel = '나중에',
}: NapkinSketchProps) {
  const [mode, setMode] = useState<'idle' | 'draw' | 'photo'>(
    kind === 'draw' ? 'draw' : kind === 'photo' ? 'photo' : 'idle',
  )
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const erasing = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode !== 'draw') return
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#FFFEF9'
    ctx.fillRect(0, 0, c.width, c.height)
    if (url && kind === 'draw') {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = url
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    }
  }

  const stroke = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || readonly) return
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const p = pos(e)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    if (erasing.current) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = '#1C1B1A'
    }
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const commitDraw = () => {
    const c = canvasRef.current
    if (!c) return
    onChange(c.toDataURL('image/png'), 'draw')
  }

  return (
    <div className="mt-2">
      {mode === 'idle' && !url && !readonly && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[#ECE7E2] px-3 py-1.5 text-[13px]"
            onClick={() => setMode('draw')}
          >
            ✏️ 그리기
          </button>
          <button
            type="button"
            className="rounded-full border border-[#ECE7E2] px-3 py-1.5 text-[13px]"
            onClick={() => fileRef.current?.click()}
          >
            📷 사진 올리기
          </button>
          <button
            type="button"
            className="text-[12px] text-[#B5AFA8]"
            onClick={() => onChange('', '')}
          >
            {laterLabel}
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const reader = new FileReader()
          reader.onload = () => {
            onChange(String(reader.result), 'photo')
            setMode('photo')
          }
          reader.readAsDataURL(f)
        }}
      />
      {(mode === 'draw' || (url && kind === 'draw')) && (
        <div>
          <canvas
            ref={canvasRef}
            width={400}
            height={300}
            className="max-w-full touch-none rounded-xl border border-[#ECE7E2] bg-[#FFFEF9]"
            onPointerDown={(e) => {
              if (readonly) return
              drawing.current = true
              const c = canvasRef.current!
              const ctx = c.getContext('2d')!
              const p = pos(e)
              ctx.beginPath()
              ctx.moveTo(p.x, p.y)
              ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
            }}
            onPointerMove={stroke}
            onPointerUp={() => {
              drawing.current = false
              commitDraw()
            }}
          />
          {!readonly && (
            <div className="mt-2 flex gap-2 text-[12px]">
              <button
                type="button"
                className="rounded-lg border border-[#ECE7E2] px-2 py-1"
                onClick={() => {
                  erasing.current = false
                }}
              >
                펜
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#ECE7E2] px-2 py-1"
                onClick={() => {
                  erasing.current = true
                }}
              >
                지우개
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#ECE7E2] px-2 py-1"
                onClick={() => {
                  const c = canvasRef.current
                  if (!c) return
                  const ctx = c.getContext('2d')!
                  ctx.globalCompositeOperation = 'source-over'
                  ctx.fillStyle = '#FFFEF9'
                  ctx.fillRect(0, 0, c.width, c.height)
                  onChange('', '')
                  setMode('idle')
                }}
              >
                전체 지우기
              </button>
            </div>
          )}
        </div>
      )}
      {url && kind === 'photo' && (
        <img
          src={url}
          alt="냅킨 스케치"
          className="max-h-[300px] max-w-full rounded-xl border border-[#ECE7E2]"
        />
      )}
    </div>
  )
}
