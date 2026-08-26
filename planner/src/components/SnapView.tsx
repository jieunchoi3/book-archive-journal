import { useMemo, useState } from 'react'
import { Camera, Download, Pencil } from 'lucide-react'
import type { SnapActions } from '../hooks/useSnapBookings'
import type { SnapBooking, SnapPeriod } from '../types/snap'
import { formatGbp, paymentMethodLabel } from '../types/snap'
import { revenueGbp } from '../lib/snapRevenue'
import { exportSnapCsvFile } from '../lib/snapCsv'
import { formatDateKey, parseDateKey } from '../lib/weekUtils'
import { SnapQuickAdd } from './SnapQuickAdd'
import { SnapMonthlyChart } from './SnapMonthlyChart'
import { SnapEditModal } from './SnapEditModal'

interface SnapViewProps {
  snap: SnapActions
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: SnapPeriod
  onChange: (p: SnapPeriod) => void
}) {
  const options: { id: SnapPeriod; label: string }[] = [
    { id: 'month', label: '이번 달' },
    { id: 'year', label: '올해' },
    { id: 'all', label: '전체' },
  ]
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
            period === o.id
              ? 'bg-[#1C1C1E] text-white'
              : 'bg-white text-[#48484A] ring-1 ring-hairline hover:bg-[#F2F2F7]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-[#FAFAFA] px-3 py-2.5 ring-1 ring-hairline">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold text-[#1C1C1E]">{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  )
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-hairline bg-[#FAFAFA] px-4 py-3">
        <h2 className="text-[13px] font-semibold text-[#1C1C1E]">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function SnapView({ snap }: SnapViewProps) {
  const {
    loading,
    period,
    setPeriod,
    monthFilter,
    selectMonth,
    filteredBookings,
    addBooking,
    updateBooking,
    deleteBooking,
    unpaidBookings,
    stats,
    monthlyRevenue,
    courseBreakdown,
    spotPopularity,
    paymentMix,
    totalCashDiscount,
    totalFxDelta,
    repeatCustomers,
    bookings,
  } = snap

  const [editingId, setEditingId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const editingBooking = useMemo(
    () => (editingId ? bookings.find((b) => b.id === editingId) ?? null : null),
    [editingId, bookings],
  )

  const exportCsv = (scope: 'all' | 'period') => {
    const rows = scope === 'all' ? bookings : snap.periodBookings
    const stamp = new Date().toISOString().slice(0, 10)
    exportSnapCsvFile(rows, `snap-bookings-${stamp}.csv`)
    setExportOpen(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pb-24">
        <p className="text-[13px] text-muted">Loading Snap…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-24 sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-[#007AFF]" />
            <h1 className="text-[20px] font-bold text-[#1C1C1E]">Snap</h1>
          </div>
          <p className="mt-0.5 text-[12px] text-muted">코지캡쳐 · 촬영 & 수익</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-medium text-[#48484A] ring-1 ring-hairline hover:bg-[#F2F2F7]"
            aria-expanded={exportOpen}
            aria-haspopup="menu"
          >
            <Download size={14} />
            Export CSV
          </button>
          {exportOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close export menu"
                onClick={() => setExportOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-hairline bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => exportCsv('period')}
                  className="block w-full px-4 py-2 text-left text-[12px] hover:bg-[#F2F2F7]"
                >
                  현재 기간
                </button>
                <button
                  type="button"
                  onClick={() => exportCsv('all')}
                  className="block w-full px-4 py-2 text-left text-[12px] hover:bg-[#F2F2F7]"
                >
                  전체 기록
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-4">
        <SnapQuickAdd onAdd={addBooking} />

        <SectionCard
          title="요약"
          action={<PeriodToggle period={period} onChange={setPeriod} />}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatCard label="총 수익" value={formatGbp(stats.totalRevenue)} />
            <StatCard
              label="촬영"
              value={`${stats.shootCount}회`}
              sub={`${stats.totalHeadcount}명`}
            />
            <StatCard
              label="평균 / 촬영"
              value={formatGbp(stats.avgRevenuePerShoot)}
            />
            <StatCard
              label="시간당"
              value={formatGbp(stats.effectiveHourlyRate)}
            />
            <StatCard
              label="재방문율"
              value={`${Math.round(stats.repeatCustomerRate * 100)}%`}
              sub="2회+ 고객 비율"
            />
          </div>
        </SectionCard>

        <SectionCard title="월별 수익">
          <SnapMonthlyChart
            months={monthlyRevenue}
            selectedMonthKey={monthFilter}
            onSelectMonth={selectMonth}
            formatGbp={formatGbp}
          />
          {monthFilter && (
            <p className="mt-2 text-[11px] text-muted">
              {monthFilter} 필터 적용 중 ·{' '}
              <button
                type="button"
                className="text-[#007AFF]"
                onClick={() => selectMonth(null)}
              >
                해제
              </button>
            </p>
          )}
        </SectionCard>

        <SectionCard title="코스별">
          {courseBreakdown.length === 0 ? (
            <p className="text-[12px] text-muted">데이터 없음</p>
          ) : (
            <ul className="space-y-2">
              {courseBreakdown.map((row) => (
                <li
                  key={row.course}
                  className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-3 py-2"
                >
                  <div>
                    <p className="text-[13px] font-medium">{row.course}</p>
                    <p className="text-[11px] text-muted">{row.count}회</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold">{formatGbp(row.revenue)}</p>
                    <p className="text-[11px] text-muted">평균 {formatGbp(row.avgRevenue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="스팟 인기">
          {spotPopularity.length === 0 ? (
            <p className="text-[12px] text-muted">데이터 없음</p>
          ) : (
            <ul className="space-y-1.5">
              {spotPopularity.map((row) => (
                <li key={row.spot} className="flex justify-between text-[12px]">
                  <span className="text-[#48484A]">{row.spot}</span>
                  <span className="font-medium">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="결제 방식">
          <ul className="mb-3 space-y-2">
            {paymentMix.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-3 py-2"
              >
                <div>
                  <p className="text-[13px] font-medium">{row.label}</p>
                  <p className="text-[11px] text-muted">{row.count}회</p>
                </div>
                <p className="text-[13px] font-semibold">{formatGbp(row.revenue)}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted">
            <span>현금 할인 합계: −{formatGbp(totalCashDiscount)}</span>
            <span>
              환율 차이 합계: {totalFxDelta >= 0 ? '+' : ''}
              {formatGbp(totalFxDelta)}
            </span>
          </div>
        </SectionCard>

        <SectionCard title="재방문 고객">
          {repeatCustomers.length === 0 ? (
            <p className="text-[12px] text-muted">아직 재방문 고객이 없어요</p>
          ) : (
            <ul className="space-y-2">
              {repeatCustomers.map((c) => (
                <li
                  key={c.name}
                  className="flex justify-between rounded-xl bg-[#FAFAFA] px-3 py-2"
                >
                  <div>
                    <p className="text-[13px] font-medium">{c.name}</p>
                    <p className="text-[11px] text-muted">{c.count}회</p>
                  </div>
                  <p className="text-[13px] font-semibold">{formatGbp(c.revenue)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="미입금">
          {unpaidBookings.length === 0 ? (
            <p className="text-[12px] text-[#34C759]">모두 입금 완료!</p>
          ) : (
            <ul className="space-y-2">
              {unpaidBookings.map((b) => (
                <BookingRow key={b.id} booking={b} onEdit={() => setEditingId(b.id)} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="기록">
          {filteredBookings.length === 0 ? (
            <p className="text-[12px] text-muted">기록 없음</p>
          ) : (
            <ul className="space-y-2">
              {filteredBookings.map((b) => (
                <BookingRow key={b.id} booking={b} onEdit={() => setEditingId(b.id)} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {editingBooking && (
        <SnapEditModal
          booking={editingBooking}
          onSave={(input) => updateBooking(editingBooking.id, input)}
          onDelete={() => deleteBooking(editingBooking.id)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

function BookingRow({ booking, onEdit }: { booking: SnapBooking; onEdit: () => void }) {
  const rev = revenueGbp(booking)
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-3 rounded-xl bg-[#FAFAFA] px-3 py-2.5 text-left transition-colors hover:bg-[#F2F2F7]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-semibold text-[#1C1C1E]">
              {booking.customerName}
            </span>
            <span className="text-[11px] text-muted">
              {formatDateKey(parseDateKey(booking.date))}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
            {booking.course}
            {booking.minutes != null ? ` · ${booking.minutes}분` : ''}
            {' · '}
            {booking.spots.join(' · ')}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            {paymentMethodLabel(booking.paymentMethod)}
            {booking.status !== '입금완료' ? ` · ${booking.status}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[14px] font-semibold text-[#1C1C1E]">{formatGbp(rev)}</span>
          <Pencil size={14} className="text-muted" />
        </div>
      </button>
    </li>
  )
}
