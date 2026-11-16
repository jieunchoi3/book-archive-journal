import { generateId } from './weekUtils'

export type SidebarNoteColumn = {
  id: string
  text: string
}

type SidebarNoteDocV1 = {
  v: 1
  columns: SidebarNoteColumn[]
}

const MAX_COLUMNS = 4

function isDocV1(value: unknown): value is SidebarNoteDocV1 {
  if (!value || typeof value !== 'object') return false
  const doc = value as SidebarNoteDocV1
  return (
    doc.v === 1 &&
    Array.isArray(doc.columns) &&
    doc.columns.every(
      (c) =>
        c &&
        typeof c === 'object' &&
        typeof (c as SidebarNoteColumn).id === 'string' &&
        typeof (c as SidebarNoteColumn).text === 'string',
    )
  )
}

/** Parse stored note string (plain text or multi-column JSON). */
export function parseSidebarNote(raw: string): SidebarNoteColumn[] {
  const text = raw ?? ''
  const trimmed = text.trim()
  if (!trimmed) return [{ id: generateId(), text: '' }]

  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (isDocV1(parsed) && parsed.columns.length > 0) {
        return parsed.columns.map((c) => ({
          id: c.id || generateId(),
          text: c.text ?? '',
        }))
      }
    } catch {
      // fall through — treat as plain text
    }
  }

  return [{ id: generateId(), text }]
}

/** Serialize columns for local/cloud storage (plain when single column). */
export function serializeSidebarNote(columns: SidebarNoteColumn[]): string {
  const normalized = columns.length > 0 ? columns : [{ id: generateId(), text: '' }]
  if (normalized.length === 1) return normalized[0]!.text
  return JSON.stringify({
    v: 1,
    columns: normalized.map((c) => ({ id: c.id, text: c.text })),
  } satisfies SidebarNoteDocV1)
}

export function canAddSidebarNoteColumn(columns: SidebarNoteColumn[]): boolean {
  return columns.length < MAX_COLUMNS
}

export function addSidebarNoteColumn(columns: SidebarNoteColumn[]): SidebarNoteColumn[] {
  if (!canAddSidebarNoteColumn(columns)) return columns
  return [...columns, { id: generateId(), text: '' }]
}

export function removeSidebarNoteColumn(
  columns: SidebarNoteColumn[],
  id: string,
): SidebarNoteColumn[] {
  if (columns.length <= 1) return columns
  const next = columns.filter((c) => c.id !== id)
  return next.length > 0 ? next : [{ id: generateId(), text: '' }]
}

export function updateSidebarNoteColumn(
  columns: SidebarNoteColumn[],
  id: string,
  text: string,
): SidebarNoteColumn[] {
  return columns.map((c) => (c.id === id ? { ...c, text } : c))
}

export { MAX_COLUMNS }
