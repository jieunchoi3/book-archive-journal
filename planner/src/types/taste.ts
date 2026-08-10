export type TasteKind = 'song' | 'music' | 'movie' | 'place' | 'other'

export interface TasteSticker {
  id: string
  kind: TasteKind
  title: string
  /** Optional artist / director / neighborhood, etc. */
  subtitle: string
  note: string
  link: string
  /** Compressed JPEG data URL for the polaroid photo. */
  imageDataUrl: string
  /** YYYY-MM-DD when this taste felt true */
  dateKey: string
  createdAt: string
  /** Stable visual tilt for polaroid feel (-4..4). */
  tilt: number
  accent: string
}

export interface TasteStore {
  stickers: TasteSticker[]
}

export const TASTE_KINDS: {
  id: TasteKind
  label: string
  emoji: string
  accent: string
}[] = [
  { id: 'song', label: '노래', emoji: '🎵', accent: '#FF2D55' },
  { id: 'music', label: '음악', emoji: '💿', accent: '#5856D6' },
  { id: 'movie', label: '영화', emoji: '🎬', accent: '#007AFF' },
  { id: 'place', label: '장소', emoji: '📍', accent: '#34C759' },
  { id: 'other', label: '기타', emoji: '✨', accent: '#AF52DE' },
]

export function emptyTasteStore(): TasteStore {
  return { stickers: [] }
}

export function tasteKindMeta(kind: TasteKind) {
  return TASTE_KINDS.find((k) => k.id === kind) ?? TASTE_KINDS[4]!
}

export function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}
