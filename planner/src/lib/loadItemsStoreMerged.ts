import { fetchItemsStore } from './supabaseRepository'
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
  return merged
}
