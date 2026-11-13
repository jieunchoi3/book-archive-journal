import type { WeekCommitmentStore } from '../types/weekCommitment'
import { emptyCommitmentStore } from '../types/weekCommitment'

function storeKey(userId: string) {
  return `planner:weekCommitments:${userId}`
}

export function saveWeekCommitmentStoreLocal(
  userId: string,
  store: WeekCommitmentStore,
): void {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify(store))
  } catch {
    /* quota / private mode */
  }
}

export function loadWeekCommitmentStoreLocal(userId: string): WeekCommitmentStore {
  try {
    const raw = localStorage.getItem(storeKey(userId))
    if (!raw) return emptyCommitmentStore()
    const parsed = JSON.parse(raw) as WeekCommitmentStore
    return {
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      placements: Array.isArray(parsed.placements) ? parsed.placements : [],
    }
  } catch {
    return emptyCommitmentStore()
  }
}
