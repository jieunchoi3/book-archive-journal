import type { SnapBooking } from '../types/snap'
import { discountGbp, fxDeltaGbp, revenueGbp } from './snapRevenue'

function csvEscape(value: string | number | null | undefined): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildSnapCsv(bookings: SnapBooking[]): string {
  const header = [
    'date',
    'customer_name',
    'spots',
    'minutes',
    'course',
    'headcount',
    'list_price_gbp',
    'payment_method',
    'amount_gbp',
    'amount_krw',
    'fx_rate',
    'revenue_gbp',
    'discount_gbp',
    'fx_delta_gbp',
    'status',
    'gender',
    'age_band',
    'purpose',
    'stars',
    'photos_url',
    'note',
    'created_at',
  ]

  const rows = [...bookings]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((b) => {
      const rev = revenueGbp(b)
      const disc = discountGbp(b)
      const fx = fxDeltaGbp(b)
      return [
        b.date,
        b.customerName,
        b.spots.join('|'),
        b.minutes ?? '',
        b.course,
        b.headcount,
        b.listPriceGbp.toFixed(2),
        b.paymentMethod ?? '',
        b.amountGbp != null ? b.amountGbp.toFixed(2) : '',
        b.amountKrw != null ? String(Math.round(b.amountKrw)) : '',
        b.fxRate != null ? String(b.fxRate) : '',
        rev.toFixed(2),
        disc != null ? disc.toFixed(2) : '',
        fx != null ? fx.toFixed(2) : '',
        b.status,
        b.gender ?? '',
        b.ageBand ?? '',
        b.purpose ?? '',
        b.stars ?? '',
        b.photosUrl ?? '',
        b.note ?? '',
        b.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    })

  return [header.join(','), ...rows].join('\n')
}

export function downloadSnapCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportSnapCsvFile(bookings: SnapBooking[], filename: string) {
  downloadSnapCsv(buildSnapCsv(bookings), filename)
}
