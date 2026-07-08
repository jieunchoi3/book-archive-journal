import type { LinkedApp } from '../types/linkedApp'
import { DEFAULT_LINKED_APPS } from '../types/linkedApp'

const STORAGE_KEY = 'planner:linkedApps'

function mergeWithDefaults(stored: LinkedApp[]): LinkedApp[] {
  const ids = new Set(stored.map((a) => a.id))
  const merged = [...stored]
  for (const def of DEFAULT_LINKED_APPS) {
    if (!ids.has(def.id)) {
      merged.push(structuredClone(def))
    }
  }
  return merged
}

export function loadLinkedApps(): LinkedApp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LinkedApp[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return mergeWithDefaults(parsed)
      }
    }
  } catch {
    // fall through
  }
  return structuredClone(DEFAULT_LINKED_APPS)
}

export function saveLinkedApps(apps: LinkedApp[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps))
}
