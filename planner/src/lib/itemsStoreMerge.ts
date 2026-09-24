import type { ItemsStore } from './itemStorageLegacy'
import type { Item } from '../types/item'

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
    categories: cloud.categories.length > 0 ? cloud.categories : local.categories,
    tags: cloud.tags.length > 0 ? cloud.tags : local.tags,
    items,
  }
}
