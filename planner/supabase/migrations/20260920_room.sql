-- My Room: persistent people + event-sourced placements

create table if not exists planner.room_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_key text,
  name text not null,
  field_industry text not null default '',
  how_we_met text not null default '',
  mbti text not null default '',
  location text not null default '',
  note text not null default '',
  met_on date,
  last_contact_on date,
  notion_compatibility text,
  created_at timestamptz not null default now()
);

create unique index if not exists room_people_user_import_key_idx
  on planner.room_people (user_id, import_key)
  where import_key is not null;

create index if not exists room_people_user_name_idx
  on planner.room_people (user_id, name);

create table if not exists planner.room_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references planner.room_people(id) on delete cascade,
  effective_on date not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists room_events_user_person_date_idx
  on planner.room_events (user_id, person_id, effective_on desc);

create table if not exists planner.room_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_key text not null,
  body text not null,
  person_id uuid references planner.room_people(id) on delete set null,
  written_on date not null,
  created_at timestamptz not null default now()
);

create table if not exists planner.room_reminder_dismissals (
  person_id uuid primary key references planner.room_people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snooze_until date,
  dismissed_at timestamptz
);

alter table planner.room_people enable row level security;
alter table planner.room_events enable row level security;
alter table planner.room_reflections enable row level security;
alter table planner.room_reminder_dismissals enable row level security;

create policy "room_people_own" on planner.room_people
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "room_events_own" on planner.room_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "room_reflections_own" on planner.room_reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "room_reminder_dismissals_own" on planner.room_reminder_dismissals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.room_people to anon, authenticated, service_role;
grant all on planner.room_events to anon, authenticated, service_role;
grant all on planner.room_reflections to anon, authenticated, service_role;
grant all on planner.room_reminder_dismissals to anon, authenticated, service_role;
