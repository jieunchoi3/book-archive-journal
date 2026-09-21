export type ConnectFrequency = 'weekly' | 'monthly' | 'few_months'

export type RelationTrackerTab = 'room' | 'world'

export interface AvatarConfig {
  /** Rendered Wii-style portrait from /public/avatars */
  presetId?: string
  skinTone: number
  hairStyle: number
  hairColor: number
  eyeStyle: number
  mouthStyle: number
  outfitColor: number
  outfitStyle: number
}

export interface RelationPerson {
  id: string
  name: string
  relationshipType: string
  occupation: string
  location: string
  city?: string
  countryCode?: string
  metContext: string
  metDate: string
  enteredRoomDate?: string
  quote?: string
  age?: string
  mbti?: string
  compatibility?: number
  connectFrequency?: ConnectFrequency
  lastInteraction?: string
  avatar: AvatarConfig
  /** Normalized position on room canvas (0–1), optional */
  roomX?: number
  roomY?: number
  /** Map pin lat/lng for world view */
  lat?: number
  lng?: number
}

export interface RelationTrackerState {
  people: RelationPerson[]
  dismissedCheckIns: string[]
  zoom: number
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skinTone: 2,
  hairStyle: 0,
  hairColor: 2,
  eyeStyle: 0,
  mouthStyle: 0,
  outfitColor: 3,
  outfitStyle: 0,
}

export const SKIN_TONES = ['#FDEBD0', '#F5CBA7', '#E0AC69', '#C68642', '#8D5524', '#5C3317']
export const HAIR_COLORS = ['#1a1a1a', '#4a3728', '#8b6914', '#c4a574', '#e8dcc8', '#6b4423']
export const OUTFIT_COLORS = ['#E85D4C', '#4A90D9', '#6B8F71', '#F4A261', '#9B59B6', '#2C3E50']
