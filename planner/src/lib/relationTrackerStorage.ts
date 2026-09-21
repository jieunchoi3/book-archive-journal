import type { RelationPerson, RelationTrackerState } from '../types/relationTracker'
import { DEFAULT_AVATAR } from '../types/relationTracker'

const STORAGE_KEY = 'relation-tracker-v1'

const SAMPLE_PEOPLE: RelationPerson[] = [
  {
    id: 'sophie',
    name: 'Sophie',
    relationshipType: 'Close friend',
    occupation: 'Design',
    location: 'London, UK',
    city: 'London',
    countryCode: 'GB',
    metContext: 'Met at university',
    metDate: '2023-09-12',
    quote: 'Always makes life brighter.',
    connectFrequency: 'monthly',
    lastInteraction: '2026-07-01',
    avatar: {
      skinTone: 1,
      hairStyle: 2,
      hairColor: 1,
      eyeStyle: 1,
      mouthStyle: 1,
      outfitColor: 3,
      outfitStyle: 0,
    },
    roomX: 0.22,
    roomY: 0.55,
    lat: 51.5074,
    lng: -0.1278,
  },
  {
    id: 'minji',
    name: 'Minji',
    relationshipType: 'Friend',
    occupation: 'Psychology',
    location: 'Seoul, South Korea',
    city: 'Seoul',
    countryCode: 'KR',
    metContext: 'Met through a friend',
    metDate: '2024-01-03',
    quote: 'So curious and inspiring.',
    mbti: 'ENFP',
    connectFrequency: 'few_months',
    lastInteraction: '2026-06-20',
    avatar: {
      skinTone: 2,
      hairStyle: 1,
      hairColor: 0,
      eyeStyle: 0,
      mouthStyle: 0,
      outfitColor: 1,
      outfitStyle: 0,
    },
    roomX: 0.5,
    roomY: 0.18,
    lat: 37.5665,
    lng: 126.978,
  },
  {
    id: 'daniel',
    name: 'Daniel',
    relationshipType: 'Colleague',
    occupation: 'Technology',
    location: 'San Francisco, USA',
    city: 'San Francisco',
    countryCode: 'US',
    metContext: 'Met at work',
    metDate: '2024-05-20',
    quote: 'Great conversations about ideas.',
    connectFrequency: 'few_months',
    lastInteraction: '2026-04-10',
    avatar: {
      skinTone: 1,
      hairStyle: 0,
      hairColor: 0,
      eyeStyle: 2,
      mouthStyle: 2,
      outfitColor: 3,
      outfitStyle: 1,
    },
    roomX: 0.78,
    roomY: 0.55,
    lat: 37.7749,
    lng: -122.4194,
  },
]

function defaultState(): RelationTrackerState {
  return {
    people: SAMPLE_PEOPLE,
    dismissedCheckIns: [],
    zoom: 1,
  }
}

export function loadRelationTracker(): RelationTrackerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as RelationTrackerState
    if (!Array.isArray(parsed.people)) return defaultState()
    return {
      ...defaultState(),
      ...parsed,
      people: parsed.people.map((p) => ({
        ...p,
        avatar: { ...DEFAULT_AVATAR, ...p.avatar },
      })),
    }
  } catch {
    return defaultState()
  }
}

export function saveRelationTracker(state: RelationTrackerState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
