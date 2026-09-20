export const SKIN_TONES = ['#F5D0C5', '#E8B4A0', '#C68642', '#8D5524', '#5C3D2E'] as const
export const HAIR_COLORS = ['#2C1810', '#5C4033', '#8B6914', '#D4A574', '#E8E8E8', '#C41E3A'] as const
export const OUTFIT_COLORS = ['#5C6B5A', '#8B7355', '#6B7B8C', '#9B6B7A', '#C4A882', '#4A6741'] as const

export type AccessoryId =
  | 'glasses'
  | 'headphones'
  | 'camera'
  | 'bag'
  | 'book'
  | 'coffee'
  | 'flowers'
  | 'hat'
  | 'scarf'

export interface CharacterAppearance {
  skinTone: number
  hairStyle: number
  hairColor: number
  outfitStyle: number
  outfitColor: number
  accessories: AccessoryId[]
}

export interface MyRoomPerson {
  id: string
  name: string
  relationship: string
  dateMet: string | null
  lastMet: string | null
  valueNote: string
  character: CharacterAppearance
  createdAt: string
}

/** Append-only spatial + membership history */
export interface RoomPositionRecord {
  id: string
  personId: string
  effectiveOn: string
  x: number
  y: number
  inRoom: boolean
  createdAt: string
}

export interface RoomSnapshot {
  id: string
  label: string
  savedOn: string
  note: string
  positions: Array<{ personId: string; x: number; y: number }>
  createdAt: string
}

export interface PersonMemory {
  id: string
  personId: string
  date: string
  text: string
}

export interface ReminderDismissal {
  personId: string
  snoozeUntil: string | null
  dismissedAt: string | null
}

export interface MyRoomStore {
  people: MyRoomPerson[]
  positionHistory: RoomPositionRecord[]
  snapshots: RoomSnapshot[]
  memories: PersonMemory[]
  dismissals: ReminderDismissal[]
  onboardingDone: boolean
}

export function defaultCharacter(): CharacterAppearance {
  return {
    skinTone: 0,
    hairStyle: 0,
    hairColor: 0,
    outfitStyle: 0,
    outfitColor: 0,
    accessories: [],
  }
}

export function emptyMyRoomStore(): MyRoomStore {
  return {
    people: [],
    positionHistory: [],
    snapshots: [],
    memories: [],
    dismissals: [],
    onboardingDone: false,
  }
}

export const RELATIONSHIP_OPTIONS = [
  'Friend',
  'Family',
  'Partner',
  'Colleague',
  'Mentor',
  'Acquaintance',
  'Other',
] as const
