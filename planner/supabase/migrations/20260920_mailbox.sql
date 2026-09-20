-- Future Self Mailbox: recurring prompts + scheduled letters

create table if not exists planner.mailbox_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  cadence_days int not null check (cadence_days >= 1),
  next_due_on date not null,
  is_active boolean not null default true,
  envelope_color text not null default '#E8D5C4',
  created_at timestamptz not null default now()
);

create index if not exists mailbox_prompts_user_due_idx
  on planner.mailbox_prompts (user_id, next_due_on);

create table if not exists planner.mailbox_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scheduled_letter', 'prompt_answer')),
  prompt_id uuid references planner.mailbox_prompts(id) on delete cascade,
  body text not null,
  written_on date not null,
  deliver_on date not null,
  opened_at timestamptz,
  feeling smallint check (feeling is null or (feeling >= 1 and feeling <= 5)),
  created_at timestamptz not null default now()
);

create index if not exists mailbox_letters_user_deliver_idx
  on planner.mailbox_letters (user_id, deliver_on);

create index if not exists mailbox_letters_user_opened_idx
  on planner.mailbox_letters (user_id, opened_at);

create index if not exists mailbox_letters_prompt_written_idx
  on planner.mailbox_letters (prompt_id, written_on desc);

alter table planner.mailbox_prompts enable row level security;
alter table planner.mailbox_letters enable row level security;

create policy "mailbox_prompts_own" on planner.mailbox_prompts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "mailbox_letters_own" on planner.mailbox_letters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on planner.mailbox_prompts to anon, authenticated, service_role;
grant all on planner.mailbox_letters to anon, authenticated, service_role;
