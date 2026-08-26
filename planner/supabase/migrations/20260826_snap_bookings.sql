-- Snap bookings (코지캡쳐 freelance photo business)
create table if not exists planner.snap_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  customer_name text not null,
  spots text[] not null default '{}',
  minutes int,
  course text not null,
  headcount int not null default 1,
  list_price_gbp numeric not null,
  payment_method text check (
    payment_method is null
    or payment_method in ('cash_gbp', 'krw_transfer', 'unpaid')
  ),
  amount_gbp numeric,
  amount_krw numeric,
  fx_rate numeric,
  status text not null default '입금완료',
  gender text,
  age_band text,
  purpose text,
  stars int check (stars is null or (stars >= 1 and stars <= 5)),
  photos_url text,
  note text,
  source text not null default 'manual' check (source in ('manual', 'notion_import')),
  created_at timestamptz not null default now()
);

create index if not exists snap_bookings_user_date_idx
  on planner.snap_bookings (user_id, date desc);

-- Idempotent Notion seed: one deterministic id per (user, import key)
create unique index if not exists snap_bookings_user_id_uidx
  on planner.snap_bookings (user_id, id);

alter table planner.snap_bookings enable row level security;

create policy "snap_bookings_own" on planner.snap_bookings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.snap_bookings to anon, authenticated, service_role;
