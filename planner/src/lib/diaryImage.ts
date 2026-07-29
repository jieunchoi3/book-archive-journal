import type { DiaryPhotoLayer, DiaryStroke } from '../types/diary'
import { generateId } from './weekUtils'

export const DIARY_CANVAS_SIZE = 1600

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** Compress a File or data URL into a high-quality JPEG data URL. */
export async function compressImageSource(
  source: File | string,
  maxEdge = 2400,
  quality = 0.92,
): Promise<string> {
  const src =
    typeof source === 'string' ? source : await fileToDataUrl(source)
  const img = await loadImage(src)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(file)
  })
}

/** Fit image into canvas and return a new layer centered. */
export async function createLayerFromSrc(source: File | string): Promise<DiaryPhotoLayer> {
  const compressed = await compressImageSource(source)
  const img = await loadImage(compressed)
  const fit = Math.min(DIARY_CANVAS_SIZE / img.width, DIARY_CANVAS_SIZE / img.height)
  const drawW = img.width * fit
  const drawH = img.height * fit
  return {
    id: generateId(),
    src: compressed,
    x: (DIARY_CANVAS_SIZE - drawW) / 2,
    y: (DIARY_CANVAS_SIZE - drawH) / 2,
    scale: fit,
    strokes: [],
  }
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: DiaryStroke[]) {
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    ctx.save()
    if (stroke.erase) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = stroke.color
    }
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
    ctx.restore()
  }
}

export async function renderDiaryComposite(
  layers: DiaryPhotoLayer[],
  size = DIARY_CANVAS_SIZE,
  frameColor = '#F2F2F7',
  canvasStrokes: DiaryStroke[] = [],
): Promise<string | null> {
  if (layers.length === 0 && canvasStrokes.length === 0) return null

  // Draw on a transparent canvas so erase strokes can punch holes,
  // then flatten onto the frame colour for JPEG export.
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const scale = size / DIARY_CANVAS_SIZE
  ctx.save()
  ctx.scale(scale, scale)

  for (const layer of layers) {
    try {
      const img = await loadImage(layer.src)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(
        img,
        layer.x,
        layer.y,
        img.width * layer.scale,
        img.height * layer.scale,
      )
      drawStrokes(ctx, layer.strokes)
    } catch {
      // skip broken layer
    }
  }

  drawStrokes(ctx, canvasStrokes)
  ctx.restore()

  const flat = document.createElement('canvas')
  flat.width = size
  flat.height = size
  const fctx = flat.getContext('2d')
  if (!fctx) return null
  fctx.imageSmoothingEnabled = true
  fctx.imageSmoothingQuality = 'high'
  fctx.fillStyle = frameColor
  fctx.fillRect(0, 0, size, size)
  fctx.drawImage(canvas, 0, 0)
  return flat.toDataURL('image/jpeg', 0.92)
}

function recenterLayerFromImage(
  layer: DiaryPhotoLayer,
  src: string,
  imgW: number,
  imgH: number,
  visualW: number,
  visualH: number,
): DiaryPhotoLayer {
  const fit = Math.min(DIARY_CANVAS_SIZE / imgW, DIARY_CANVAS_SIZE / imgH)
  const drawW = imgW * fit
  const drawH = imgH * fit
  // Prefer keeping the previous visual center when possible.
  const cx = layer.x + visualW / 2
  const cy = layer.y + visualH / 2
  return {
    ...layer,
    src,
    x: cx - drawW / 2,
    y: cy - drawH / 2,
    scale: fit,
    strokes: [],
  }
}

/** Bake a crop rect (canvas coords) into a layer's source image. */
export async function bakeCropIntoLayer(
  layer: DiaryPhotoLayer,
  crop: { x: number; y: number; width: number; height: number },
): Promise<DiaryPhotoLayer> {
  const img = await loadImage(layer.src)
  const sx = (crop.x - layer.x) / layer.scale
  const sy = (crop.y - layer.y) / layer.scale
  const sw = crop.width / layer.scale
  const sh = crop.height / layer.scale

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw))
  canvas.height = Math.max(1, Math.round(sh))
  const ctx = canvas.getContext('2d')
  if (!ctx) return layer
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const cropped = canvas.toDataURL('image/jpeg', 0.92)
  const visualW = img.width * layer.scale
  const visualH = img.height * layer.scale
  return recenterLayerFromImage(
    layer,
    cropped,
    canvas.width,
    canvas.height,
    visualW,
    visualH,
  )
}

