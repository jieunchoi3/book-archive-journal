-- Diary hashtag folders (main tag = folder, sub tag = nested folder)
alter table planner.diary_entries
  add column if not exists main_tag text,
  add column if not exists sub_tag text;

create table if not exists planner.diary_tag_folders (
  user_id uuid not null references auth.users(id) on delete cascade,
  main_tag text not null,
  sub_tag text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, main_tag, sub_tag)
);

create index if not exists diary_entries_user_tags_idx
  on planner.diary_entries (user_id, main_tag, sub_tag);

alter table planner.diary_tag_folders enable row level security;

create policy "diary_tag_folders_own" on planner.diary_tag_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
