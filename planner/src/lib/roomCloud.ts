import type {
  RoomEvent,
  RoomPerson,
  RoomReflection,
  RoomReminderDismissal,
  RoomStore,
} from '../types/room'
import { supabase } from './supabase'

type PersonRow = {
  id: string
  user_id: string
  import_key: string | null
  name: string
  field_industry: string
  how_we_met: string
  mbti: string
  location: string
  note: string
  met_on: string | null
  last_contact_on: string | null
  notion_compatibility: string | null
  created_at: string
}

type EventRow = {
  id: string
  user_id: string
  person_id: string
  effective_on: string
  kind: string
  payload: Record<string, unknown>
  created_at: string
}

function rowToPerson(r: PersonRow): RoomPerson {
  return {
    id: r.id,
    userId: r.user_id,
    importKey: r.import_key,
    name: r.name,
    fieldIndustry: r.field_industry,
    howWeMet: r.how_we_met,
    mbti: r.mbti,
    location: r.location,
    note: r.note,
    metOn: r.met_on?.slice(0, 10) ?? null,
    lastContactOn: r.last_contact_on?.slice(0, 10) ?? null,
    notionCompatibility: r.notion_compatibility,
    createdAt: r.created_at,
  }
}

function personToRow(p: RoomPerson): PersonRow {
  return {
    id: p.id,
    user_id: p.userId,
    import_key: p.importKey,
    name: p.name,
    field_industry: p.fieldIndustry,
    how_we_met: p.howWeMet,
    mbti: p.mbti,
    location: p.location,
    note: p.note,
    met_on: p.metOn,
    last_contact_on: p.lastContactOn,
    notion_compatibility: p.notionCompatibility,
    created_at: p.createdAt,
  }
}

function rowToEvent(r: EventRow): RoomEvent {
  return {
    id: r.id,
    userId: r.user_id,
    personId: r.person_id,
    effectiveOn: r.effective_on.slice(0, 10),
    kind: r.kind as RoomEvent['kind'],
    payload: r.payload ?? {},
    createdAt: r.created_at,
  }
}

function eventToRow(e: RoomEvent): EventRow {
  return {
    id: e.id,
    user_id: e.userId,
    person_id: e.personId,
    effective_on: e.effectiveOn,
    kind: e.kind,
    payload: e.payload,
    created_at: e.createdAt,
  }
}

export async function fetchRoomCloud(userId: string): Promise<RoomStore> {
  const [peopleRes, eventsRes, reflRes, dismissRes] = await Promise.all([
    supabase.from('room_people').select('*').eq('user_id', userId),
    supabase.from('room_events').select('*').eq('user_id', userId),
    supabase.from('room_reflections').select('*').eq('user_id', userId),
    supabase.from('room_reminder_dismissals').select('*').eq('user_id', userId),
  ])
  if (peopleRes.error) throw peopleRes.error
  if (eventsRes.error) throw eventsRes.error
  if (reflRes.error) throw reflRes.error
  if (dismissRes.error) throw dismissRes.error

  return {
    people: (peopleRes.data ?? []).map((r) => rowToPerson(r as PersonRow)),
    events: (eventsRes.data ?? []).map((r) => rowToEvent(r as EventRow)),
    reflections: (reflRes.data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      promptKey: r.prompt_key,
      body: r.body,
      personId: r.person_id,
      writtenOn: r.written_on.slice(0, 10),
      createdAt: r.created_at,
    })),
    dismissals: (dismissRes.data ?? []).map((r) => ({
      personId: r.person_id,
      snoozeUntil: r.snooze_until?.slice(0, 10) ?? null,
      dismissedAt: r.dismissed_at,
    })),
    snapshots: [],
    notionImportedAt: null,
    v2MigratedAt: null,
  }
}

async function upsertPerson(p: RoomPerson): Promise<void> {
  const { error } = await supabase.from('room_people').upsert(personToRow(p), { onConflict: 'id' })
  if (error) throw error
}

async function upsertEvent(e: RoomEvent): Promise<void> {
  const { error } = await supabase.from('room_events').upsert(eventToRow(e), { onConflict: 'id' })
  if (error) throw error
}

export async function syncRoomToCloud(store: RoomStore): Promise<void> {
  for (const p of store.people) {
    await upsertPerson(p)
  }
  for (const e of store.events) {
    await upsertEvent(e)
  }
}

export async function deleteRoomPersonCloud(personId: string): Promise<void> {
  const { error } = await supabase.from('room_people').delete().eq('id', personId)
  if (error) throw error
}

export async function deleteRoomEventCloud(eventId: string): Promise<void> {
  const { error } = await supabase.from('room_events').delete().eq('id', eventId)
  if (error) throw error
}

export async function upsertRoomReflectionCloud(r: RoomReflection): Promise<void> {
  const { error } = await supabase.from('room_reflections').upsert(
    {
      id: r.id,
      user_id: r.userId,
      prompt_key: r.promptKey,
      body: r.body,
      person_id: r.personId,
      written_on: r.writtenOn,
      created_at: r.createdAt,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

export async function upsertRoomDismissalCloud(
  userId: string,
  d: RoomReminderDismissal,
): Promise<void> {
  const { error } = await supabase.from('room_reminder_dismissals').upsert(
    {
      person_id: d.personId,
      user_id: userId,
      snooze_until: d.snoozeUntil,
      dismissed_at: d.dismissedAt,
    },
    { onConflict: 'person_id' },
  )
  if (error) throw error
}
