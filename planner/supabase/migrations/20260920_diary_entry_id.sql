-- Multiple diary notes per calendar day (entry_id is the stable row key).

alter table planner.diary_entries
  add column if not exists entry_id uuid;

update planner.diary_entries
set entry_id = gen_random_uuid()
where entry_id is null;

alter table planner.diary_entries
  alter column entry_id set default gen_random_uuid(),
  alter column entry_id set not null;

alter table planner.diary_entries
  drop constraint if exists diary_entries_pkey;

alter table planner.diary_entries
  add primary key (user_id, entry_id);

create index if not exists diary_entries_user_date_idx
  on planner.diary_entries (user_id, date_key);
