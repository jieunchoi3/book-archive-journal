import { useEffect, useRef, useState } from 'react'
import type { SnapPaymentMethod } from '../types/snap'
import { fetchGbpKrwRate, formatFxRate } from '../lib/snapFxRate'

export function useAutoSnapFxRate(opts: {
  date: string
  paymentMethod: SnapPaymentMethod | null
  setFxRate: (value: string) => void
  /** Skip auto-fetch when editing a row that already has a saved rate. */
  enabled?: boolean
}) {
  const { date, paymentMethod, setFxRate, enabled = true } = opts
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const manualRef = useRef(false)
  const fetchKeyRef = useRef('')

  useEffect(() => {
    manualRef.current = false
    fetchKeyRef.current = ''
    setHint(null)
    setError(null)
  }, [date, paymentMethod])

  useEffect(() => {
    if (!enabled || paymentMethod !== 'krw_transfer' || !date) return
    if (manualRef.current) return

    const fetchKey = `${date}:${paymentMethod}`
    if (fetchKeyRef.current === fetchKey) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const result = await fetchGbpKrwRate(date)
        if (cancelled) return
        if (!result) {
          setError('환율을 불러오지 못했어요 — 직접 입력해 주세요')
          return
        }
        setFxRate(formatFxRate(result.rate))
        fetchKeyRef.current = fetchKey
        setHint(
          result.rateDate === date.slice(0, 10)
            ? `${result.rateDate} 기준 ₩/£`
            : `${result.rateDate} 환율 (해당일 데이터 없음)`,
        )
      } catch {
        if (!cancelled) setError('환율을 불러오지 못했어요 — 직접 입력해 주세요')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [date, paymentMethod, enabled, setFxRate])

  const onFxRateChange = (value: string) => {
    manualRef.current = true
    setHint(null)
    setError(null)
    setFxRate(value)
  }

  const refresh = () => {
    manualRef.current = false
    fetchKeyRef.current = ''
    setHint(null)
    setError(null)
    void fetchGbpKrwRate(date).then((result) => {
      if (!result) {
        setError('환율을 불러오지 못했어요 — 직접 입력해 주세요')
        return
      }
      setFxRate(formatFxRate(result.rate))
      fetchKeyRef.current = `${date}:${paymentMethod}`
      setHint(
        result.rateDate === date.slice(0, 10)
          ? `${result.rateDate} 기준 ₩/£`
          : `${result.rateDate} 환율 (해당일 데이터 없음)`,
      )
    })
  }

  return { loading, hint, error, onFxRateChange, refresh }
}
