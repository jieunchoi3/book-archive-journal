-- Handwritten note photos in diary "What happened" section
alter table planner.diary_entries
  add column if not exists body_images jsonb not null default '[]'::jsonb;
