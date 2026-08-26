import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Trash2, X } from 'lucide-react'
import type { SnapBookingInput } from '../hooks/useSnapBookings'
import { useAutoSnapFxRate } from '../hooks/useAutoSnapFxRate'
import type { SnapBooking, SnapCourse, SnapPaymentMethod } from '../types/snap'
import {
  COURSE_DEFAULTS,
  maxSpotCount,
  SNAP_COURSE_OPTIONS,
  SNAP_PURPOSE_OPTIONS,
  SNAP_SPOT_OPTIONS,
  SNAP_STATUS_OPTIONS,
} from '../types/snap'
import { formatGbp } from '../types/snap'
import { revenueGbp } from '../lib/snapRevenue'
import { KoreanDateInput } from './KoreanDateInput'

interface SnapEditModalProps {
  booking: SnapBooking
  onSave: (input: SnapBookingInput) => void
  onDelete: () => void
  onClose: () => void
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
        selected
          ? 'bg-[#1C1C1E] text-white'
          : 'bg-white text-[#48484A] ring-1 ring-hairline hover:bg-[#F2F2F7]'
      }`}
    >
      {label}
    </button>
  )
}

export function SnapEditModal({ booking, onSave, onDelete, onClose }: SnapEditModalProps) {
  const [date, setDate] = useState(booking.date)
  const [customerName, setCustomerName] = useState(booking.customerName)
  const [course, setCourse] = useState(booking.course)
  const [minutes, setMinutes] = useState(booking.minutes != null ? String(booking.minutes) : '')
  const [listPriceGbp, setListPriceGbp] = useState(String(booking.listPriceGbp))
  const [spots, setSpots] = useState<string[]>(booking.spots)
  const [customSpot, setCustomSpot] = useState('')
  const [headcount, setHeadcount] = useState(booking.headcount)
  const [paymentMethod, setPaymentMethod] = useState<SnapPaymentMethod | null>(
    booking.paymentMethod,
  )
  const [amountGbp, setAmountGbp] = useState(
    booking.amountGbp != null ? String(booking.amountGbp) : '',
  )
  const [amountKrw, setAmountKrw] = useState(
    booking.amountKrw != null ? String(booking.amountKrw) : '',
  )
  const [fxRate, setFxRate] = useState(booking.fxRate != null ? String(booking.fxRate) : '')
  const [status, setStatus] = useState(booking.status)
  const [gender, setGender] = useState(booking.gender ?? '')
  const [ageBand, setAgeBand] = useState(booking.ageBand ?? '')
  const [purpose, setPurpose] = useState(booking.purpose ?? '')
  const [stars, setStars] = useState<number | null>(booking.stars)
  const [photosUrl, setPhotosUrl] = useState(booking.photosUrl ?? '')
  const [note, setNote] = useState(booking.note ?? '')

  const fxAuto = useAutoSnapFxRate({
    date,
    paymentMethod,
    setFxRate,
    enabled:
      paymentMethod === 'krw_transfer' &&
      !(booking.fxRate != null && date === booking.date),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const draft = useMemo((): SnapBookingInput => ({
    date,
    customerName: customerName.trim(),
    spots,
    minutes: minutes ? Number(minutes) : null,
    course,
    headcount,
    listPriceGbp: Number(listPriceGbp) || 0,
    paymentMethod,
    amountGbp:
      paymentMethod === 'cash_gbp' || paymentMethod === null
        ? Number(amountGbp) || null
        : null,
    amountKrw: paymentMethod === 'krw_transfer' ? Number(amountKrw.replace(/,/g, '')) || null : null,
    fxRate: paymentMethod === 'krw_transfer' ? Number(fxRate) || null : null,
    status,
    gender: gender.trim() || null,
    ageBand: ageBand.trim() || null,
    purpose: purpose || null,
    stars,
    photosUrl: photosUrl.trim() || null,
    note: note.trim() || null,
    source: booking.source ?? 'manual',
  }), [
    date, customerName, spots, minutes, course, headcount, listPriceGbp,
    paymentMethod, amountGbp, amountKrw, fxRate, status, gender, ageBand,
    purpose, stars, photosUrl, note, booking.source,
  ])

  const preview = formatGbp(revenueGbp({ ...draft, id: booking.id, createdAt: booking.createdAt }))

  const toggleSpot = (spot: string) => {
    const limit = maxSpotCount(course)
    setSpots((prev) => {
      if (prev.includes(spot)) return prev.filter((s) => s !== spot)
      if (limit === 1) return [spot]
      if (limit != null && prev.length >= limit) return [...prev.slice(1), spot]
      return [...prev, spot]
    })
  }

  const handleSave = () => {
    if (!customerName.trim() || !spots.length) return
    onSave(draft)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="text-[15px] font-semibold">촬영 수정</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">날짜</span>
              <KoreanDateInput
                value={date}
                onChange={setDate}
                className="w-full rounded-xl border border-hairline px-3 py-2 pr-9 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">고객명</span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {SNAP_COURSE_OPTIONS.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={course === c}
                onClick={() => {
                  setCourse(c)
                  const defs = COURSE_DEFAULTS[c as SnapCourse]
                  if (defs.minutes != null) setMinutes(String(defs.minutes))
                  if (defs.listPriceGbp != null) setListPriceGbp(String(defs.listPriceGbp))
                  const limit = maxSpotCount(c)
                  if (limit != null) setSpots((prev) => prev.slice(0, limit))
                }}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">분</span>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">정가 £</span>
              <input
                type="number"
                step="0.01"
                value={listPriceGbp}
                onChange={(e) => setListPriceGbp(e.target.value)}
                className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-muted">
              스팟{maxSpotCount(course) === 1 ? ' (1곳)' : maxSpotCount(course) === 2 ? ' (2곳)' : ''}
            </span>
            <div className="flex flex-wrap gap-2">
            {SNAP_SPOT_OPTIONS.map((spot) => (
              <Chip
                key={spot}
                label={spot}
                selected={spots.includes(spot)}
                onClick={() => toggleSpot(spot)}
              />
            ))}
            </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={customSpot}
              onChange={(e) => setCustomSpot(e.target.value)}
              placeholder="새 스팟"
              className="min-w-0 flex-1 rounded-xl border border-hairline px-3 py-2 text-[13px]"
            />
            <button
              type="button"
              onClick={() => {
                const s = customSpot.trim()
                if (!s || spots.includes(s)) return
                const limit = maxSpotCount(course)
                if (limit === 1) {
                  setSpots([s])
                } else if (limit != null && spots.length >= limit) {
                  setSpots([...spots.slice(1), s])
                } else {
                  setSpots((p) => [...p, s])
                }
                setCustomSpot('')
              }}
              className="rounded-xl bg-[#F2F2F7] px-3 py-2 text-[12px]"
            >
              추가
            </button>
          </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip
              label="현금 £"
              selected={paymentMethod === 'cash_gbp'}
              onClick={() => setPaymentMethod('cash_gbp')}
            />
            <Chip
              label="한국 계좌 ₩"
              selected={paymentMethod === 'krw_transfer'}
              onClick={() => setPaymentMethod('krw_transfer')}
            />
            <Chip
              label="아직 미입금"
              selected={paymentMethod === 'unpaid'}
              onClick={() => setPaymentMethod('unpaid')}
            />
            <Chip
              label="기록 안 함"
              selected={paymentMethod === null}
              onClick={() => setPaymentMethod(null)}
            />
          </div>

          {(paymentMethod === 'cash_gbp' || paymentMethod === null) && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">받은 금액 £</span>
              <input
                type="number"
                step="0.01"
                value={amountGbp}
                onChange={(e) => setAmountGbp(e.target.value)}
                className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
              />
            </label>
          )}

          {paymentMethod === 'krw_transfer' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">₩</span>
                <input
                  type="text"
                  value={amountKrw}
                  onChange={(e) => setAmountKrw(e.target.value)}
                  className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted">
                  <span>환율 (₩/£)</span>
                  <button
                    type="button"
                    onClick={fxAuto.refresh}
                    className="inline-flex items-center gap-1 text-[10px] text-[#007AFF]"
                  >
                    <RefreshCw size={10} className={fxAuto.loading ? 'animate-spin' : ''} />
                    {fxAuto.loading ? '불러오는 중…' : '다시 불러오기'}
                  </button>
                </span>
                <input
                  type="number"
                  value={fxRate}
                  onChange={(e) => fxAuto.onFxRateChange(e.target.value)}
                  className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
                />
                {fxAuto.hint && (
                  <span className="mt-1 block text-[10px] text-muted">{fxAuto.hint}</span>
                )}
                {fxAuto.error && (
                  <span className="mt-1 block text-[10px] text-[#FF3B30]">{fxAuto.error}</span>
                )}
              </label>
            </div>
          )}

          <p className="text-[12px] font-medium text-[#48484A]">수익: {preview}</p>

          <div className="flex flex-wrap gap-2">
            {SNAP_STATUS_OPTIONS.map((s) => (
              <Chip key={s} label={s} selected={status === s} onClick={() => setStatus(s)} />
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">인원</span>
            <input
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="성별"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="rounded-xl border border-hairline px-3 py-2 text-[13px]"
            />
            <input
              placeholder="연령대"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              className="rounded-xl border border-hairline px-3 py-2 text-[13px]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {SNAP_PURPOSE_OPTIONS.map((p) => (
              <Chip
                key={p}
                label={p}
                selected={purpose === p}
                onClick={() => setPurpose(purpose === p ? '' : p)}
              />
            ))}
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-muted">만족도</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(stars === n ? null : n)}
                  className={`h-8 w-8 rounded-full text-[13px] font-medium ${
                    stars === n
                      ? 'bg-[#1C1C1E] text-white'
                      : 'bg-[#F2F2F7] text-muted hover:bg-[#E5E5EA]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">사진 링크</span>
            <input
              type="url"
              value={photosUrl}
              onChange={(e) => setPhotosUrl(e.target.value)}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
            />
          </label>

          <textarea
            placeholder="메모"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
          />
        </div>

        <div className="flex gap-2 border-t border-hairline p-4">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('이 기록을 삭제할까요?')) {
                onDelete()
                onClose()
              }
            }}
            className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#FF3B30]"
          >
            <Trash2 size={14} /> 삭제
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="ml-auto rounded-xl bg-[#007AFF] px-6 py-2.5 text-[13px] font-semibold text-white"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
