const cache = new Map<string, number>()

type FrankfurterResponse = {
  date: string
  rates: { KRW?: number }
}

/** KRW per £1 on the given date (ECB via Frankfurter). */
export async function fetchGbpKrwRate(dateKey: string): Promise<{
  rate: number
  rateDate: string
} | null> {
  const key = dateKey.slice(0, 10)
  const cached = cache.get(key)
  if (cached != null) return { rate: cached, rateDate: key }

  const res = await fetch(`https://api.frankfurter.app/${key}?from=GBP&to=KRW`)
  if (!res.ok) return null

  const data = (await res.json()) as FrankfurterResponse
  const rate = data.rates.KRW
  if (rate == null || !Number.isFinite(rate)) return null

  cache.set(key, rate)
  return { rate, rateDate: data.date ?? key }
}

export function formatFxRate(rate: number): string {
  return rate >= 1000 ? String(Math.round(rate)) : rate.toFixed(2)
}
