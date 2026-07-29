import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  Crop,
  Eraser,
  Move,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
  Layers,
  Sparkles,
} from 'lucide-react'
import type { DiaryPhotoLayer, DiaryStroke } from '../types/diary'
import {
  DEFAULT_DIARY_FRAME_COLOR,
  DIARY_FRAME_COLORS,
} from '../types/diary'
import {
  DIARY_CANVAS_SIZE,
  bakeCropIntoLayer,
  createLayerFromSrc,
  drawStrokes,
  loadImage,
  removeBackgroundFromLayer,
} from '../lib/diaryImage'
import { generateId } from '../lib/weekUtils'

type Tool = 'move' | 'draw' | 'erase' | 'crop'

type EditorSnapshot = {
  layers: DiaryPhotoLayer[]
  canvasStrokes: DiaryStroke[]
  frameColor: string
}

const BRUSH_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#FFFFFF', '#1C1C1E']

interface DiaryPhotoEditorProps {
  layers: DiaryPhotoLayer[]
  canvasStrokes?: DiaryStroke[]
  frameColor?: string
  onSave: (result: {
    layers: DiaryPhotoLayer[]
    frameColor: string
    canvasStrokes: DiaryStroke[]
  }) => void
  onClose: () => void
}

export function DiaryPhotoEditor({
  layers: initialLayers,
  canvasStrokes: initialCanvasStrokes = [],
  frameColor: initialFrameColor = DEFAULT_DIARY_FRAME_COLOR,
  onSave,
  onClose,
}: DiaryPhotoEditorProps) {
  const [layers, setLayers] = useState<DiaryPhotoLayer[]>(initialLayers)
  const [canvasStrokes, setCanvasStrokes] = useState<DiaryStroke[]>(initialCanvasStrokes)
  const [frameColor, setFrameColor] = useState(initialFrameColor)
  const [activeId, setActiveId] = useState<string | null>(initialLayers.at(-1)?.id ?? null)
  const [tool, setTool] = useState<Tool>(initialLayers.length === 0 ? 'draw' : 'move')
  const [brushColor, setBrushColor] = useState('#1C1C1E')
  const [brushWidth, setBrushWidth] = useState(4)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  )
  const [removingBg, setRemovingBg] = useState(false)
  const [bgProgress, setBgProgress] = useState<string | null>(null)
  const [bgError, setBgError] = useState<string | null>(null)
  const [activeNaturalSize, setActiveNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [historyTick, setHistoryTick] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const undoStack = useRef<EditorSnapshot[]>([])
  const redoStack = useRef<EditorSnapshot[]>([])
  const layersRef = useRef(layers)
  const canvasStrokesRef = useRef(canvasStrokes)
  const frameColorRef = useRef(frameColor)
  layersRef.current = layers
  canvasStrokesRef.current = canvasStrokes
  frameColorRef.current = frameColor

  const pushHistory = useCallback(() => {
    undoStack.current.push(
      structuredClone({
        layers: layersRef.current,
        canvasStrokes: canvasStrokesRef.current,
        frameColor: frameColorRef.current,
      }),
    )
    if (undoStack.current.length > 60) undoStack.current.shift()
    redoStack.current = []
    setHistoryTick((t) => t + 1)
  }, [])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(
      structuredClone({
        layers: layersRef.current,
        canvasStrokes: canvasStrokesRef.current,
        frameColor: frameColorRef.current,
      }),
    )
    setLayers(prev.layers)
    setCanvasStrokes(prev.canvasStrokes)
    setFrameColor(prev.frameColor)
    setHistoryTick((t) => t + 1)
  }, [])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(
      structuredClone({
        layers: layersRef.current,
        canvasStrokes: canvasStrokesRef.current,
        frameColor: frameColorRef.current,
      }),
    )
    setLayers(next.layers)
    setCanvasStrokes(next.canvasStrokes)
    setFrameColor(next.frameColor)
    setHistoryTick((t) => t + 1)
  }, [])

  const canUndo = historyTick >= 0 && undoStack.current.length > 0
  const canRedo = historyTick >= 0 && redoStack.current.length > 0

  const dragRef = useRef<{
    mode: 'move' | 'draw' | 'draw-canvas' | 'crop-new' | 'crop-resize' | 'resize'
    startX: number
    startY: number
    originX: number
    originY: number
    originScale?: number
    centerX?: number
    centerY?: number
    startDist?: number
    strokeId?: string
  } | null>(null)

  const activeLayer = layers.find((l) => l.id === activeId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  useEffect(() => {
    if (!activeLayer) {
      setActiveNaturalSize(null)
      return
    }
    let cancelled = false
    void loadImage(activeLayer.src).then((img) => {
      if (!cancelled) setActiveNaturalSize({ w: img.width, h: img.height })
    })
    return () => {
      cancelled = true
    }
  }, [activeLayer?.id, activeLayer?.src])

  const activeBounds =
    activeLayer && activeNaturalSize
      ? {
          x: activeLayer.x,
          y: activeLayer.y,
          w: activeNaturalSize.w * activeLayer.scale,
          h: activeNaturalSize.h * activeLayer.scale,
        }
      : null

  const scaleLayerCentered = (
    layer: DiaryPhotoLayer,
    natural: { w: number; h: number },
    nextScale: number,
  ): DiaryPhotoLayer => {
    const scale = Math.min(5, Math.max(0.04, nextScale))
    const oldW = natural.w * layer.scale
    const oldH = natural.h * layer.scale
    const newW = natural.w * scale
    const newH = natural.h * scale
    return {
      ...layer,
      scale,
      x: layer.x + (oldW - newW) / 2,
      y: layer.y + (oldH - newH) / 2,
    }
  }

  useEffect(() => {
    let cancelled = false
    const paint = async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, DIARY_CANVAS_SIZE, DIARY_CANVAS_SIZE)
      ctx.fillStyle = frameColor
      ctx.fillRect(0, 0, DIARY_CANVAS_SIZE, DIARY_CANVAS_SIZE)

      for (const layer of layers) {
        try {
          const img = await loadImage(layer.src)
          if (cancelled) return
          ctx.drawImage(
            img,
            layer.x,
            layer.y,
            img.width * layer.scale,
            img.height * layer.scale,
          )
          drawStrokes(ctx, layer.strokes)
        } catch {
          // skip
        }
      }

      drawStrokes(ctx, canvasStrokes)

      if (tool === 'move' && activeLayer && activeNaturalSize) {
        const bx = activeLayer.x
        const by = activeLayer.y
        const bw = activeNaturalSize.w * activeLayer.scale
        const bh = activeNaturalSize.h * activeLayer.scale
        ctx.strokeStyle = '#007AFF'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.strokeRect(bx, by, bw, bh)
        ctx.setLineDash([])
        const handles = [
          [bx, by],
          [bx + bw, by],
          [bx, by + bh],
          [bx + bw, by + bh],
        ]
        for (const [hx, hy] of handles) {
          ctx.fillStyle = '#FFFFFF'
          ctx.strokeStyle = '#007AFF'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.rect(hx - 8, hy - 8, 16, 16)
          ctx.fill()
          ctx.stroke()
        }
      }

      if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
        ctx.save()
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.beginPath()
        ctx.rect(0, 0, DIARY_CANVAS_SIZE, DIARY_CANVAS_SIZE)
        ctx.rect(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
        ctx.fill('evenodd')
        ctx.restore()

        ctx.strokeStyle = '#007AFF'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
        ctx.setLineDash([])
      }
    }
    void paint()
    return () => {
      cancelled = true
    }
  }, [layers, canvasStrokes, cropRect, frameColor, tool, activeLayer, activeNaturalSize])

  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = DIARY_CANVAS_SIZE / rect.width
    const scaleY = DIARY_CANVAS_SIZE / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const hitResizeHandle = (pt: { x: number; y: number }) => {
    if (!activeBounds) return false
    const handles = [
      { x: activeBounds.x, y: activeBounds.y },
      { x: activeBounds.x + activeBounds.w, y: activeBounds.y },
      { x: activeBounds.x, y: activeBounds.y + activeBounds.h },
      { x: activeBounds.x + activeBounds.w, y: activeBounds.y + activeBounds.h },
    ]
    const hit = 18
    return handles.some((h) => Math.abs(pt.x - h.x) <= hit && Math.abs(pt.y - h.y) <= hit)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const pt = canvasPoint(e)

    if (tool === 'crop') {
      if (!activeLayer) return
      setCropRect({ x: pt.x, y: pt.y, width: 0, height: 0 })
      dragRef.current = { mode: 'crop-new', startX: pt.x, startY: pt.y, originX: 0, originY: 0 }
      return
    }

    if (tool === 'draw' || tool === 'erase') {
      pushHistory()
      const strokeId = generateId()
      const stroke: DiaryStroke = {
        id: strokeId,
        color: brushColor,
        width: tool === 'erase' ? Math.max(brushWidth, 12) : brushWidth,
        points: [pt],
        erase: tool === 'erase',
      }
      // Draw/erase on the frame when no photo is selected; otherwise on the active photo.
      if (!activeLayer) {
        setCanvasStrokes((prev) => [...prev, stroke])
        dragRef.current = {
          mode: 'draw-canvas',
          startX: pt.x,
          startY: pt.y,
          originX: 0,
          originY: 0,
          strokeId,
        }
      } else {
        setLayers((prev) =>
          prev.map((l) =>
            l.id === activeLayer.id ? { ...l, strokes: [...l.strokes, stroke] } : l,
          ),
        )
        dragRef.current = {
          mode: 'draw',
          startX: pt.x,
          startY: pt.y,
          originX: 0,
          originY: 0,
          strokeId,
        }
      }
      return
    }

    if (!activeLayer || !activeBounds || !activeNaturalSize) return

    if (tool === 'move') {
      pushHistory()
      if (hitResizeHandle(pt)) {
        const centerX = activeBounds.x + activeBounds.w / 2
        const centerY = activeBounds.y + activeBounds.h / 2
        const startDist = Math.max(8, Math.hypot(pt.x - centerX, pt.y - centerY))
        dragRef.current = {
          mode: 'resize',
          startX: pt.x,
          startY: pt.y,
          originX: activeLayer.x,
          originY: activeLayer.y,
          originScale: activeLayer.scale,
          centerX,
          centerY,
          startDist,
        }
        return
      }

      dragRef.current = {
        mode: 'move',
        startX: pt.x,
        startY: pt.y,
        originX: activeLayer.x,
        originY: activeLayer.y,
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const pt = canvasPoint(e)

    if (drag.mode === 'crop-new') {
      const x = Math.min(drag.startX, pt.x)
      const y = Math.min(drag.startY, pt.y)
      const width = Math.abs(pt.x - drag.startX)
      const height = Math.abs(pt.y - drag.startY)
      setCropRect({ x, y, width, height })
      return
    }

    if (drag.mode === 'draw-canvas' && drag.strokeId) {
      setCanvasStrokes((prev) =>
        prev.map((s) =>
          s.id === drag.strokeId ? { ...s, points: [...s.points, pt] } : s,
        ),
      )
      return
    }

    if (drag.mode === 'resize' && activeLayer && activeNaturalSize && drag.originScale && drag.startDist) {
      const dist = Math.hypot(pt.x - (drag.centerX ?? 0), pt.y - (drag.centerY ?? 0))
      const factor = dist / drag.startDist
      const nextScale = drag.originScale * factor
      setLayers((prev) =>
        prev.map((l) =>
          l.id === activeLayer.id
            ? scaleLayerCentered(
                { ...l, x: drag.originX, y: drag.originY, scale: drag.originScale! },
                activeNaturalSize,
                nextScale,
              )
            : l,
        ),
      )
      return
    }

    if (!activeLayer) return

    if (drag.mode === 'move') {
      const dx = pt.x - drag.startX
      const dy = pt.y - drag.startY
      setLayers((prev) =>
        prev.map((l) =>
          l.id === activeLayer.id
            ? { ...l, x: drag.originX + dx, y: drag.originY + dy }
            : l,
        ),
      )
      return
    }

    if (drag.mode === 'draw' && drag.strokeId) {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== activeLayer.id) return l
          return {
            ...l,
            strokes: l.strokes.map((s) =>
              s.id === drag.strokeId ? { ...s, points: [...s.points, pt] } : s,
            ),
          }
        }),
      )
    }
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const added: DiaryPhotoLayer[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      added.push(await createLayerFromSrc(file))
    }
    if (!added.length) return
    pushHistory()
    setLayers((prev) => [...prev, ...added])
    setActiveId(added[added.length - 1].id)
    setTool('move')
  }

  const applyCrop = async () => {
    if (!activeLayer || !cropRect || cropRect.width < 8 || cropRect.height < 8) return
    pushHistory()
    const next = await bakeCropIntoLayer(activeLayer, cropRect)
    setLayers((prev) => prev.map((l) => (l.id === activeLayer.id ? next : l)))
    setCropRect(null)
    setTool('move')
  }

  const deleteActive = () => {
    if (!activeLayer) return
    pushHistory()
    setLayers((prev) => {
      const next = prev.filter((l) => l.id !== activeLayer.id)
      setActiveId(next.at(-1)?.id ?? null)
      return next
    })
    setCropRect(null)
  }

  const changeScale = (delta: number) => {
    if (!activeLayer || !activeNaturalSize) return
    pushHistory()
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== activeLayer.id) return l
        return scaleLayerCentered(l, activeNaturalSize, l.scale * (1 + delta))
      }),
    )
  }

  const setScalePercent = (percent: number) => {
    if (!activeLayer || !activeNaturalSize) return
    // 100% ≈ fit width to ~70% of canvas for a comfortable default baseline
    const baseline = (DIARY_CANVAS_SIZE * 0.7) / activeNaturalSize.w
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== activeLayer.id) return l
        return scaleLayerCentered(l, activeNaturalSize, baseline * (percent / 100))
      }),
    )
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (tool !== 'move' || !activeLayer || !activeNaturalSize) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== activeLayer.id) return l
        return scaleLayerCentered(l, activeNaturalSize, l.scale * factor)
      }),
    )
  }

  const removeActiveBackground = async () => {
    if (!activeLayer || removingBg) return
    pushHistory()
    setRemovingBg(true)
    setBgError(null)
    setBgProgress('Starting…')
    try {
      const next = await removeBackgroundFromLayer(activeLayer, (key, current, total) => {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0
        setBgProgress(`${key} ${pct}%`)
      })
      setLayers((prev) => prev.map((l) => (l.id === activeLayer.id ? next : l)))
      setBgProgress(null)
    } catch (e) {
      console.error(e)
      setBgError(e instanceof Error ? e.message : 'Background removal failed')
      setBgProgress(null)
    } finally {
      setRemovingBg(false)
    }
  }

  const moveLayer = (dir: -1 | 1) => {
    if (!activeLayer) return
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === activeLayer.id)
      const nextIdx = idx + dir
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(nextIdx, 0, item)
      return copy
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1C1C1E]">Photo diary</h2>
            <p className="text-[12px] text-muted">Crop, resize, draw, and stack photos</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4 md:flex-row">
          <div className="min-w-0 flex-1">
            <div
              className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-xl ring-1 ring-hairline"
              style={{ backgroundColor: frameColor }}
            >
              <canvas
                ref={canvasRef}
                width={DIARY_CANVAS_SIZE}
                height={DIARY_CANVAS_SIZE}
                className={`h-full w-full touch-none ${
                  tool === 'move' && activeLayer ? 'cursor-move' : ''
                }`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={onWheel}
              />
              {layers.length === 0 && tool !== 'draw' && tool !== 'erase' && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-[#8E8E93] transition-colors hover:bg-black/[0.03] hover:text-[#007AFF]"
                  aria-label="Upload photo"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-hairline">
                    <Plus size={28} strokeWidth={2} />
                  </span>
                  <span className="text-[13px] font-medium">Add a photo</span>
                  <span className="px-8 text-center text-[11px] text-muted">
                    or choose Draw to sketch on the frame
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 md:w-56">
            <div className="flex flex-wrap items-center gap-1">
              <ToolBtn active={tool === 'move'} onClick={() => { setTool('move'); setCropRect(null) }} icon={<Move size={14} />} label="Move" />
              <ToolBtn active={tool === 'draw'} onClick={() => { setTool('draw'); setCropRect(null) }} icon={<Pencil size={14} />} label="Draw" />
              <ToolBtn active={tool === 'erase'} onClick={() => { setTool('erase'); setCropRect(null) }} icon={<Eraser size={14} />} label="Erase" />
              <ToolBtn active={tool === 'crop'} onClick={() => setTool('crop')} icon={<Crop size={14} />} label="Crop" />
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#F2F2F7] px-2 py-1.5 text-[11px] font-medium text-[#48484A] disabled:opacity-35"
                aria-label="Undo"
              >
                <Undo2 size={14} /> Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#F2F2F7] px-2 py-1.5 text-[11px] font-medium text-[#48484A] disabled:opacity-35"
                aria-label="Redo"
              >
                <Redo2 size={14} /> Redo
              </button>
            </div>

            <div className="space-y-2 rounded-xl bg-[#F5F5F7] p-2.5">
              <p className="text-[11px] font-medium text-[#48484A]">Frame colour</p>
              <div className="flex items-center gap-2">
                <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full shadow-sm ring-2 ring-white">
                  <span
                    className="absolute inset-0"
                    style={{
                      background:
                        'conic-gradient(#FF3B30, #FFCC00, #34C759, #007AFF, #AF52DE, #FF3B30)',
                    }}
                  />
                  <span
                    className="absolute inset-[3px] rounded-full border border-white/80"
                    style={{ backgroundColor: frameColor }}
                  />
                  <input
                    type="color"
                    value={frameColor}
                    onChange={(e) => {
                      pushHistory()
                      setFrameColor(e.target.value)
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Frame colour wheel"
                  />
                </label>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {DIARY_FRAME_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        if (c.toLowerCase() === frameColor.toLowerCase()) return
                        pushHistory()
                        setFrameColor(c)
                      }}
                      className={`h-6 w-6 rounded-full border-2 ${
                        frameColor.toLowerCase() === c.toLowerCase()
                          ? 'border-[#007AFF]'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                      aria-label={`Frame ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {(tool === 'draw' || tool === 'erase') && (
              <div className="space-y-2 rounded-xl bg-[#F5F5F7] p-2.5">
                {!activeLayer && (
                  <p className="text-[10px] leading-snug text-muted">
                    {tool === 'erase'
                      ? 'Erasing on the frame.'
                      : 'Drawing on the frame — no photo needed.'}
                  </p>
                )}
                {tool === 'draw' && (
                  <>
                    <p className="text-[11px] font-medium text-[#48484A]">Brush colour</p>
                    <div className="flex items-center gap-3">
                      <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full shadow-sm ring-2 ring-white">
                        <span
                          className="absolute inset-0"
                          style={{
                            background:
                              'conic-gradient(#FF3B30, #FF9500, #FFCC00, #34C759, #007AFF, #AF52DE, #FF3B30)',
                          }}
                        />
                        <span
                          className="absolute inset-[3px] rounded-full border border-white/80"
                          style={{ backgroundColor: brushColor }}
                        />
                        <input
                          type="color"
                          value={brushColor}
                          onChange={(e) => setBrushColor(e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          aria-label="Brush colour wheel"
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          {BRUSH_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setBrushColor(c)}
                              className={`h-6 w-6 rounded-full border-2 ${
                                brushColor.toLowerCase() === c.toLowerCase()
                                  ? 'border-[#007AFF]'
                                  : 'border-transparent'
                              }`}
                              style={{ backgroundColor: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                              aria-label={c}
                            />
                          ))}
                        </div>
                        <p className="mt-1.5 truncate text-[10px] text-muted">{brushColor}</p>
                      </div>
                    </div>
                  </>
                )}
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  {tool === 'erase' ? 'Eraser size' : 'Size'}
                  <input
                    type="range"
                    min={1}
                    max={48}
                    value={brushWidth}
                    onChange={(e) => setBrushWidth(Number(e.target.value))}
                    className="flex-1"
                  />
                </label>
                {canvasStrokes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      pushHistory()
                      setCanvasStrokes([])
                    }}
                    className="w-full rounded-lg bg-white py-1.5 text-[11px] font-medium text-[#FF3B30] shadow-sm"
                  >
                    Clear frame drawing
                  </button>
                )}
              </div>
            )}

            {activeLayer && (
              <div className="space-y-2 rounded-xl bg-[#F5F5F7] p-2.5">
                {tool === 'move' && (
                  <>
                    <p className="text-[11px] font-medium text-[#48484A]">Resize photo</p>
                    <p className="text-[10px] leading-snug text-muted">
                      Drag the blue corner handles, use − / +, the slider, or pinch / scroll on the photo.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => changeScale(-0.12)}
                        className="flex-1 rounded-lg bg-white py-1.5 text-[12px] font-medium shadow-sm"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => changeScale(0.12)}
                        className="flex-1 rounded-lg bg-white py-1.5 text-[12px] font-medium shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    {activeLayer && activeNaturalSize && (
                      <label className="flex items-center gap-2 text-[11px] text-muted">
                        Size
                        <input
                          type="range"
                          min={15}
                          max={250}
                          value={Math.round(
                            (activeLayer.scale /
                              ((DIARY_CANVAS_SIZE * 0.7) / activeNaturalSize.w)) *
                              100,
                          )}
                          onPointerDown={() => pushHistory()}
                          onChange={(e) => setScalePercent(Number(e.target.value))}
                          className="flex-1"
                        />
                      </label>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void removeActiveBackground()}
                  disabled={removingBg}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-[12px] font-medium text-[#AF52DE] shadow-sm disabled:opacity-60"
                >
                  <Sparkles size={14} />
                  {removingBg ? 'Removing…' : 'Remove background'}
                </button>
                {bgProgress && (
                  <p className="text-[10px] leading-snug text-muted">{bgProgress}</p>
                )}
                {bgError && (
                  <p className="text-[10px] leading-snug text-[#FF3B30]">{bgError}</p>
                )}
                <p className="text-[10px] leading-snug text-muted">
                  First run downloads a small AI model (~40MB), then runs in your browser.
                </p>
              </div>
            )}

            {tool === 'crop' && cropRect && (
              <button
                type="button"
                onClick={() => void applyCrop()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-2 text-[12px] font-semibold text-white"
              >
                <Check size={14} /> Apply crop
              </button>
            )}

            <div className="rounded-xl bg-[#F5F5F7] p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#48484A]">
                  <Layers size={12} /> Layers
                </span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#007AFF] hover:bg-white"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addPhotos(e.target.files)
                  e.target.value = ''
                }}
              />
              <div className="flex max-h-40 flex-col gap-1 overflow-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(null)
                    setTool('draw')
                  }}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] ${
                    activeId === null
                      ? 'bg-white shadow-sm ring-1 ring-[#007AFF]/30'
                      : 'hover:bg-white/70'
                  }`}
                >
                  <span
                    className="h-8 w-8 rounded"
                    style={{ backgroundColor: frameColor, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-[#48484A]">
                    Frame {canvasStrokes.length > 0 ? `(${canvasStrokes.length})` : ''}
                  </span>
                </button>
                {layers.length === 0 && (
                  <p className="px-1 py-1 text-[11px] text-muted">No photos yet — draw on the frame</p>
                )}
                {[...layers].reverse().map((layer, revIdx) => {
                  const realIdx = layers.length - 1 - revIdx
                  const active = layer.id === activeId
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => setActiveId(layer.id)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] ${
                        active ? 'bg-white shadow-sm ring-1 ring-[#007AFF]/30' : 'hover:bg-white/70'
                      }`}
                    >
                      <img
                        src={layer.src}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-[#48484A]">
                        Photo {realIdx + 1}
                      </span>
                    </button>
                  )
                })}
              </div>
              {activeLayer && (
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveLayer(1)}
                    className="flex-1 rounded-lg bg-white py-1 text-[10px] font-medium shadow-sm"
                  >
                    Bring forward
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(-1)}
                    className="flex-1 rounded-lg bg-white py-1 text-[10px] font-medium shadow-sm"
                  >
                    Send back
                  </button>
                  <button
                    type="button"
                    onClick={deleteActive}
                    className="rounded-lg bg-white p-1.5 text-[#FF3B30] shadow-sm"
                    aria-label="Delete layer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13px] font-medium text-muted hover:bg-[#F2F2F7]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ layers, frameColor, canvasStrokes })}
            className="rounded-xl bg-[#007AFF] px-4 py-2 text-[13px] font-semibold text-white"
          >
            Save photos
          </button>
        </footer>
      </div>
    </div>
  )
}

function ToolBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
        active ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#48484A] hover:bg-[#E5E5EA]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
