-- Weekly commitment quotas (flexible blocks dragged onto days). Additive only.

create table if not exists planner.week_commitments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  color text not null default '#007AFF',
  target_per_week int not null default 1 check (target_per_week >= 0 and target_per_week <= 21),
  default_tasks jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists week_commitments_user_idx
  on planner.week_commitments (user_id, sort_order);

create table if not exists planner.week_commitment_placements (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  commitment_id text not null references planner.week_commitments(id) on delete cascade,
  day_key text not null check (day_key in ('mon','tue','wed','thu','fri','sat','sun')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists week_commitment_placements_user_week_idx
  on planner.week_commitment_placements (user_id, week_start);

create index if not exists week_commitment_placements_commitment_idx
  on planner.week_commitment_placements (commitment_id);

create table if not exists planner.week_commitment_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  placement_id text not null references planner.week_commitment_placements(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  repeat_weekly boolean not null default false,
  source_default_id text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists week_commitment_tasks_placement_idx
  on planner.week_commitment_tasks (placement_id);

alter table planner.week_commitments enable row level security;
alter table planner.week_commitment_placements enable row level security;
alter table planner.week_commitment_tasks enable row level security;

drop policy if exists "week_commitments_own" on planner.week_commitments;
create policy "week_commitments_own" on planner.week_commitments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "week_commitment_placements_own" on planner.week_commitment_placements;
create policy "week_commitment_placements_own" on planner.week_commitment_placements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "week_commitment_tasks_own" on planner.week_commitment_tasks;
create policy "week_commitment_tasks_own" on planner.week_commitment_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.week_commitments to anon, authenticated, service_role;
grant all on planner.week_commitment_placements to anon, authenticated, service_role;
grant all on planner.week_commitment_tasks to anon, authenticated, service_role;
