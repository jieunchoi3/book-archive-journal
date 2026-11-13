-- Fresh cloud diary (separate from legacy planner.diary_entries + diary-media).

create table if not exists planner.diary_v2_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  date_key date not null,
  title text not null default '',
  body text not null default '',
  body_images jsonb not null default '[]'::jsonb,
  main_tag text,
  sub_tag text,
  tag_folders jsonb not null default '[]'::jsonb,
  frame_color text not null default '#F2F2F7',
  canvas_strokes jsonb not null default '[]'::jsonb,
  layers jsonb not null default '[]'::jsonb,
  cover_path text,
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index if not exists diary_v2_entries_user_date_idx
  on planner.diary_v2_entries (user_id, date_key);

alter table planner.diary_v2_entries enable row level security;

drop policy if exists "diary_v2_entries_own" on planner.diary_v2_entries;
create policy "diary_v2_entries_own" on planner.diary_v2_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists planner.diary_v2_tag_folders (
  user_id uuid not null references auth.users(id) on delete cascade,
  main_tag text not null,
  sub_tag text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, main_tag, sub_tag)
);

alter table planner.diary_v2_tag_folders enable row level security;

drop policy if exists "diary_v2_tag_folders_own" on planner.diary_v2_tag_folders;
create policy "diary_v2_tag_folders_own" on planner.diary_v2_tag_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('diary-v2-media', 'diary-v2-media', false)
on conflict (id) do nothing;

drop policy if exists "diary_v2_media_read_own" on storage.objects;
create policy "diary_v2_media_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'diary-v2-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "diary_v2_media_write_own" on storage.objects;
create policy "diary_v2_media_write_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'diary-v2-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "diary_v2_media_update_own" on storage.objects;
create policy "diary_v2_media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'diary-v2-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'diary-v2-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "diary_v2_media_delete_own" on storage.objects;
create policy "diary_v2_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'diary-v2-media' and (storage.foldername(name))[1] = auth.uid()::text);
