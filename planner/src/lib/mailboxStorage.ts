import type { MailboxStore } from '../types/mailbox'
import { emptyMailboxStore } from '../types/mailbox'
import { fetchMailboxCloud, upsertMailboxLetterCloud, upsertMailboxPromptCloud } from './mailboxCloud'
import { isSupabaseConfigured } from './supabase'

const KEY_PREFIX = 'planner:mailbox:'

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

export function loadMailboxLocal(userId: string): MailboxStore {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return emptyMailboxStore()
    return JSON.parse(raw) as MailboxStore
  } catch {
    return emptyMailboxStore()
  }
}

export function saveMailboxLocal(userId: string, store: MailboxStore): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(store))
  } catch {
    // ignore quota
  }
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of base) map.set(item.id, item)
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}

export function mergeMailboxStores(cloud: MailboxStore, local: MailboxStore): MailboxStore {
  return {
    prompts: mergeById(cloud.prompts, local.prompts),
    letters: mergeById(cloud.letters, local.letters),
  }
}

export async function loadMailbox(userId: string): Promise<MailboxStore> {
  const local = loadMailboxLocal(userId)
  if (!isSupabaseConfigured) return local

  try {
    const cloud = await fetchMailboxCloud(userId)
    const merged = mergeMailboxStores(cloud, local)
    saveMailboxLocal(userId, merged)
    return merged
  } catch (e) {
    console.warn('[mailbox] cloud load failed', e)
    return local
  }
}

export async function persistMailbox(userId: string, store: MailboxStore): Promise<void> {
  saveMailboxLocal(userId, store)
  if (!isSupabaseConfigured) return

  await Promise.all([
    ...store.prompts.map((p) => upsertMailboxPromptCloud(p)),
    ...store.letters.map((l) => upsertMailboxLetterCloud(l)),
  ])
}
