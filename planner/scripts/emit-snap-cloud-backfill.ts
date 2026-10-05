import { writeFileSync } from 'node:fs'
import { buildSnapSeedBookings } from '../src/data/snapSeed'

function sqlStr(s: string | null | undefined): string {
  if (s == null) return 'null'
  return `'${String(s).replace(/'/g, "''")}'`
}

const userId = process.argv[2] ?? 'd1c5a163-4f40-4ccf-87a6-a885bdee0a43'

const rows = await buildSnapSeedBookings(userId)
const values = rows.map((b) => {
  const spots = `ARRAY[${b.spots.map((s) => sqlStr(s)).join(',')}]`
  return `(${sqlStr(b.id)}::uuid, ${sqlStr(userId)}::uuid, ${sqlStr(b.date)}::date, ${sqlStr(b.customerName)}, ${spots}, ${b.minutes ?? 'null'}, ${sqlStr(b.course)}, ${b.headcount}, ${b.listPriceGbp}, null, ${b.amountGbp}, null, null, '입금완료', ${sqlStr(b.gender)}, ${sqlStr(b.ageBand)}, ${sqlStr(b.purpose)}, ${b.stars ?? 'null'}, null, null, 'notion_import', ${sqlStr(b.createdAt)}::timestamptz)`
})

const sql = `-- Backfill Notion import snap bookings for ${userId}
INSERT INTO planner.snap_bookings (
  id, user_id, date, customer_name, spots, minutes, course, headcount,
  list_price_gbp, payment_method, amount_gbp, amount_krw, fx_rate, status,
  gender, age_band, purpose, stars, photos_url, note, source, created_at
) VALUES
${values.join(',\n')}
ON CONFLICT (id) DO NOTHING;
`

writeFileSync(new URL('../supabase/migrations/20261005_snap_notion_seed_backfill.sql', import.meta.url), sql)
console.log('Wrote migration with', rows.length, 'rows')
