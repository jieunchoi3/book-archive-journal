-- Taste scrapbook store (categories, polaroids, month backgrounds) — one row per user.
create table if not exists planner.taste_stores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists taste_stores_updated_idx
  on planner.taste_stores (updated_at desc);

alter table planner.taste_stores enable row level security;

drop policy if exists "taste_stores_own" on planner.taste_stores;
create policy "taste_stores_own" on planner.taste_stores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.taste_stores to anon, authenticated, service_role;
