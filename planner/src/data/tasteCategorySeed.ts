import type { TasteCategory } from '../types/taste'

/** Stable IDs so restore stays consistent across devices. */
export const RESTORED_TASTE_CATEGORIES: TasteCategory[] = [
  {
    id: 'music',
    name: 'Music',
    accent: '#FF2D55',
    youtube: true,
    subcategories: [],
  },
  {
    id: 'movie',
    name: 'Show',
    accent: '#007AFF',
    youtube: false,
    subcategories: [
      { id: 'show-movie', name: 'movie' },
      { id: 'show-anime', name: 'anime' },
      { id: 'show-drama', name: 'drama' },
      { id: 'show-reality-show', name: 'reality show' },
      { id: 'show-youtuber', name: 'youtuber' },
    ],
  },
  {
    id: 'place',
    name: 'Place',
    accent: '#34C759',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'food',
    name: 'Food',
    accent: '#FF9500',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-random-interest',
    name: 'random interest',
    accent: '#5856D6',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-celebrity',
    name: '연예인/인플루언서',
    accent: '#AF52DE',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-happy-moments',
    name: '행복한 순간들',
    accent: '#FF3B30',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-webtoon',
    name: 'Webtoon',
    accent: '#5AC8FA',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-books',
    name: 'Books',
    accent: '#FFCC00',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-ideal-types',
    name: '이상형들..',
    accent: '#8E8E93',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-what-i-like',
    name: 'What I like doing',
    accent: '#FF2D55',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-fragrance',
    name: 'fragrance',
    accent: '#34C759',
    youtube: false,
    subcategories: [],
  },
  {
    id: 'taste-colours',
    name: 'colours',
    accent: '#AF52DE',
    youtube: false,
    subcategories: [],
  },
]

const RESTORED_NAMES = new Set(
  RESTORED_TASTE_CATEGORIES.map((c) => c.name.trim().toLowerCase()),
)

export function categoryNameKey(name: string): string {
  return name.trim().toLowerCase()
}

/** True when the store still has only factory defaults (wiped custom list). */
export function needsTasteCategoryRestore(categories: TasteCategory[]): boolean {
  if (categories.length <= 5) {
    return !categories.some(
      (c) => !['music', 'movie', 'place', 'food', 'other'].includes(c.id),
    )
  }
  const hasAll = RESTORED_TASTE_CATEGORIES.every((seed) =>
    categories.some((c) => categoryNameKey(c.name) === categoryNameKey(seed.name)),
  )
  return !hasAll
}

/** Merge seed categories in, keep stickers on valid ids, preserve unknown extras. */
export function applyRestoredTasteCategories(
  categories: TasteCategory[],
): TasteCategory[] {
  const byName = new Map(categories.map((c) => [categoryNameKey(c.name), c]))
  const merged = RESTORED_TASTE_CATEGORIES.map((seed) => {
    const existing = byName.get(categoryNameKey(seed.name))
    if (!existing) return { ...seed, subcategories: [...seed.subcategories] }
    return {
      ...seed,
      id: existing.id === seed.id || seed.id.startsWith('taste-') ? seed.id : existing.id,
      subcategories:
        seed.subcategories.length > 0
          ? [...seed.subcategories]
          : [...existing.subcategories],
    }
  })

  for (const cat of categories) {
    if (RESTORED_NAMES.has(categoryNameKey(cat.name))) continue
    if (merged.some((c) => c.id === cat.id)) continue
    merged.push({ ...cat, subcategories: [...cat.subcategories] })
  }

  return merged
}
