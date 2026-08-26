-- Compass Prototype v2: questions, ideas, expanded prototype fields

create table if not exists planner.ld_proto_question (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  origin text not null default 'manual'
    check (origin in ('odyssey', 'prototype', 'manual')),
  origin_ref jsonb,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ld_proto_question_user_created_idx
  on planner.ld_proto_question (user_id, created_at desc);

create table if not exists planner.ld_proto_idea (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references planner.ld_proto_question(id) on delete cascade,
  kind text not null check (kind in ('conversation', 'experience')),
  body text not null,
  promoted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ld_proto_idea_question_idx
  on planner.ld_proto_idea (question_id, created_at desc);

-- Expand ld_prototype for v2 (keep legacy columns for old rows)
alter table planner.ld_prototype
  add column if not exists question_id uuid references planner.ld_proto_question(id),
  add column if not exists how_known text,
  add column if not exists prep_checks jsonb,
  add column if not exists questions jsonb,
  add column if not exists scope text,
  add column if not exists duration text,
  add column if not exists learn_goal text,
  add column if not exists answered text,
  add column if not exists engagement smallint,
  add column if not exists energy smallint,
  add column if not exists referral text;

alter table planner.ld_proto_question enable row level security;
alter table planner.ld_proto_idea enable row level security;

drop policy if exists "ld_proto_question_own" on planner.ld_proto_question;
drop policy if exists "ld_proto_idea_own" on planner.ld_proto_idea;

create policy "ld_proto_question_own" on planner.ld_proto_question
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ld_proto_idea_own" on planner.ld_proto_idea
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.ld_proto_question to anon, authenticated, service_role;
grant all on planner.ld_proto_idea to anon, authenticated, service_role;
