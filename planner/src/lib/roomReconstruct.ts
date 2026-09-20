import type {
  RoomEvent,
  RoomPerson,
  RoomPlacementPayload,
  RoomZone,
  EmotionalPresence,
} from '../types/room'
import { defaultPlacementForIndex } from '../types/room'

const PLACEMENT_KINDS = new Set([
  'imported',
  'entered_room',
  'moved',
  'invited_at_door',
  'marked_historical',
  'returned_active',
  'left_active',
])

function mergePayload(
  base: RoomPlacementPayload,
  patch: Partial<RoomPlacementPayload>,
): RoomPlacementPayload {
  return {
    x: patch.x ?? base.x,
    y: patch.y ?? base.y,
    zone: (patch.zone ?? base.zone) as RoomZone,
    emotionalPresence: (patch.emotionalPresence ?? base.emotionalPresence) as EmotionalPresence,
    isActiveInRoom: patch.isActiveInRoom ?? base.isActiveInRoom,
  }
}

export function placementAtDate(
  personId: string,
  events: RoomEvent[],
  asOf: string,
  fallbackIndex: number,
  total: number,
): RoomPlacementPayload {
  const relevant = events
    .filter(
      (e) =>
        e.personId === personId &&
        e.effectiveOn <= asOf &&
        PLACEMENT_KINDS.has(e.kind),
    )
    .sort((a, b) => {
      const d = a.effectiveOn.localeCompare(b.effectiveOn)
      if (d !== 0) return d
      return a.createdAt.localeCompare(b.createdAt)
    })

  let placement = defaultPlacementForIndex(fallbackIndex, total)
  for (const ev of relevant) {
    placement = mergePayload(placement, ev.payload as Partial<RoomPlacementPayload>)
  }
  return placement
}

export function placementsForAll(
  people: RoomPerson[],
  events: RoomEvent[],
  asOf: string,
): Map<string, RoomPlacementPayload> {
  const map = new Map<string, RoomPlacementPayload>()
  people.forEach((p, i) => {
    map.set(p.id, placementAtDate(p.id, events, asOf, i, people.length))
  })
  return map
}

export function distanceFromCenter(p: RoomPlacementPayload): number {
  const dx = p.x - 0.5
  const dy = p.y - 0.48
  return Math.sqrt(dx * dx + dy * dy)
}

export function zoneLabel(zone: RoomZone): string {
  switch (zone) {
    case 'inner':
      return 'Close to you'
    case 'middle':
      return 'In the room'
    case 'edge':
      return 'Near the edge'
    case 'door':
      return 'At the door'
    case 'archive':
      return 'Historical influence'
    default:
      return zone
  }
}
