export interface TasteSubcategory {
  id: string
  name: string
}

export interface TasteCategory {
  id: string
  name: string
  accent: string
  /** When true, polaroids in this category can attach a YouTube link and hover-play. */
  youtube?: boolean
  /** Optional nested filters (e.g. Place → cafe / park). */
  subcategories: TasteSubcategory[]
}

export interface TasteSticker {
  id: string
  /** Category id (legacy field `kind` is migrated on load). */
  categoryId: string
  /** Optional subcategory id within `categoryId`; empty = none. */
  subcategoryId: string
  title: string
  /** Optional artist / director / neighborhood, etc. */
  subtitle: string
  note: string
  link: string
  /** Compressed JPEG data URL for the polaroid photo. */
  imageDataUrl: string
  /** Solid swatch hex for the colours category (e.g. #3A7BD5). */
  colorHex: string
  /** YYYY-MM-DD when this taste felt true; empty = undated (View all only). */
  dateKey: string
  createdAt: string
  /** Stable visual tilt for polaroid feel (-4..4). */
  tilt: number
  /** Polaroid paper / caption-strip color from the scrapbook palette. */
  stripColor: string
  accent: string
}

export interface TasteStore {
  categories: TasteCategory[]
  stickers: TasteSticker[]
  /** Per-month full-bleed backgrounds keyed by YYYY-MM (compressed data URLs). */
  monthBackgrounds: Record<string, string>
}

/** Built-in scrapbook stripe used when a month has no custom background. */
export const DEFAULT_TASTE_BACKGROUND = '/taste/stripe-bg.png'

const CATEGORY_ACCENTS = [
  '#FF2D55',
  '#5856D6',
  '#007AFF',
  '#34C759',
  '#FF9500',
  '#AF52DE',
  '#FF3B30',
  '#5AC8FA',
  '#FFCC00',
  '#8E8E93',
] as const

export const DEFAULT_TASTE_CATEGORIES: TasteCategory[] = [
  { id: 'music', name: 'Music', accent: '#FF2D55', youtube: true, subcategories: [] },
  { id: 'movie', name: 'Movie', accent: '#007AFF', subcategories: [] },
  { id: 'place', name: 'Place', accent: '#34C759', subcategories: [] },
  { id: 'food', name: 'Food', accent: '#FF9500', subcategories: [] },
  { id: 'other', name: 'Other', accent: '#AF52DE', subcategories: [] },
]

/** Figma scrapbook polaroid strip tones (cream + warm browns). */
export const POLAROID_STRIP_COLORS = [
  '#fffac0', // buttermilk cream
  '#42240f', // dark chocolate
  '#947762', // muted taupe
  '#662a00', // sienna
  '#5c3420', // coffee brown
  '#8b5a2b', // warm brown
  '#c4a574', // tan
  '#d4b896', // sand
  '#3a2010', // near-black brown
  '#6b3e26', // rust brown
] as const

export function randomPolaroidStripColor(): string {
  const i = Math.floor(Math.random() * POLAROID_STRIP_COLORS.length)
  return POLAROID_STRIP_COLORS[i]!
}

/** Stable pick for migrating stickers that never stored a strip color. */
export function stripColorFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return POLAROID_STRIP_COLORS[hash % POLAROID_STRIP_COLORS.length]!
}

export function isLightPolaroidStrip(color: string): boolean {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return color.toLowerCase() === '#fffac0'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Perceived luminance — cream/sand strips need dark text.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62
}

export function emptyTasteStore(): TasteStore {
  return {
    categories: DEFAULT_TASTE_CATEGORIES.map((c) => ({
      ...c,
      subcategories: c.subcategories.map((s) => ({ ...s })),
    })),
    stickers: [],
    monthBackgrounds: {},
  }
}

export function monthKeyFromParts(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

export function nextCategoryAccent(categories: TasteCategory[]): string {
  return CATEGORY_ACCENTS[categories.length % CATEGORY_ACCENTS.length]!
}

export function tasteCategoryMeta(
  categories: TasteCategory[],
  categoryId: string,
): TasteCategory {
  return (
    categories.find((c) => c.id === categoryId) ??
    categories[categories.length - 1] ??
    DEFAULT_TASTE_CATEGORIES[DEFAULT_TASTE_CATEGORIES.length - 1]!
  )
}

export function tasteSubcategoryMeta(
  category: TasteCategory | undefined,
  subcategoryId: string | undefined | null,
): TasteSubcategory | null {
  if (!category || !subcategoryId) return null
  return category.subcategories.find((s) => s.id === subcategoryId) ?? null
}

/** Pill label: "Place · Cafe" or just "Place". */
export function tasteTagLabel(
  category: TasteCategory,
  subcategoryId: string | undefined | null,
): string {
  const sub = tasteSubcategoryMeta(category, subcategoryId)
  return sub ? `${category.name} · ${sub.name}` : category.name
}

export function categoryAllowsYoutube(category: TasteCategory | undefined): boolean {
  if (!category) return false
  if (category.youtube) return true
  return category.name.trim().toLowerCase() === 'music'
}

/** User-created scrapbook category for colour swatches instead of photos. */
export function isColourCategory(category: TasteCategory | undefined): boolean {
  if (!category) return false
  const id = category.id.trim().toLowerCase()
  const name = category.name.trim().toLowerCase()
  return id === 'colours' || id === 'colors' || name === 'colours' || name === 'colors'
}

export function normalizeHexColor(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const m = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  let hex = m[1]!
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return `#${hex.toUpperCase()}`
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const norm = normalizeHexColor(hex) ?? '#808080'
  const n = parseInt(norm.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100
  const lig = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lig - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const toByte = (v: number) =>
    Math.round(Math.max(0, Math.min(255, (v + m) * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase()
}

export function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/** True when the polaroid is tied to a calendar day (shows in month views). */
export function hasTasteDate(dateKey: string | undefined | null): boolean {
  return Boolean(dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
}

/** Extract an 11-char YouTube video id from a URL or bare id. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (/^[\w-]{11}$/.test(raw)) return raw
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        const id = parts[1]
        return id && /^[\w-]{11}$/.test(id) ? id : null
      }
    }
  } catch {
    return null
  }
  return null
}

export function youtubeThumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function youtubeEmbedUrl(videoId: string, opts?: { autoplay?: boolean; mute?: boolean }) {
  const params = new URLSearchParams({
    autoplay: opts?.autoplay ? '1' : '0',
    mute: opts?.mute ? '1' : '0',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  })
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}
