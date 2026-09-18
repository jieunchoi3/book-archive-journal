-- Multiple hashtag folder rows per diary entry
alter table planner.diary_entries
  add column if not exists tag_folders jsonb not null default '[]'::jsonb;
