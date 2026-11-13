/** Registry so PlannerDataContext can flush commitments without a circular import. */

type Flusher = () => Promise<void>

let flusher: Flusher | null = null

export function registerWeekCommitmentFlusher(fn: Flusher | null): void {
  flusher = fn
}

export async function flushWeekCommitments(): Promise<void> {
  if (!flusher) return
  await flusher()
}
