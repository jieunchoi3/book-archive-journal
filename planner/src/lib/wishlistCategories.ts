import type {
  ExpensePurposeKindLink,
  ExpenseSpendKind,
  WishlistCategory,
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from '../types/expense'
import { SEED_KIND_IDS, SEED_PURPOSE_IDS } from '../types/expense'
import { generateId } from './weekUtils'

export const WISHLIST_MAX_DEPTH = 3

export type WishlistFilter =
  | { type: 'all' }
  | { type: 'purchased' }
  | { type: 'category'; categoryId: string }
  | { type: 'store'; storeKey: string }
  | { type: 'brand'; brandKey: string }

export interface WishlistFacetOption {
  /** Normalized key for matching (trimmed, lowercased). */
  key: string
  /** Display label (first seen casing). */
  label: string
  count: number
}

export interface WishlistTreeNode {
  id: string
  name: string
  parentId: string | null
  depth: number
  sortOrder: number
  itemCount: number
  directItemCount: number
  children: WishlistTreeNode[]
}

/** Stable seed ids for default wishlist taxonomy. */
export const SEED_WISHLIST_CATEGORY_IDS = {
  cosmetics: 'wish-cosmetics',
  clothes: 'wish-clothes',
  jacket: 'wish-clothes-jacket',
  tops: 'wish-clothes-tops',
  bottoms: 'wish-clothes-bottoms',
  shoes: 'wish-clothes-shoes',
  electronics: 'wish-electronics',
  household: 'wish-household',
  other: 'wish-other',
} as const

const DEFAULT_WISHLIST_SEED: WishlistCategory[] = [
  { id: SEED_WISHLIST_CATEGORY_IDS.cosmetics, name: '화장품', parentId: null, sortOrder: 0 },
  { id: SEED_WISHLIST_CATEGORY_IDS.clothes, name: '옷', parentId: null, sortOrder: 1 },
  { id: SEED_WISHLIST_CATEGORY_IDS.jacket, name: '자켓', parentId: SEED_WISHLIST_CATEGORY_IDS.clothes, sortOrder: 0 },
  { id: SEED_WISHLIST_CATEGORY_IDS.tops, name: '상의', parentId: SEED_WISHLIST_CATEGORY_IDS.clothes, sortOrder: 1 },
  { id: SEED_WISHLIST_CATEGORY_IDS.bottoms, name: '하의', parentId: SEED_WISHLIST_CATEGORY_IDS.clothes, sortOrder: 2 },
  { id: SEED_WISHLIST_CATEGORY_IDS.shoes, name: '신발', parentId: SEED_WISHLIST_CATEGORY_IDS.clothes, sortOrder: 3 },
  { id: SEED_WISHLIST_CATEGORY_IDS.electronics, name: '전자기기', parentId: null, sortOrder: 2 },
  { id: SEED_WISHLIST_CATEGORY_IDS.household, name: '생활용품', parentId: null, sortOrder: 3 },
  { id: SEED_WISHLIST_CATEGORY_IDS.other, name: '기타', parentId: null, sortOrder: 4 },
]

export function seedDefaultWishlistCategories(): WishlistCategory[] {
  return DEFAULT_WISHLIST_SEED.map((c) => ({ ...c }))
}

export function ensureWishlistSeed(
  categories: WishlistCategory[] | undefined,
): WishlistCategory[] {
  if (categories?.length) return categories
  return seedDefaultWishlistCategories()
}

export function wishlistCategoryMap(
  categories: WishlistCategory[],
): Map<string, WishlistCategory> {
  return new Map(categories.map((c) => [c.id, c]))
}

export function categoryDepth(
  categories: WishlistCategory[],
  categoryId: string,
): number {
  const map = wishlistCategoryMap(categories)
  let depth = 0
  let current = map.get(categoryId)
  while (current?.parentId) {
    depth += 1
    current = map.get(current.parentId)
  }
  return depth
}

export function categoryPath(
  categories: WishlistCategory[],
  categoryId: string,
): WishlistCategory[] {
  const map = wishlistCategoryMap(categories)
  const path: WishlistCategory[] = []
  let current = map.get(categoryId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? map.get(current.parentId) : undefined
  }
  return path
}

export function categoryPathLabel(
  categories: WishlistCategory[],
  categoryId: string,
): string {
  return categoryPath(categories, categoryId)
    .map((c) => c.name)
    .join(' · ')
}

export function descendantCategoryIds(
  categories: WishlistCategory[],
  categoryId: string,
): Set<string> {
  const childrenByParent = new Map<string | null, WishlistCategory[]>()
  for (const cat of categories) {
    const list = childrenByParent.get(cat.parentId) ?? []
    list.push(cat)
    childrenByParent.set(cat.parentId, list)
  }
  const out = new Set<string>([categoryId])
  const stack = [categoryId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of childrenByParent.get(id) ?? []) {
      if (out.has(child.id)) continue
      out.add(child.id)
      stack.push(child.id)
    }
  }
  return out
}

