import type { WishlistItem } from '../types/expense'

const BACKUP_PREFIX = 'planner:wishlist-backup:'
const META_BACKUP_PREFIX = 'planner:wishlist-meta-backup:'
const MAX_BACKUPS = 12

interface WishlistBackupEntry {
  savedAt: string
  items: WishlistItem[]
}

function backupKey(userId: string) {
  return `${BACKUP_PREFIX}${userId}`
}

function metaBackupKey(userId: string) {
  return `${META_BACKUP_PREFIX}${userId}`
}

/** Strip photos so metadata backups stay small and always fit in localStorage. */
export function stripWishlistPhotos(item: WishlistItem): WishlistItem {
  return {
    ...item,
    imageDataUrl: undefined,
    imageDataUrls: undefined,
  }
}

export function normalizeWishlistItems(items: WishlistItem[] | undefined): WishlistItem[] {
  return (items ?? []).map((item) => {
    const legacyPhoto = item.imageDataUrl?.trim()
    const photos =
      item.imageDataUrls?.filter(Boolean) ??
      (legacyPhoto ? [legacyPhoto] : [])
    return {
      ...item,
      status: item.status ?? 'want',
      brand: item.brand ?? '',
      store: item.store ?? '',
      link: item.link ?? '',
      note: item.note ?? '',
      size: item.size ?? '',
      imageDataUrls: photos.length > 0 ? photos : undefined,
      imageDataUrl: undefined,
    }
  })
}

function mergeWishlistById(primary: WishlistItem[], secondary: WishlistItem[]): WishlistItem[] {
  const map = new Map<string, WishlistItem>()
  for (const item of secondary) map.set(item.id, item)
  for (const item of primary) {
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
      continue
    }
    const existingPhotos =
      existing.imageDataUrls?.length ??
      (existing.imageDataUrl?.trim() ? 1 : 0)
    const itemPhotos =
      item.imageDataUrls?.length ?? (item.imageDataUrl?.trim() ? 1 : 0)
    map.set(item.id, itemPhotos >= existingPhotos ? item : existing)
  }
  return [...map.values()]
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

/** Lightweight text-only backup — survives even when full store sync fails. */
export function saveWishlistMetadataBackup(userId: string, items: WishlistItem[]): void {
  if (!items.length) return
  try {
    const normalized = normalizeWishlistItems(items).map(stripWishlistPhotos)
    localStorage.setItem(
      metaBackupKey(userId),
      JSON.stringify({ savedAt: new Date().toISOString(), items: normalized }),
    )
  } catch (e) {
    console.warn('[wishlist] metadata backup save failed', e)
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

export function loadWishlistMetadataBackup(userId: string): WishlistItem[] {
  try {
    const raw = localStorage.getItem(metaBackupKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as WishlistBackupEntry
    if (!Array.isArray(parsed.items)) return []
    return normalizeWishlistItems(parsed.items)
  } catch {
    return []
  }
}

export function loadLatestWishlistBackup(userId: string): WishlistItem[] {
  const entry = loadWishlistBackupEntries(userId)[0]
  return entry ? normalizeWishlistItems(entry.items) : []
}

export function restoreWishlistFromBackup(userId: string): WishlistItem[] {
  const meta = loadWishlistMetadataBackup(userId)
  const merged = new Map<string, WishlistItem>()
  for (const entry of [...loadWishlistBackupEntries(userId)].reverse()) {
    for (const item of normalizeWishlistItems(entry.items)) {
      merged.set(item.id, item)
    }
  }
  for (const item of meta) {
    const existing = merged.get(item.id)
    merged.set(item.id, existing ? mergeWishlistById([item], [existing])[0]! : item)
  }
  return [...merged.values()]
}
