import type {
  LdAiReport,
  LdAnswer,
  LdJournalEntry,
  LdProtoIdea,
  LdProtoQuestion,
  LdPrototype,
  LdQuestion,
  LdSnapshot,
} from '../types/compass'
import {
  normalizeJournalEntry,
  normalizeProtoIdea,
  normalizeProtoQuestion,
  normalizePrototype,
} from '../types/compass'

const DB_NAME = 'compass-db'
const DB_VERSION = 1
const STORE = 'compass'

export interface CompassLocalStore {
  snapshots: LdSnapshot[]
  questions: LdQuestion[]
  answers: LdAnswer[]
  journalEntries: LdJournalEntry[]
  prototypes: LdPrototype[]
  protoQuestions: LdProtoQuestion[]
  protoIdeas: LdProtoIdea[]
  aiReports: LdAiReport[]
  updatedAt: string
}

function emptyStore(): CompassLocalStore {
  return {
    snapshots: [],
    questions: [],
    answers: [],
    journalEntries: [],
    prototypes: [],
    protoQuestions: [],
    protoIdeas: [],
    aiReports: [],
    updatedAt: new Date(0).toISOString(),
  }
}

function normalizeStore(raw: Partial<CompassLocalStore> | undefined): CompassLocalStore {
  const base = emptyStore()
  if (!raw) return base
  return {
    snapshots: raw.snapshots ?? [],
    questions: raw.questions ?? [],
    answers: raw.answers ?? [],
    journalEntries: (raw.journalEntries ?? [])
      .map((e) => normalizeJournalEntry(e))
      .filter((e): e is LdJournalEntry => Boolean(e?.id)),
    prototypes: (raw.prototypes ?? [])
      .map((p) => normalizePrototype(p))
      .filter((p): p is LdPrototype => Boolean(p?.id)),
    protoQuestions: (raw.protoQuestions ?? [])
      .map((q) => normalizeProtoQuestion(q))
      .filter((q): q is LdProtoQuestion => Boolean(q?.id)),
    protoIdeas: (raw.protoIdeas ?? [])
      .map((i) => normalizeProtoIdea(i))
      .filter((i): i is LdProtoIdea => Boolean(i?.id)),
    aiReports: raw.aiReports ?? [],
    updatedAt: raw.updatedAt ?? base.updatedAt,
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadCompassLocal(userId: string): Promise<CompassLocalStore> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(userId)
    req.onsuccess = () => {
      resolve(normalizeStore(req.result as Partial<CompassLocalStore> | undefined))
    }
    req.onerror = () => reject(req.error)
  })
}

export async function saveCompassLocal(
  userId: string,
  store: CompassLocalStore,
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(
      { ...normalizeStore(store), updatedAt: new Date().toISOString() },
      userId,
    )
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const DRAFT_PREFIX = 'compass-draft:'

export function loadDraftLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function saveDraftLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(value))
  } catch {
    /* quota */
  }
}

export function clearDraftLocal(key: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key)
  } catch {
    /* ignore */
  }
}
