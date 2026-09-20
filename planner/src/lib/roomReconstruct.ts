import type { RoomPlacementPayload, RoomZone } from '../types/room'
import { placementsInRoom, placementAtDate, membershipAtDate } from './roomMembership'

export { placementsInRoom, placementAtDate, membershipAtDate }

export function distanceFromCenter(p: RoomPlacementPayload): number {
  const dx = p.x - 0.5
  const dy = p.y - 0.5
  return Math.sqrt(dx * dx + dy * dy)
}

export function zoneLabel(zone: RoomZone): string {
  switch (zone) {
    case 'door':
      return 'By the door'
    case 'middle':
      return 'In the room'
    default:
      return 'In the room'
  }
}
