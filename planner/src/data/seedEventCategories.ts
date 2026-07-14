import type { Category } from '../types/item'
import { generateId } from '../lib/weekUtils'

/** Default event categories — merged on load if missing by name. */
export const DEFAULT_EVENT_CATEGORIES: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Red pants', color: '#FF3B30' },
  { name: 'Snap', color: '#5856D6' },
  { name: 'social', color: '#E8A838' },
]

export function mergeDefaultEventCategories(categories: Category[]): Category[] {
  const result = [...categories]
  for (const def of DEFAULT_EVENT_CATEGORIES) {
    const exists = result.some((c) => c.name.toLowerCase() === def.name.toLowerCase())
    if (!exists) {
      result.push({ id: generateId(), name: def.name, color: def.color })
    }
  }
  return result
}
