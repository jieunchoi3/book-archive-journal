export type RoomZone = 'door' | 'middle' | 'anywhere'

export type RoomEventKind =
  | 'invited_to_room'
  | 'moved'
  | 'archived'
  | 'returned_to_room'
  | 'contact_logged'
  /** @deprecated legacy auto-import — stripped on load */
  | 'imported'
  | 'entered_room'
  | 'invited_at_door'
  | 'marked_historical'
  | 'returned_active'
  | 'left_active'

export interface RoomPlacementPayload {
  x: number
  y: number
  zone: RoomZone
}

export interface RoomPerson {
  id: string
  userId: string
  importKey: string | null
  name: string
  fieldIndustry: string
  howWeMet: string
  mbti: string
  location: string
  note: string
  metOn: string | null
  lastContactOn: string | null
  notionCompatibility: string | null
  createdAt: string
}

export interface RoomEvent {
  id: string
  userId: string
  personId: string
  effectiveOn: string
  kind: RoomEventKind
  payload: Record<string, unknown>
  createdAt: string
}

export interface RoomSnapshot {
  id: string
  userId: string
  label: string
  savedOn: string
  note: string
  /** Placements for everyone in the room at save time */
  placements: Record<string, RoomPlacementPayload>
  createdAt: string
}

export interface RoomReflection {
  id: string
  userId: string
  promptKey: string
  body: string
  personId: string | null
  writtenOn: string
  createdAt: string
}

export interface RoomReminderDismissal {
  personId: string
  snoozeUntil: string | null
  dismissedAt: string | null
}

export interface RoomStore {
  people: RoomPerson[]
  events: RoomEvent[]
  snapshots: RoomSnapshot[]
  reflections: RoomReflection[]
  dismissals: RoomReminderDismissal[]
  notionImportedAt: string | null
  /** Clears legacy auto-placed Notion import once */
  v2MigratedAt: string | null
}

export function emptyRoomStore(): RoomStore {
  return {
    people: [],
    events: [],
    snapshots: [],
    reflections: [],
    dismissals: [],
    notionImportedAt: null,
    v2MigratedAt: null,
  }
}

export const ROOM_REFLECTION_PROMPTS = [
  'Has anyone recently become more important to you?',
  'Is there someone you have been meaning to reach out to?',
  'Who made you feel most like yourself recently?',
  'Has anyone naturally become more distant?',
  'Who would you like to make more room for?',
  'Does your current room reflect what matters to you?',
] as const

export function doorPlacement(): RoomPlacementPayload {
  return { x: 0.5, y: 0.92, zone: 'door' }
}

export function toEventPayload(p: Partial<RoomPlacementPayload>): Record<string, unknown> {
  return p as unknown as Record<string, unknown>
}
