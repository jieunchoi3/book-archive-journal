import { fetchItemsStore, syncItemsStore } from './supabaseRepository'
import type { ItemsStore } from './itemStorageLegacy'
import { loadItemsStoreFromLegacy } from './localStorageLegacy'
import { mergeItemsStores } from './itemsStoreMerge'
import { loadItemsStoreLocal, saveItemsStoreLocal } from './plannerLocalCache'

function loadLocalItemsStore(userId: string): ItemsStore | null {
  const scoped = loadItemsStoreLocal(userId)
  if (scoped && scoped.items.length > 0) return scoped

  const legacy = loadItemsStoreFromLegacy()
  if (legacy.items.length > 0) {
    saveItemsStoreLocal(userId, legacy)
    return legacy
  }
  return scoped
}

export async function loadItemsStoreMerged(userId: string): Promise<ItemsStore> {
  const cloud = await fetchItemsStore(userId)
  const local = loadLocalItemsStore(userId)

  if (!local || local.items.length === 0) {
    saveItemsStoreLocal(userId, cloud)
    return cloud
  }

  const merged = mergeItemsStores(cloud, local)
  saveItemsStoreLocal(userId, merged)
  const cloudItemIds = new Set(cloud.items.map((i) => i.id))
  const hasLocalOnlyItems = merged.items.some((i) => !cloudItemIds.has(i.id))
  if (
    hasLocalOnlyItems ||
    merged.items.length > cloud.items.length ||
    merged.categories.length > cloud.categories.length ||
    merged.tags.length > cloud.tags.length
  ) {
    try {
      await syncItemsStore(userId, merged)
    } catch (e) {
      console.error('[planner] push merged items store to cloud failed', e)
    }
  }
  return merged
}
