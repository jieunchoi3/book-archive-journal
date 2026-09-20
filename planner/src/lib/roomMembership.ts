import type { RoomEvent, RoomPerson, RoomPlacementPayload } from '../types/room'
import { doorPlacement } from '../types/room'

export type RoomMembershipStatus = 'met_only' | 'in_room' | 'archived'

const INVITE_KINDS = new Set(['invited_to_room', 'invited_at_door', 'entered_room', 'returned_to_room', 'returned_active'])
const LEAVE_KINDS = new Set(['archived', 'marked_historical', 'left_active'])

export function membershipAtDate(
  personId: string,
  events: RoomEvent[],
  asOf: string,
): RoomMembershipStatus {
  const relevant = events
    .filter((e) => e.personId === personId && e.effectiveOn <= asOf)
    .sort((a, b) => {
      const d = a.effectiveOn.localeCompare(b.effectiveOn)
      if (d !== 0) return d
      return a.createdAt.localeCompare(b.createdAt)
    })

  let status: RoomMembershipStatus = 'met_only'
  for (const ev of relevant) {
    if (INVITE_KINDS.has(ev.kind)) status = 'in_room'
    if (LEAVE_KINDS.has(ev.kind)) status = 'archived'
  }
  return status
}

export function peopleMet(store: { people: RoomPerson[] }): RoomPerson[] {
  return [...store.people].sort((a, b) => a.name.localeCompare(b.name))
}

export function peopleInRoomAtDate(
  people: RoomPerson[],
  events: RoomEvent[],
  asOf: string,
): RoomPerson[] {
  return people.filter((p) => membershipAtDate(p.id, events, asOf) === 'in_room')
}

export function peopleArchivedAtDate(
  people: RoomPerson[],
  events: RoomEvent[],
  asOf: string,
): RoomPerson[] {
  return people.filter((p) => membershipAtDate(p.id, events, asOf) === 'archived')
}

export function peopleMetNotInRoom(
  people: RoomPerson[],
  events: RoomEvent[],
  asOf: string,
): RoomPerson[] {
  return people.filter((p) => membershipAtDate(p.id, events, asOf) === 'met_only')
}

const POSITION_KINDS = new Set(['invited_to_room', 'invited_at_door', 'moved', 'entered_room', 'imported'])

export function placementAtDate(
  personId: string,
  events: RoomEvent[],
  asOf: string,
): RoomPlacementPayload | null {
  const status = membershipAtDate(personId, events, asOf)
  if (status === 'met_only') return null

  const relevant = events
    .filter(
      (e) =>
        e.personId === personId &&
        e.effectiveOn <= asOf &&
        POSITION_KINDS.has(e.kind),
    )
    .sort((a, b) => {
      const d = a.effectiveOn.localeCompare(b.effectiveOn)
      if (d !== 0) return d
      return a.createdAt.localeCompare(b.createdAt)
    })

  let placement = doorPlacement()
  for (const ev of relevant) {
    const p = ev.payload as Partial<RoomPlacementPayload>
    if (typeof p.x === 'number') placement = { ...placement, x: p.x }
    if (typeof p.y === 'number') placement = { ...placement, y: p.y }
    if (p.zone) placement = { ...placement, zone: p.zone }
  }
  return placement
}

export function placementsInRoom(
  people: RoomPerson[],
  events: RoomEvent[],
  asOf: string,
): Map<string, RoomPlacementPayload> {
  const map = new Map<string, RoomPlacementPayload>()
  for (const p of people) {
    if (membershipAtDate(p.id, events, asOf) !== 'in_room') continue
    const pl = placementAtDate(p.id, events, asOf)
    if (pl) map.set(p.id, pl)
  }
  return map
}

export function stripLegacyAutoPlacementEvents(events: RoomEvent[]): RoomEvent[] {
  return events.filter((e) => e.kind !== 'imported' && e.kind !== 'entered_room')
}
