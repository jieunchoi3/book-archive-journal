-- Weekly Planner tables in the `planner` schema (shared Supabase project)
-- Prerequisite: create schema planner; (already done)
-- Also add "planner" to Supabase Dashboard → Settings → API → Exposed schemas

-- Day-of-week metadata (Office / Off / WFH tags)
create table if not exists planner.day_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null check (day_key in ('mon','tue','wed','thu','fri','sat','sun')),
  day_name text not null,
  day_type text not null check (day_type in ('office','off','wfh')),
  tag text not null,
  unique (user_id, day_key)
);

-- Recurring time blocks
create table if not exists planner.blocks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null check (day_key in ('mon','tue','wed','thu','fri','sat','sun')),
  title text not null,
  category text not null,
  time_range_label text not null default '',
  description text not null default '',
  badges jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  is_flexible boolean not null default false
);

create index if not exists blocks_user_day_idx on planner.blocks (user_id, day_key);

-- Recurring checklist tasks inside blocks
create table if not exists planner.recurring_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  block_id text not null references planner.blocks(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create index if not exists recurring_tasks_block_idx on planner.recurring_tasks (block_id);

-- Per-week block state (flexible notes, hidden recurring tasks, per-date hidden tasks)
create table if not exists planner.block_week_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  day_key text not null,
  block_id text not null references planner.blocks(id) on delete cascade,
  flexible_note text,
  hidden_recurring_tasks jsonb not null default '[]'::jsonb,
  hidden_tasks jsonb not null default '[]'::jsonb,
  unique (user_id, week_start, day_key, block_id)
);

create index if not exists block_week_logs_week_idx on planner.block_week_logs (user_id, week_start);

-- Recurring task completion per week (scoped to day + block)
create table if not exists planner.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  day_key text not null,
  block_id text not null references planner.blocks(id) on delete cascade,
  task_id text not null references planner.recurring_tasks(id) on delete cascade,
  done boolean not null default false,
  unique (user_id, week_start, day_key, block_id, task_id)
);

create index if not exists task_completions_week_idx on planner.task_completions (user_id, week_start);

-- One-off tasks scoped to a specific date + block
create table if not exists planner.one_off_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_date date not null,
  block_id text not null references planner.blocks(id) on delete cascade,
  label text not null,
  done boolean not null default false
);

create index if not exists one_off_tasks_date_idx on planner.one_off_tasks (user_id, task_date);

-- Tasks board categories
create table if not exists planner.categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null
);

-- Cross-cutting tags
create table if not exists planner.tags (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text
);

-- Tasks board items
create table if not exists planner.items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category_id text references planner.categories(id) on delete set null,
  due_date date,
  recurrence jsonb,
  done jsonb not null default 'false'::jsonb,
  show_on_weekly_view boolean not null default false,
  time_label text,
  checkable boolean not null default true
);

-- Item ↔ tag join
create table if not exists planner.item_tags (
  item_id text not null references planner.items(id) on delete cascade,
  tag_id text not null references planner.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (item_id, tag_id)
);

-- Quick Launch linked apps
create table if not exists planner.linked_apps (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text not null,
  icon text,
  open_mode text not null check (open_mode in ('iframe','newTab')) default 'newTab',
  sort_order int not null default 0
);

-- Persistent sidebar private note (one per user)
create table if not exists planner.sidebar_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

-- Photo diary (images in storage bucket diary-media; layers[].path)
create table if not exists planner.diary_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  title text not null default '',
  body text not null default '',
  frame_color text not null default '#F2F2F7',
  canvas_strokes jsonb not null default '[]'::jsonb,
  layers jsonb not null default '[]'::jsonb,
  cover_path text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create index if not exists diary_entries_user_month_idx
  on planner.diary_entries (user_id, date_key);

-- Expense tracker document per user
create table if not exists planner.expense_stores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store jsonb not null default '{"categories":[],"transactions":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS
alter table planner.day_templates enable row level security;
alter table planner.blocks enable row level security;
alter table planner.recurring_tasks enable row level security;
alter table planner.block_week_logs enable row level security;
alter table planner.task_completions enable row level security;
alter table planner.one_off_tasks enable row level security;
alter table planner.categories enable row level security;
alter table planner.tags enable row level security;
alter table planner.items enable row level security;
alter table planner.item_tags enable row level security;
alter table planner.linked_apps enable row level security;
alter table planner.sidebar_notes enable row level security;
alter table planner.diary_entries enable row level security;
alter table planner.expense_stores enable row level security;

create policy "day_templates_own" on planner.day_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blocks_own" on planner.blocks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring_tasks_own" on planner.recurring_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "block_week_logs_own" on planner.block_week_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "task_completions_own" on planner.task_completions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "one_off_tasks_own" on planner.one_off_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_own" on planner.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tags_own" on planner.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_own" on planner.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "item_tags_own" on planner.item_tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "linked_apps_own" on planner.linked_apps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sidebar_notes_own" on planner.sidebar_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "diary_entries_own" on planner.diary_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expense_stores_own" on planner.expense_stores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Migration for existing projects:
-- alter table planner.block_week_logs add column if not exists hidden_tasks jsonb not null default '[]'::jsonb;

-- API access for Supabase roles
grant usage on schema planner to anon, authenticated, service_role;
grant all on all tables in schema planner to anon, authenticated, service_role;
grant all on all sequences in schema planner to anon, authenticated, service_role;
alter default privileges in schema planner grant all on tables to anon, authenticated, service_role;

-- ─── Compass (life design) ───────────────────────────────────────────────────

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

create policy "ld_snapshot_own" on planner.ld_snapshot
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_question_own" on planner.ld_question
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_answer_own" on planner.ld_answer
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.ld_snapshot to anon, authenticated, service_role;
grant all on planner.ld_question to anon, authenticated, service_role;
grant all on planner.ld_answer to anon, authenticated, service_role;

-- ─── Compass Phase 2/3 ───────────────────────────────────────────────────────

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

create policy "ld_journal_entry_own" on planner.ld_journal_entry
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_prototype_own" on planner.ld_prototype
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_ai_report_own" on planner.ld_ai_report
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.ld_journal_entry to anon, authenticated, service_role;
grant all on planner.ld_prototype to anon, authenticated, service_role;
grant all on planner.ld_ai_report to anon, authenticated, service_role;
