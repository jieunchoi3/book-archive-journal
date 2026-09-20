import type { MyRoomStore } from '../types/myRoom'
import { emptyMyRoomStore } from '../types/myRoom'

const KEY = 'planner:my-room:v1'

export function loadMyRoomStore(): MyRoomStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyMyRoomStore()
    return { ...emptyMyRoomStore(), ...(JSON.parse(raw) as MyRoomStore) }
  } catch {
    return emptyMyRoomStore()
  }
}

export function saveMyRoomStore(store: MyRoomStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // ignore quota
  }
}