export function childrenOf(
  categories: WishlistCategory[],
  parentId: string | null,
): WishlistCategory[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'))
}

export function buildWishlistTree(
  categories: WishlistCategory[],
  items: WishlistItem[],
): WishlistTreeNode[] {
  const activeItems = items.filter((i) => i.status === 'want')
  const directCounts = new Map<string, number>()
  for (const item of activeItems) {
    directCounts.set(item.categoryId, (directCounts.get(item.categoryId) ?? 0) + 1)
  }

  const buildNode = (cat: WishlistCategory, depth: number): WishlistTreeNode => {
    const childCats = childrenOf(categories, cat.id)
    const children = childCats.map((c) => buildNode(c, depth + 1))
    const directItemCount = directCounts.get(cat.id) ?? 0
    const itemCount =
      directItemCount + children.reduce((sum, child) => sum + child.itemCount, 0)
    return {
      id: cat.id,
      name: cat.name,
      parentId: cat.parentId,
      depth,
      sortOrder: cat.sortOrder,
      itemCount,
      directItemCount,
      children,
    }
  }

  return childrenOf(categories, null).map((c) => buildNode(c, 0))
}

export function normalizeWishlistFacetKey(value: string): string {
  return value.trim().toLowerCase()
}

function buildFacetOptions(
  items: WishlistItem[],
  pick: (item: WishlistItem) => string,
): WishlistFacetOption[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const item of items) {
    if (item.status !== 'want') continue
    const raw = pick(item).trim()
    if (!raw) continue
    const key = normalizeWishlistFacetKey(raw)
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { label: raw, count: 1 })
    }
  }
  return [...counts.entries()]
    .map(([key, { label, count }]) => ({ key, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
}

export function buildWishlistStoreOptions(items: WishlistItem[]): WishlistFacetOption[] {
  return buildFacetOptions(items, (item) => item.store)
}

export function buildWishlistBrandOptions(items: WishlistItem[]): WishlistFacetOption[] {
  return buildFacetOptions(items, (item) => item.brand)
}

export function wishlistFilterLabel(
  filter: WishlistFilter,
  categories: WishlistCategory[],
  storeOptions: WishlistFacetOption[],
  brandOptions: WishlistFacetOption[],
): string {
  if (filter.type === 'all') return 'All items'
  if (filter.type === 'purchased') return 'Purchased'
  if (filter.type === 'category') return categoryPathLabel(categories, filter.categoryId)
  if (filter.type === 'store') {
    return storeOptions.find((o) => o.key === filter.storeKey)?.label ?? filter.storeKey
  }
  return brandOptions.find((o) => o.key === filter.brandKey)?.label ?? filter.brandKey
}

export function itemMatchesFilter(
  item: WishlistItem,
  filter: WishlistFilter,
  categories: WishlistCategory[],
): boolean {
  if (filter.type === 'purchased') return item.status === 'purchased'
  if (filter.type === 'all') return item.status === 'want'
  if (filter.type === 'category') {
    if (item.status !== 'want') return false
    return descendantCategoryIds(categories, filter.categoryId).has(item.categoryId)
  }
  if (filter.type === 'store') {
    if (item.status !== 'want') return false
    return normalizeWishlistFacetKey(item.store) === filter.storeKey
  }
  if (filter.type === 'brand') {
    if (item.status !== 'want') return false
    return normalizeWishlistFacetKey(item.brand) === filter.brandKey
  }
  return true
}

export function defaultWishlistCategoryId(categories: WishlistCategory[]): string {
  return categories.find((c) => c.parentId === null)?.id ?? categories[0]?.id ?? ''
}

export function canAddChildCategory(
  categories: WishlistCategory[],
  parentId: string | null,
): boolean {
  if (parentId === null) return true
  return categoryDepth(categories, parentId) < WISHLIST_MAX_DEPTH - 1
}

export function createWishlistCategory(
  categories: WishlistCategory[],
  input: { name: string; parentId: string | null },
): WishlistCategory | null {
  const trimmed = input.name.trim()
  if (!trimmed) return null
  if (!canAddChildCategory(categories, input.parentId)) return null
  const siblings = childrenOf(categories, input.parentId)
  return {
    id: generateId(),
    name: trimmed,
    parentId: input.parentId,
    sortOrder: siblings.length,
  }
}

export function collectDescendantCategoryIds(
  categories: WishlistCategory[],
  categoryId: string,
): string[] {
  return [...descendantCategoryIds(categories, categoryId)]
}

const ROOT_KIND_MAP: Record<string, string> = {
  [SEED_WISHLIST_CATEGORY_IDS.cosmetics]: SEED_KIND_IDS.beauty,
  [SEED_WISHLIST_CATEGORY_IDS.clothes]: SEED_KIND_IDS.clothes,
  [SEED_WISHLIST_CATEGORY_IDS.jacket]: SEED_KIND_IDS.clothes,
  [SEED_WISHLIST_CATEGORY_IDS.tops]: SEED_KIND_IDS.clothes,
  [SEED_WISHLIST_CATEGORY_IDS.bottoms]: SEED_KIND_IDS.clothes,
  [SEED_WISHLIST_CATEGORY_IDS.shoes]: SEED_KIND_IDS.clothes,
  [SEED_WISHLIST_CATEGORY_IDS.electronics]: SEED_KIND_IDS.misc,
  [SEED_WISHLIST_CATEGORY_IDS.household]: SEED_KIND_IDS.misc,
  [SEED_WISHLIST_CATEGORY_IDS.other]: SEED_KIND_IDS.misc,
}

export function suggestExpenseKindForCategory(
  categories: WishlistCategory[],
  categoryId: string,
  spendKinds: ExpenseSpendKind[],
): string | null {
  const path = categoryPath(categories, categoryId)
  const root = path[0]
  if (!root) return null

  const mappedId = ROOT_KIND_MAP[root.id]
  if (mappedId && spendKinds.some((k) => k.id === mappedId)) return mappedId

  const rootName = root.name.toLowerCase()
  const byName = spendKinds.find((k) => {
    const kn = k.name.toLowerCase()
    return kn === rootName || rootName.includes(kn) || kn.includes(rootName)
  })
  return byName?.id ?? spendKinds.find((k) => k.id === SEED_KIND_IDS.misc)?.id ?? null
}

export function suggestExpensePurposeForKind(
  spendKindId: string,
  links: ExpensePurposeKindLink[],
): string | null {
  const match = links.find((l) => l.spendKindId === spendKindId)
  if (match) return match.purposeId
  return links.find((l) => l.purposeId === SEED_PURPOSE_IDS.forMe)?.purposeId ?? null
}

export function wishlistPriorityLabel(priority: WishlistPriority): string {
  switch (priority) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    default:
      return 'Low'
  }
}

export function wishlistStatusLabel(status: WishlistStatus): string {
  switch (status) {
    case 'purchased':
      return 'Purchased'
    case 'dropped':
      return 'Dropped'
    default:
      return 'Want'
  }
}

export function buildWishlistNote(
  item: Pick<WishlistItem, 'store' | 'brand' | 'name' | 'size' | 'note'>,
): string {
  const title = wishlistItemTitle(item)
  const size = item.size?.trim()
  const withSize = size ? (title ? `${title} (${size})` : size) : title
  if (!item.note.trim()) return withSize
  if (!withSize) return item.note.trim()
  return `${withSize} — ${item.note.trim()}`
}

export function wishlistItemTitle(
  item: Pick<WishlistItem, 'store' | 'brand' | 'name'>,
): string {
  const product = [item.brand.trim(), item.name.trim()].filter(Boolean).join(' ')
  const store = item.store.trim()
  if (store && product) return `${store} · ${product}`
  return store || product
}

export function wishlistItemSubtitle(
  item: Pick<WishlistItem, 'store' | 'brand' | 'name' | 'size'>,
): string | null {
  const store = item.store.trim()
  const brand = item.brand.trim()
  const size = item.size?.trim() ?? ''
  const parts: string[] = []
  if (store) parts.push(store)
  if (brand) parts.push(brand)
  if (size) parts.push(`Size ${size}`)
  if (parts.length === 0) return null
  return parts.join(' · ')
}
