import type { WishlistItem } from '../types/expense'

const BACKUP_PREFIX = 'planner:wishlist-backup:'
const MAX_BACKUPS = 8

interface WishlistBackupEntry {
  savedAt: string
  items: WishlistItem[]
}

function backupKey(userId: string) {
  return `${BACKUP_PREFIX}${userId}`
}

export function normalizeWishlistItems(items: WishlistItem[] | undefined): WishlistItem[] {
  return (items ?? []).map((item) => ({
    ...item,
    status: item.status ?? 'want',
    brand: item.brand ?? '',
    store: item.store ?? '',
    link: item.link ?? '',
    note: item.note ?? '',
  }))
}

export function saveWishlistBackup(userId: string, items: WishlistItem[]): void {
  if (!items.length) return
  try {
    const key = backupKey(userId)
    const existing = loadWishlistBackupEntries(userId)
    const normalized = normalizeWishlistItems(items)
    const latest = existing[0]
    if (
      latest &&
      latest.items.length === normalized.length &&
      JSON.stringify(latest.items.map((i) => i.id).sort()) ===
        JSON.stringify(normalized.map((i) => i.id).sort())
    ) {
      return
    }
    const next: WishlistBackupEntry[] = [
      { savedAt: new Date().toISOString(), items: normalized },
      ...existing,
    ].slice(0, MAX_BACKUPS)
    localStorage.setItem(key, JSON.stringify(next))
  } catch (e) {
    console.warn('[wishlist] backup save failed', e)
  }
}

export function loadWishlistBackupEntries(userId: string): WishlistBackupEntry[] {
  try {
    const raw = localStorage.getItem(backupKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as WishlistBackupEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry) => Array.isArray(entry.items) && entry.items.length > 0)
  } catch {
    return []
  }
}

export function loadLatestWishlistBackup(userId: string): WishlistItem[] {
  const entry = loadWishlistBackupEntries(userId)[0]
  return entry ? normalizeWishlistItems(entry.items) : []
}

export function restoreWishlistFromBackup(userId: string): WishlistItem[] {
  const merged = new Map<string, WishlistItem>()
  for (const entry of loadWishlistBackupEntries(userId)) {
    for (const item of normalizeWishlistItems(entry.items)) {
      if (!merged.has(item.id)) merged.set(item.id, item)
    }
  }
  return [...merged.values()]
}
