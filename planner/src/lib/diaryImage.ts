import type { DiaryPhotoLayer, DiaryStroke } from '../types/diary'
import { generateId } from './weekUtils'

export const DIARY_CANVAS_SIZE = 720

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** Compress a File or data URL into a reasonably sized JPEG data URL. */
export async function compressImageSource(
  source: File | string,
  maxEdge = 1400,
  quality = 0.78,
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
  fctx.fillStyle = frameColor
  fctx.fillRect(0, 0, size, size)
  fctx.drawImage(canvas, 0, 0)
  return flat.toDataURL('image/jpeg', 0.82)
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
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const cropped = canvas.toDataURL('image/jpeg', 0.85)

  const fit = Math.min(DIARY_CANVAS_SIZE / canvas.width, DIARY_CANVAS_SIZE / canvas.height)
  const drawW = canvas.width * fit
  const drawH = canvas.height * fit

  return {
    ...layer,
    src: cropped,
    x: (DIARY_CANVAS_SIZE - drawW) / 2,
    y: (DIARY_CANVAS_SIZE - drawH) / 2,
    scale: fit,
    strokes: [],
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(blob)
  })
}

/** Run ML background removal on a layer; result is a transparent PNG. */
export async function removeBackgroundFromLayer(
  layer: DiaryPhotoLayer,
  onProgress?: (key: string, current: number, total: number) => void,
): Promise<DiaryPhotoLayer> {
  const { removeBackground } = await import('@imgly/background-removal')
  const blob = await removeBackground(layer.src, {
    model: 'isnet_quint8',
    output: { format: 'image/png', quality: 0.9 },
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
}
