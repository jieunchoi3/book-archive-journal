export interface DiaryPoint {
  x: number
  y: number
}

export interface DiaryStroke {
  id: string
  color: string
  width: number
  points: DiaryPoint[]
  /** When true, stroke erases pixels under it. */
  erase?: boolean
}

/** One photo layer on the day's canvas (bottom → top). */
export interface DiaryPhotoLayer {
  id: string
  /** Compressed JPEG/PNG data URL of the source image (after crop bake). */
  src: string
  /** Position of image top-left in canvas coords. */
  x: number
  y: number
  /** Uniform scale relative to natural size fitted into canvas. */
  scale: number
  strokes: DiaryStroke[]
}

export interface DiaryEntry {
  dateKey: string
  title: string
  body: string
  layers: DiaryPhotoLayer[]
  /** Freehand strokes on the frame (works with or without photos). */
  canvasStrokes: DiaryStroke[]
  /** Background fill behind non-square photos in the 1:1 frame. */
  frameColor: string
  /** Full-resolution square composite (editor / Storage cover.jpg). */
  coverDataUrl: string | null
  /** Small square for the month grid (Storage thumb.jpg). */
  thumbDataUrl?: string | null
  updatedAt: string
}

export const DEFAULT_DIARY_FRAME_COLOR = '#F2F2F7'

export const DIARY_FRAME_COLORS = [
  '#F2F2F7',
  '#FFFFFF',
  '#1C1C1E',
  '#FFE5E5',
  '#FFF0E0',
  '#FFF8D6',
  '#E8F8EC',
  '#E5F2FF',
  '#F0E8FF',
  '#FADCE8',
  '#D4C4B0',
  '#8E8E93',
] as const

export function emptyDiaryEntry(dateKey: string): DiaryEntry {
  return {
    dateKey,
    title: '',
    body: '',
    layers: [],
    canvasStrokes: [],
    frameColor: DEFAULT_DIARY_FRAME_COLOR,
    coverDataUrl: null,
    thumbDataUrl: null,
    updatedAt: new Date().toISOString(),
  }
}

export function isDiaryEntryEmpty(entry: DiaryEntry): boolean {
  return (
    !entry.title.trim() &&
    !entry.body.trim() &&
    entry.layers.length === 0 &&
    (entry.canvasStrokes?.length ?? 0) === 0 &&
    !entry.coverDataUrl
  )
}

/** True when the day has photo content (bytes, remote cover, or layer placeholders). */
export function diaryEntryHasPhoto(entry: DiaryEntry | null | undefined): boolean {
  if (!entry) return false
  return Boolean(entry.thumbDataUrl || entry.coverDataUrl) || entry.layers.length > 0
}

/** Prefer the small grid thumb; fall back to the full cover. */
export function diaryGridImageUrl(entry: DiaryEntry | null | undefined): string | null {
  if (!entry) return null
  return entry.thumbDataUrl || entry.coverDataUrl || null
}
