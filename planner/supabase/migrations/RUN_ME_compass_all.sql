-- ═══════════════════════════════════════════════════════════════════════════
-- Compass 전체 테이블 (Phase 1 + 2) — Supabase SQL Editor에 그대로 붙여넣기
-- Project → SQL Editor → New query → Run
-- schema는 반드시 `planner` (앱이 planner 스키마를 씀)
-- ═══════════════════════════════════════════════════════════════════════════

-- Phase 1
create table if not exists planner.ld_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_key text not null,
  taken_at date not null default current_date,
  label text,
  status text not null default 'draft' check (status in ('draft', 'complete')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ld_snapshot_user_exercise_taken_idx
  on planner.ld_snapshot (user_id, exercise_key, taken_at desc);

create table if not exists planner.ld_question (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  cadence_days int not null,
  next_due_on date not null,
  is_active boolean not null default true,
  color text not null default '#3E6B5E',
  created_at timestamptz not null default now()
);

create table if not exists planner.ld_answer (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references planner.ld_question(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answered_on date not null default current_date,
  body text not null,
  feeling smallint check (feeling is null or (feeling >= 1 and feeling <= 5)),
  created_at timestamptz not null default now()
);
create index if not exists ld_answer_question_answered_idx
  on planner.ld_answer (question_id, answered_on desc);

alter table planner.ld_snapshot enable row level security;
alter table planner.ld_question enable row level security;
alter table planner.ld_answer enable row level security;

drop policy if exists "ld_snapshot_own" on planner.ld_snapshot;
drop policy if exists "ld_question_own" on planner.ld_question;
drop policy if exists "ld_answer_own" on planner.ld_answer;

create policy "ld_snapshot_own" on planner.ld_snapshot
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_question_own" on planner.ld_question
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_answer_own" on planner.ld_answer
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.ld_snapshot to anon, authenticated, service_role;
grant all on planner.ld_question to anon, authenticated, service_role;
grant all on planner.ld_answer to anon, authenticated, service_role;

-- Phase 2/3
create table if not exists planner.ld_journal_entry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  activity text not null,
  bucket text,
  engagement smallint not null check (engagement >= -5 and engagement <= 5),
  energy smallint not null check (energy >= -5 and energy <= 5),
  is_flow boolean not null default false,
  note text,
  aeiou jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ld_journal_entry_user_date_idx
  on planner.ld_journal_entry (user_id, entry_date desc);

create table if not exists planner.ld_prototype (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('conversation', 'experience')),
  title text not null,
  person text,
  happened_on date,
  going_in_q text,
  learned text,
  next_step text,
  linked_plan text,
  status text not null default 'planned' check (status in ('planned', 'done', 'dropped')),
  created_at timestamptz not null default now()
);
create index if not exists ld_prototype_user_created_idx
  on planner.ld_prototype (user_id, created_at desc);

create table if not exists planner.ld_ai_report (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('snapshot', 'compare', 'pathway')),
  input_hash text not null,
  input_refs jsonb not null,
  output jsonb not null,
  model text,
  created_at timestamptz not null default now()
);
create unique index if not exists ld_ai_report_user_hash_idx
  on planner.ld_ai_report (user_id, input_hash);

alter table planner.ld_journal_entry enable row level security;
alter table planner.ld_prototype enable row level security;
alter table planner.ld_ai_report enable row level security;

drop policy if exists "ld_journal_entry_own" on planner.ld_journal_entry;
drop policy if exists "ld_prototype_own" on planner.ld_prototype;
drop policy if exists "ld_ai_report_own" on planner.ld_ai_report;

create policy "ld_journal_entry_own" on planner.ld_journal_entry
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_prototype_own" on planner.ld_prototype
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_ai_report_own" on planner.ld_ai_report
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.ld_journal_entry to anon, authenticated, service_role;
grant all on planner.ld_prototype to anon, authenticated, service_role;
grant all on planner.ld_ai_report to anon, authenticated, service_role;
