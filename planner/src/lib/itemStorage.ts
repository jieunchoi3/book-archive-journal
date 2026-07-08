import type { Category, Item, Tag } from '../types/item'
import { nextCategoryColor } from '../types/item'
import { generateId } from './weekUtils'

const CATEGORIES_KEY = 'planner:categories'
const TAGS_KEY = 'planner:tags'
const ITEMS_KEY = 'planner:items'
const LEGACY_EVENTS_KEY = 'planner:events'
const MIGRATED_KEY = 'planner:items-migrated'

interface LegacyEvent {
  id: string
  title: string
  icon?: string
  anchorDate: string
  allDay: boolean
  time?: string
  recurrence: { freq: string; interval: number; byDay?: string[]; until?: string | null }
  checkable: boolean
  done?: Record<string, boolean>
}

export interface ItemsStore {
  categories: Category[]
  tags: Tag[]
  items: Item[]
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // fall through
  }
  return fallback
}

function migrateLegacyEvents(store: ItemsStore): ItemsStore {
  if (localStorage.getItem(MIGRATED_KEY)) return store

  const legacy = loadJson<LegacyEvent[]>(LEGACY_EVENTS_KEY, [])
  if (legacy.length === 0) {
    localStorage.setItem(MIGRATED_KEY, 'true')
    return store
  }

  const eventCategory: Category = {
    id: generateId(),
    name: 'Event',
    color: nextCategoryColor(store.categories),
  }

  const migratedItems: Item[] = legacy.map((e) => {
    const recurring = e.recurrence.freq !== 'none'
    return {
      id: e.id,
      title: e.icon ? `${e.icon} ${e.title}` : e.title,
      categoryId: eventCategory.id,
      tagIds: [],
      dueDate: e.anchorDate,
      recurrence: recurring
        ? {
            freq: e.recurrence.freq as 'daily' | 'weekly' | 'monthly' | 'yearly',
            interval: e.recurrence.interval,
            byDay: e.recurrence.byDay,
            until: e.recurrence.until,
          }
        : null,
      done: recurring
        ? (e.done ?? {})
        : !!(e.done?.[e.anchorDate]),
      showOnWeeklyView: true,
      time: e.time,
      checkable: e.checkable,
    }
  })

  localStorage.removeItem(LEGACY_EVENTS_KEY)
  localStorage.setItem(MIGRATED_KEY, 'true')

  return {
    categories: [...store.categories, eventCategory],
    tags: store.tags,
    items: [...store.items, ...migratedItems],
  }
}

export function loadItemsStore(): ItemsStore {
  let store: ItemsStore = {
    categories: loadJson(CATEGORIES_KEY, []),
    tags: loadJson(TAGS_KEY, []),
    items: loadJson(ITEMS_KEY, []),
  }
  store = migrateLegacyEvents(store)
  return store
}

export function saveItemsStore(store: ItemsStore): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(store.categories))
  localStorage.setItem(TAGS_KEY, JSON.stringify(store.tags))
  localStorage.setItem(ITEMS_KEY, JSON.stringify(store.items))
}
