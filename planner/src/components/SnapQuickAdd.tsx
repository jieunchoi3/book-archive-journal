import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import type { SnapBookingInput } from '../hooks/useSnapBookings'
import type { SnapCourse, SnapPaymentMethod } from '../types/snap'
import {
  COURSE_DEFAULTS,
  formatGbp,
  formatKrw,
  SNAP_COURSE_OPTIONS,
  SNAP_PURPOSE_OPTIONS,
  SNAP_SPOT_OPTIONS,
  SNAP_STATUS_OPTIONS,
} from '../types/snap'
import { revenueGbp } from '../lib/snapRevenue'
import { getTodayKey } from '../lib/weekUtils'

interface SnapQuickAddProps {
  onAdd: (input: SnapBookingInput) => void
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

export function SnapQuickAdd({ onAdd }: SnapQuickAddProps) {
  const [date, setDate] = useState(getTodayKey())
  const [customerName, setCustomerName] = useState('')
  const [course, setCourse] = useState<SnapCourse>('싱글')
  const [minutes, setMinutes] = useState('50')
  const [listPriceGbp, setListPriceGbp] = useState('55')
  const [spots, setSpots] = useState<string[]>([])
  const [customSpot, setCustomSpot] = useState('')
  const [headcount, setHeadcount] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<SnapPaymentMethod>('cash_gbp')
  const [amountGbp, setAmountGbp] = useState('50')
  const [amountKrw, setAmountKrw] = useState('')
  const [fxRate, setFxRate] = useState('')
  const [status, setStatus] = useState<string>('입금완료')
  const [gender, setGender] = useState('')
  const [ageBand, setAgeBand] = useState('')
  const [purpose, setPurpose] = useState<string>('')
  const [stars, setStars] = useState<number | null>(null)
  const [photosUrl, setPhotosUrl] = useState('')
  const [note, setNote] = useState('')
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const applyCourse = (c: SnapCourse) => {
    setCourse(c)
    const defs = COURSE_DEFAULTS[c]
    if (defs.minutes != null) setMinutes(String(defs.minutes))
    if (defs.listPriceGbp != null) setListPriceGbp(String(defs.listPriceGbp))
    if (paymentMethod === 'cash_gbp' && defs.cashPriceGbp != null) {
      setAmountGbp(String(defs.cashPriceGbp))
    }
    if (defs.defaultSpots === 2 && spots.length === 0) {
      setSpots(['빅벤·런던아이', '타워브릿지'])
    }
  }

  const setPayment = (method: SnapPaymentMethod) => {
    if (method === 'cash_gbp' && paymentMethod !== 'cash_gbp') {
      const defs = COURSE_DEFAULTS[course]
      if (defs.cashPriceGbp != null) setAmountGbp(String(defs.cashPriceGbp))
    }
    setPaymentMethod(method)
  }

  const draftBooking = useMemo((): SnapBookingInput => ({
    date,
    customerName: customerName.trim(),
    spots,
    minutes: minutes ? Number(minutes) : null,
    course,
    headcount,
    listPriceGbp: Number(listPriceGbp) || 0,
    paymentMethod,
    amountGbp: paymentMethod === 'cash_gbp' ? Number(amountGbp) || null : null,
    amountKrw: paymentMethod === 'krw_transfer' ? Number(amountKrw.replace(/,/g, '')) || null : null,
    fxRate: paymentMethod === 'krw_transfer' ? Number(fxRate) || null : null,
    status,
    gender: gender.trim() || null,
    ageBand: ageBand.trim() || null,
    purpose: purpose || null,
    stars,
    photosUrl: photosUrl.trim() || null,
    note: note.trim() || null,
    source: 'manual',
  }), [
    date, customerName, spots, minutes, course, headcount, listPriceGbp,
    paymentMethod, amountGbp, amountKrw, fxRate, status, gender, ageBand,
    purpose, stars, photosUrl, note,
  ])

  const livePreview = useMemo(() => {
    const rev = revenueGbp({ ...draftBooking, id: '', createdAt: '' })
    const list = Number(listPriceGbp) || 0
    if (paymentMethod === 'krw_transfer' && amountKrw && fxRate) {
      const krw = Number(amountKrw.replace(/,/g, ''))
      const rate = Number(fxRate)
      const delta = rev - list
      const sign = delta >= 0 ? '+' : ''
      return `${formatKrw(krw)} ÷ ${rate.toLocaleString('en-GB')} = ${formatGbp(rev)} (정가 대비 ${sign}${formatGbp(delta)})`
    }
    if (paymentMethod === 'cash_gbp') {
      const disc = list - rev
      if (disc > 0.001) return `${formatGbp(rev)} (현금 할인 −${formatGbp(disc)})`
      return formatGbp(rev)
    }
    if (paymentMethod === 'unpaid') return '미입금'
    return formatGbp(rev)
  }, [draftBooking, paymentMethod, amountKrw, fxRate, listPriceGbp, amountGbp])

  const toggleSpot = (spot: string) => {
    setSpots((prev) =>
      prev.includes(spot) ? prev.filter((s) => s !== spot) : [...prev, spot],
    )
  }

  const addCustomSpot = () => {
    const s = customSpot.trim()
    if (!s || spots.includes(s)) return
    setSpots((prev) => [...prev, s])
    setCustomSpot('')
  }

  const canSubmit = customerName.trim().length > 0 && spots.length > 0

  const resetForm = () => {
    setCustomerName('')
    setSpots([])
    setHeadcount(1)
    setCourse('싱글')
    setMinutes('50')
    setListPriceGbp('55')
    setPaymentMethod('cash_gbp')
    setAmountGbp('50')
    setAmountKrw('')
    setFxRate('')
    setStatus('입금완료')
    setGender('')
    setAgeBand('')
    setPurpose('')
    setStars(null)
    setPhotosUrl('')
    setNote('')
    setDate(getTodayKey())
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onAdd(draftBooking)
    resetForm()
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1200)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm">
      <div className="border-b border-hairline bg-[#FAFAFA] px-4 py-3">
        <h2 className="text-[13px] font-semibold text-[#1C1C1E]">촬영 기록</h2>
        <p className="text-[11px] text-muted">30초 안에 저장</p>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted">날짜</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
            />
          </label>
          <label className="block col-span-1">
            <span className="mb-1 block text-[11px] font-medium text-muted">고객명</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="이름"
              className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-muted">코스</span>
          <div className="flex flex-wrap gap-2">
            {SNAP_COURSE_OPTIONS.map((c) => (
              <Chip key={c} label={c} selected={course === c} onClick={() => applyCourse(c)} />
            ))}
          </div>
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
          <span className="mb-1.5 block text-[11px] font-medium text-muted">스팟</span>
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
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSpot())}
            />
            <button
              type="button"
              onClick={addCustomSpot}
              className="shrink-0 rounded-xl bg-[#F2F2F7] px-3 py-2 text-[12px] font-medium text-[#48484A]"
            >
              추가
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-muted">인원</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHeadcount((h) => Math.max(1, h - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F2F7]"
            >
              <Minus size={14} />
            </button>
            <span className="min-w-[1.5rem] text-center text-[14px] font-semibold">{headcount}</span>
            <button
              type="button"
              onClick={() => setHeadcount((h) => h + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F2F7]"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-muted">결제</span>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="현금 £"
              selected={paymentMethod === 'cash_gbp'}
              onClick={() => setPayment('cash_gbp')}
            />
            <Chip
              label="한국 계좌 ₩"
              selected={paymentMethod === 'krw_transfer'}
              onClick={() => setPayment('krw_transfer')}
            />
            <Chip
              label="아직 미입금"
              selected={paymentMethod === 'unpaid'}
              onClick={() => setPayment('unpaid')}
            />
          </div>
        </div>

        {paymentMethod === 'cash_gbp' && (
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
              <span className="mb-1 block text-[11px] font-medium text-muted">받은 금액 ₩</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountKrw}
                onChange={(e) => setAmountKrw(e.target.value)}
                placeholder="103000"
                className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">환율 (₩/£)</span>
              <input
                type="number"
                step="0.01"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                placeholder="1870"
                className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
              />
            </label>
          </div>
        )}

        <p className="rounded-xl bg-[#F2F2F7] px-3 py-2 text-[12px] font-medium text-[#48484A]">
          {livePreview}
        </p>

        <button
          type="button"
          onClick={() => setOptionalOpen((o) => !o)}
          className="flex w-full items-center justify-between text-[12px] font-medium text-muted"
        >
          추가 정보 (선택)
          {optionalOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {optionalOpen && (
          <div className="space-y-3 border-t border-hairline pt-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">성별</span>
                <input
                  type="text"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">연령대</span>
                <input
                  type="text"
                  value={ageBand}
                  onChange={(e) => setAgeBand(e.target.value)}
                  className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
                />
              </label>
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-muted">목적</span>
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
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted">메모</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-hairline px-3 py-2 text-[13px]"
              />
            </label>
            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-muted">상태</span>
              <div className="flex flex-wrap gap-2">
                {SNAP_STATUS_OPTIONS.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    selected={status === s}
                    onClick={() => setStatus(s)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold transition-colors ${
            canSubmit
              ? savedFlash
                ? 'bg-[#34C759] text-white'
                : 'bg-[#007AFF] text-white hover:bg-[#0066DD]'
              : 'cursor-not-allowed bg-[#E5E5EA] text-muted'
          }`}
        >
          {savedFlash ? (
            <>
              <Check size={16} /> 저장됨
            </>
          ) : (
            '저장'
          )}
        </button>
      </div>
    </section>
  )
}
