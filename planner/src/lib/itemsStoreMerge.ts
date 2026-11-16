import type { ItemsStore } from './itemStorageLegacy'
import type { Category, Item, Tag } from '../types/item'

function mergeById<T extends { id: string }>(cloud: T[], local: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of cloud) map.set(row.id, row)
  for (const row of local) {
    const existing = map.get(row.id)
    map.set(row.id, existing ? { ...existing, ...row, id: row.id } : row)
  }
  return [...map.values()]
}

/** Prefer local item rows (same id) so recent check-offs survive before cloud sync. */
export function mergeItemsStores(cloud: ItemsStore, local: ItemsStore): ItemsStore {
  const localById = new Map(local.items.map((item) => [item.id, item]))
  const seen = new Set<string>()

  const items: Item[] = cloud.items.map((cloudItem) => {
    seen.add(cloudItem.id)
    const localItem = localById.get(cloudItem.id)
    if (!localItem) return cloudItem
    return { ...cloudItem, ...localItem, id: cloudItem.id }
  })

  for (const localItem of local.items) {
    if (!seen.has(localItem.id)) items.push(localItem)
  }

  return {
    categories: mergeById<Category>(cloud.categories, local.categories),
    tags: mergeById<Tag>(cloud.tags, local.tags),
    items,
  }
}
