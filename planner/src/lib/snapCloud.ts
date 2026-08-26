import type { SnapBooking, SnapPaymentMethod, SnapSource, SnapStatus } from '../types/snap'
import { supabase } from './supabase'
import { normalizeDateKey } from './diaryCloud'

type SnapRow = {
  id: string
  user_id: string
  date: string | Date
  customer_name: string
  spots: string[]
  minutes: number | null
  course: string
  headcount: number
  list_price_gbp: number
  payment_method: SnapPaymentMethod | null
  amount_gbp: number | null
  amount_krw: number | null
  fx_rate: number | null
  status: string
  gender: string | null
  age_band: string | null
  purpose: string | null
  stars: number | null
  photos_url: string | null
  note: string | null
  source: string | null
  created_at: string
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeSource(raw: string | null | undefined): SnapSource {
  return raw === 'notion_import' ? 'notion_import' : 'manual'
}

function rowToBooking(row: SnapRow): SnapBooking {
  return {
    id: row.id,
    date: normalizeDateKey(row.date),
    customerName: row.customer_name,
    spots: row.spots ?? [],
    minutes: row.minutes,
    course: row.course,
    headcount: row.headcount,
    listPriceGbp: Number(row.list_price_gbp),
    paymentMethod: row.payment_method,
    amountGbp: num(row.amount_gbp),
    amountKrw: num(row.amount_krw),
    fxRate: num(row.fx_rate),
    status: row.status as SnapStatus,
    gender: row.gender,
    ageBand: row.age_band,
    purpose: row.purpose,
    stars: row.stars,
    photosUrl: row.photos_url,
    note: row.note,
    source: normalizeSource(row.source),
    createdAt: row.created_at,
  }
}

function bookingToRow(userId: string, b: SnapBooking): SnapRow {
  return {
    id: b.id,
    user_id: userId,
    date: b.date,
    customer_name: b.customerName,
    spots: b.spots,
    minutes: b.minutes,
    course: b.course,
    headcount: b.headcount,
    list_price_gbp: b.listPriceGbp,
    payment_method: b.paymentMethod,
    amount_gbp: b.amountGbp,
    amount_krw: b.amountKrw,
    fx_rate: b.fxRate,
    status: b.status,
    gender: b.gender,
    age_band: b.ageBand,
    purpose: b.purpose,
    stars: b.stars,
    photos_url: b.photosUrl,
    note: b.note,
    source: b.source ?? 'manual',
    created_at: b.createdAt,
  }
}

export async function fetchSnapBookingsCloud(userId: string): Promise<SnapBooking[]> {
  const { data, error } = await supabase
    .from('snap_bookings')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as SnapRow[]).map(rowToBooking)
}

export async function upsertSnapBookingsCloud(
  userId: string,
  bookings: SnapBooking[],
  opts?: { ignoreDuplicates?: boolean },
): Promise<void> {
  if (!bookings.length) return
  const rows = bookings.map((b) => bookingToRow(userId, b))
  const { error } = await supabase.from('snap_bookings').upsert(rows, {
    onConflict: 'id',
    ignoreDuplicates: opts?.ignoreDuplicates ?? false,
  })
  if (error) throw error
}

export async function deleteSnapBookingCloud(id: string): Promise<void> {
  const { error } = await supabase.from('snap_bookings').delete().eq('id', id)
  if (error) throw error
}

export async function replaceAllSnapBookingsCloud(
  userId: string,
  bookings: SnapBooking[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('snap_bookings')
    .delete()
    .eq('user_id', userId)
  if (delErr) throw delErr
  if (bookings.length) {
    await upsertSnapBookingsCloud(userId, bookings)
  }
}