/**
 * Bake a freehand lasso path (canvas coords) into a transparent PNG cutout.
 * Points outside the path become transparent.
 */
export async function bakeLassoCropIntoLayer(
  layer: DiaryPhotoLayer,
  points: { x: number; y: number }[],
): Promise<DiaryPhotoLayer> {
  if (points.length < 3) return layer
  const img = await loadImage(layer.src)

  const imgPoints = points.map((p) => ({
    x: (p.x - layer.x) / layer.scale,
    y: (p.y - layer.y) / layer.scale,
  }))

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of imgPoints) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  // Clamp to image bounds
  minX = Math.max(0, Math.floor(minX))
  minY = Math.max(0, Math.floor(minY))
  maxX = Math.min(img.width, Math.ceil(maxX))
  maxY = Math.min(img.height, Math.ceil(maxY))
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return layer

  ctx.beginPath()
  ctx.moveTo(imgPoints[0].x - minX, imgPoints[0].y - minY)
  for (let i = 1; i < imgPoints.length; i++) {
    ctx.lineTo(imgPoints[i].x - minX, imgPoints[i].y - minY)
  }
  ctx.closePath()
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, -minX, -minY)

  const cropped = canvas.toDataURL('image/png')
  const visualW = img.width * layer.scale
  const visualH = img.height * layer.scale
  return recenterLayerFromImage(layer, cropped, w, h, visualW, visualH)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(blob)
  })
}

function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports as MacIntel but has touch
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** Downscale a source for ML so iPad Safari does not OOM. */
async function downscaleForBackgroundRemoval(src: string, maxEdge: number): Promise<string> {
  const img = await loadImage(src)
  const edge = Math.max(img.width, img.height)
  if (edge <= maxEdge) return src
  return compressImageSource(src, maxEdge, 0.85)
}

/** Run ML background removal on a layer; result is a transparent PNG. */
export async function removeBackgroundFromLayer(
  layer: DiaryPhotoLayer,
  onProgress?: (key: string, current: number, total: number) => void,
): Promise<DiaryPhotoLayer> {
  const appleMobile = isAppleMobile()
  // iPad/iPhone Safari WASM heap is tiny — feed a much smaller image + CPU only.
  const maxEdge = appleMobile ? 640 : 1280
  const mlSource = await downscaleForBackgroundRemoval(layer.src, maxEdge)

  onProgress?.('prepare', 1, 3)

  try {
    const { removeBackground } = await import('@imgly/background-removal')
    const blob = await removeBackground(mlSource, {
      model: 'isnet_quint8',
      device: 'cpu',
      output: { format: 'image/png', quality: 0.85 },
      progress: onProgress,
    })
    const src = await blobToDataUrl(blob)
    const [oldImg, newImg] = await Promise.all([loadImage(layer.src), loadImage(src)])
    const visualW = oldImg.width * layer.scale
    const visualH = oldImg.height * layer.scale
    const scale = Math.min(visualW / newImg.width, visualH / newImg.height)
    const drawW = newImg.width * scale
    const drawH = newImg.height * scale
    const cx = layer.x + visualW / 2
    const cy = layer.y + visualH / 2

    return {
      ...layer,
      src,
      x: cx - drawW / 2,
      y: cy - drawH / 2,
      scale,
      strokes: [],
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    if (/out of memory|no available backend|backend found/i.test(raw)) {
      throw new Error(
        appleMobile
          ? 'iPad ran out of memory for AI background removal. Close other tabs/apps, try a smaller photo, or use Erase / Lasso crop instead.'
          : 'Background removal ran out of memory. Try a smaller photo, or use Erase / Lasso crop instead.',
      )
    }
    throw e instanceof Error ? e : new Error('Background removal failed')
  }
}
