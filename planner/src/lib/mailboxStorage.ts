import type { MailboxStore } from '../types/mailbox'
import { emptyMailboxStore } from '../types/mailbox'
import {
  deleteMailboxLetterCloud,
  deleteMailboxPromptCloud,
  fetchMailboxCloud,
  syncMailboxToCloud,
} from './mailboxCloud'
import { isSupabaseConfigured } from './supabase'

const KEY_PREFIX = 'planner:mailbox:'
const PENDING_SUFFIX = ':pending-upload-ids'

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

function pendingKey(userId: string) {
  return `${KEY_PREFIX}${userId}${PENDING_SUFFIX}`
}

function loadPendingUploadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(pendingKey(userId))
    if (!raw) return new Set()
    const ids = JSON.parse(raw) as string[]
    return new Set(ids)
  } catch {
    return new Set()
  }
}

function savePendingUploadIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(pendingKey(userId), JSON.stringify([...ids]))
  } catch {
    // ignore quota
  }
}

/** Rows created offline or before first successful cloud push. */
export function markMailboxPendingUpload(userId: string, ids: string[]): void {
  const pending = loadPendingUploadIds(userId)
  for (const id of ids) pending.add(id)
  savePendingUploadIds(userId, pending)
}

function markMailboxSynced(userId: string, store: MailboxStore): void {
  const pending = loadPendingUploadIds(userId)
  for (const p of store.prompts) pending.delete(p.id)
  for (const l of store.letters) pending.delete(l.id)
  savePendingUploadIds(userId, pending)
}

function removeFromPending(userId: string, ids: string[]): void {
  const pending = loadPendingUploadIds(userId)
  for (const id of ids) pending.delete(id)
  savePendingUploadIds(userId, pending)
}

function ensurePendingForLegacyLocalOnly(
  userId: string,
  cloud: MailboxStore,
  local: MailboxStore,
): Set<string> {
  const pending = loadPendingUploadIds(userId)
  const cloudPromptIds = new Set(cloud.prompts.map((p) => p.id))
  const cloudLetterIds = new Set(cloud.letters.map((l) => l.id))
  for (const p of local.prompts) {
    if (!cloudPromptIds.has(p.id)) pending.add(p.id)
  }
  for (const l of local.letters) {
    if (!cloudLetterIds.has(l.id)) pending.add(l.id)
  }
  savePendingUploadIds(userId, pending)
  return pending
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

/**
 * Cloud is source of truth for deletes. Local rows missing from cloud are kept only
 * while marked pending upload (new on this device). Same-id rows merge field updates.
 */
export function mergeMailboxStores(
  cloud: MailboxStore,
  local: MailboxStore,
  pendingUploadIds: Set<string>,
): MailboxStore {
  const promptMap = new Map(cloud.prompts.map((p) => [p.id, p]))
  for (const p of local.prompts) {
    const cloudP = promptMap.get(p.id)
    if (!cloudP) {
      if (pendingUploadIds.has(p.id)) promptMap.set(p.id, p)
      continue
    }
    promptMap.set(p.id, {
      ...cloudP,
      nextDueOn: p.nextDueOn > cloudP.nextDueOn ? p.nextDueOn : cloudP.nextDueOn,
      isActive: cloudP.isActive && p.isActive,
      body: cloudP.body.length >= p.body.length ? cloudP.body : p.body,
    })
  }

  const letterMap = new Map(cloud.letters.map((l) => [l.id, l]))
  for (const l of local.letters) {
    const cloudL = letterMap.get(l.id)
    if (!cloudL) {
      if (pendingUploadIds.has(l.id)) letterMap.set(l.id, l)
      continue
    }
    const openedAt =
      cloudL.openedAt && l.openedAt
        ? cloudL.openedAt > l.openedAt
          ? cloudL.openedAt
          : l.openedAt
        : cloudL.openedAt ?? l.openedAt
    letterMap.set(l.id, { ...cloudL, openedAt, feeling: l.feeling ?? cloudL.feeling })
  }

  return {
    prompts: [...promptMap.values()],
    letters: [...letterMap.values()],
  }
}

export async function loadMailbox(userId: string): Promise<MailboxStore> {
  const local = loadMailboxLocal(userId)
  if (!isSupabaseConfigured) return local

  try {
    const cloud = await fetchMailboxCloud(userId)
    const pending = ensurePendingForLegacyLocalOnly(userId, cloud, local)
    const merged = mergeMailboxStores(cloud, local, pending)
    saveMailboxLocal(userId, merged)
    try {
      await syncMailboxToCloud(merged)
      markMailboxSynced(userId, merged)
    } catch (syncErr) {
      console.warn('[mailbox] push to cloud failed', syncErr)
      throw syncErr
    }
    return merged
  } catch (e) {
    console.warn('[mailbox] cloud load failed', e)
    if (local.prompts.length > 0 || local.letters.length > 0) return local
    throw e
  }
}

export async function persistMailbox(userId: string, store: MailboxStore): Promise<void> {
  saveMailboxLocal(userId, store)
  if (!isSupabaseConfigured) return
  await syncMailboxToCloud(store)
  markMailboxSynced(userId, store)
}

export async function deleteMailboxPrompt(userId: string, promptId: string): Promise<void> {
  const local = loadMailboxLocal(userId)
  const next: MailboxStore = {
    prompts: local.prompts.filter((p) => p.id !== promptId),
    letters: local.letters.filter((l) => l.promptId !== promptId),
  }
  saveMailboxLocal(userId, next)
  removeFromPending(userId, [promptId])
  if (!isSupabaseConfigured) return
  await deleteMailboxPromptCloud(promptId)
}

export async function deleteMailboxLetter(userId: string, letterId: string): Promise<void> {
  const local = loadMailboxLocal(userId)
  const next: MailboxStore = {
    ...local,
    letters: local.letters.filter((l) => l.id !== letterId),
  }
  saveMailboxLocal(userId, next)
  removeFromPending(userId, [letterId])
  if (!isSupabaseConfigured) return
  await deleteMailboxLetterCloud(letterId)
}
