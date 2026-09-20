import type { MyRoomPerson, MyRoomStore, RoomPositionRecord } from '../types/myRoom'

export function latestRecordAt(
  personId: string,
  history: RoomPositionRecord[],
  asOf: string,
): RoomPositionRecord | null {
  const rows = history
    .filter((r) => r.personId === personId && r.effectiveOn <= asOf)
    .sort((a, b) => {
      const d = a.effectiveOn.localeCompare(b.effectiveOn)
      if (d !== 0) return d
      return a.createdAt.localeCompare(b.createdAt)
    })
  return rows.at(-1) ?? null
}

export function inRoomAt(
  personId: string,
  history: RoomPositionRecord[],
  asOf: string,
): boolean {
  const rec = latestRecordAt(personId, history, asOf)
  return Boolean(rec?.inRoom)
}

export function peopleInRoom(
  people: MyRoomPerson[],
  history: RoomPositionRecord[],
  asOf: string,
): MyRoomPerson[] {
  return people.filter((p) => inRoomAt(p.id, history, asOf))
}

export function peopleMetOnly(
  people: MyRoomPerson[],
  history: RoomPositionRecord[],
  asOf: string,
): MyRoomPerson[] {
  return people.filter((p) => !inRoomAt(p.id, history, asOf))
}

export function positionsAt(
  store: MyRoomStore,
  asOf: string,
): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>()
  for (const p of store.people) {
    if (!inRoomAt(p.id, store.positionHistory, asOf)) continue
    const rec = latestRecordAt(p.id, store.positionHistory, asOf)
    if (rec) map.set(p.id, { x: rec.x, y: rec.y })
  }
  return map
}

export function roomHistoryForPerson(
  personId: string,
  history: RoomPositionRecord[],
): RoomPositionRecord[] {
  return history
    .filter((r) => r.personId === personId)
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn))
}
