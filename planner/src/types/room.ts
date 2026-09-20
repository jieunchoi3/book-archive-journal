export type RoomZone = 'door' | 'edge' | 'middle' | 'inner' | 'archive'

export type EmotionalPresence = 'very_close' | 'close' | 'warm' | 'light' | 'distant'

export type RoomEventKind =
  | 'invited_at_door'
  | 'entered_room'
  | 'moved'
  | 'contact_logged'
  | 'marked_historical'
  | 'returned_active'
  | 'left_active'
  | 'imported'

export interface RoomPlacementPayload {
  x: number
  y: number
  zone: RoomZone
  emotionalPresence: EmotionalPresence
  isActiveInRoom: boolean
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
  /** From Notion only — never used for ranking in UI */
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
  reflections: RoomReflection[]
  dismissals: RoomReminderDismissal[]
  notionImportedAt: string | null
}

export function emptyRoomStore(): RoomStore {
  return {
    people: [],
    events: [],
    reflections: [],
    dismissals: [],
    notionImportedAt: null,
  }
}

export const ROOM_REFLECTION_PROMPTS = [
  'Who made you feel most like yourself recently?',
  'Who have you been thinking about?',
  'Who would you like to see more?',
  'Has anyone recently become more important to you?',
  'Has anyone naturally become more distant?',
  'Is there someone you want to reconnect with?',
  'Who has influenced you even though they are no longer close?',
] as const

export function defaultPlacementForIndex(index: number, total: number): RoomPlacementPayload {
  const t = total > 0 ? index / total : 0
  const angle = t * Math.PI * 2 * 2.4
  const radius = 0.28 + (index % 5) * 0.04
  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.48 + Math.sin(angle) * radius * 0.85,
    zone: 'edge',
    emotionalPresence: 'light',
    isActiveInRoom: true,
  }
}

export function toEventPayload(p: Partial<RoomPlacementPayload>): Record<string, unknown> {
  return p as unknown as Record<string, unknown>
}

export function doorPlacement(): RoomPlacementPayload {
  return {
    x: 0.5,
    y: 0.88,
    zone: 'door',
    emotionalPresence: 'light',
    isActiveInRoom: true,
  }
}
