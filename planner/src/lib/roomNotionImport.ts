import type { RoomEvent, RoomPerson, RoomStore } from '../types/room'
import { defaultPlacementForIndex, emptyRoomStore, toEventPayload } from '../types/room'
import { generateId } from './weekUtils'
import notionCsv from '../data/people-ive-met-notion.csv?raw'

export interface NotionRow {
  Name: string
  'Field/Industry': string
  'How We Met': string
  'Date 1': string
  Mbti: string
  Compatability: string
  Note: string
  Location: string
  Date: string
}

function parseCsv(text: string): NotionRow[] {
  const rows: NotionRow[] = []
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      if (cur.trim()) lines.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) lines.push(cur)
  if (lines.length < 2) return []

  const splitLine = (line: string): string[] => {
    const out: string[] = []
    let cell = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cell += '"'
          i++
        } else q = !q
        continue
      }
      if (ch === ',' && !q) {
        out.push(cell)
        cell = ''
        continue
      }
      cell += ch
    }
    out.push(cell)
    return out
  }

  const headers = splitLine(lines[0]).map((h) => h.replace(/^\ufeff/, '').trim())
  for (let li = 1; li < lines.length; li++) {
    const cells = splitLine(lines[li])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim()
    })
    rows.push(row as unknown as NotionRow)
  }
  return rows
}

function parseNotionDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const m = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!m) return s.slice(0, 10)
  const months: Record<string, string> = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  }
  const mon = months[m[2].toLowerCase()]
  if (!mon) return null
  const day = m[1].padStart(2, '0')
  return `${m[3]}-${mon}-${day}`
}

function importKeyForRow(row: NotionRow, index: number): string {
  const name = row.Name?.trim() || `unnamed-${index}`
  const how = row['How We Met']?.trim() ?? ''
  const noteHead = (row.Note ?? '').slice(0, 48)
  return `notion:${index}:${name}:${how}:${noteHead}`
}

export function buildStoreFromNotionCsv(userId: string, csvText = notionCsv): RoomStore {
  const rows = parseCsv(csvText)
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const people: RoomPerson[] = []
  const events: RoomEvent[] = []

  rows.forEach((row, index) => {
    const importKey = importKeyForRow(row, index)
    const name =
      row.Name?.trim() ||
      (row.Note?.trim() ? row.Note.trim().slice(0, 40) : `Someone I met (#${index + 1})`)
    const metOn = parseNotionDate(row['Date 1'] || row.Date) ?? today
    const personId = generateId()

    people.push({
      id: personId,
      userId,
      importKey,
      name,
      fieldIndustry: row['Field/Industry'] ?? '',
      howWeMet: row['How We Met'] ?? '',
      mbti: row.Mbti ?? '',
      location: row.Location ?? '',
      note: row.Note ?? '',
      metOn,
      lastContactOn: metOn,
      notionCompatibility: row.Compatability?.trim() || null,
      createdAt: now,
    })

    const placement = defaultPlacementForIndex(index, rows.length)
    events.push({
      id: generateId(),
      userId,
      personId,
      effectiveOn: metOn,
      kind: 'imported',
      payload: toEventPayload(placement),
      createdAt: now,
    })
    events.push({
      id: generateId(),
      userId,
      personId,
      effectiveOn: metOn,
      kind: 'entered_room',
      payload: toEventPayload({ ...placement, zone: 'edge' }),
      createdAt: now,
    })
  })

  return {
    ...emptyRoomStore(),
    people,
    events,
    notionImportedAt: now,
  }
}

export function mergeNotionImport(existing: RoomStore, imported: RoomStore): RoomStore {
  const byKey = new Map(existing.people.filter((p) => p.importKey).map((p) => [p.importKey!, p]))
  const people: RoomPerson[] = [...existing.people]
  const events: RoomEvent[] = [...existing.events]
  const eventPersonIds = new Set(events.map((e) => e.personId))

  for (const p of imported.people) {
    if (!p.importKey) continue
    const prev = byKey.get(p.importKey)
    if (prev) {
      Object.assign(prev, {
        name: p.name,
        fieldIndustry: p.fieldIndustry,
        howWeMet: p.howWeMet,
        mbti: p.mbti,
        location: p.location,
        note: p.note,
        metOn: p.metOn,
        notionCompatibility: p.notionCompatibility,
      })
    } else {
      people.push(p)
      byKey.set(p.importKey, p)
    }
  }

  for (const ev of imported.events) {
    const person = imported.people.find((p) => p.id === ev.personId)
    if (!person?.importKey) continue
    const target = byKey.get(person.importKey)
    if (!target) continue
    if (eventPersonIds.has(target.id)) {
      const hasImport = events.some(
        (e) => e.personId === target.id && e.kind === 'imported',
      )
      if (hasImport) continue
    }
    events.push({ ...ev, personId: target.id })
  }

  return {
    ...existing,
    people,
    events,
    notionImportedAt: imported.notionImportedAt,
  }
}
