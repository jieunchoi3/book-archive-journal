-- Goodtime v2: run-scoped journal entries
-- run_id → ld_snapshot (goodtime run), duration_min, zoom_note; drop bucket

alter table planner.ld_journal_entry
  add column if not exists run_id uuid references planner.ld_snapshot(id) on delete cascade,
  add column if not exists duration_min smallint default 60,
  add column if not exists zoom_note text;

-- Backfill duration for existing rows
update planner.ld_journal_entry
set duration_min = 60
where duration_min is null;

alter table planner.ld_journal_entry
  alter column duration_min set not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'planner'
      and table_name = 'ld_journal_entry'
      and column_name = 'bucket'
  ) then
    alter table planner.ld_journal_entry drop column bucket;
  end if;
end $$;

create index if not exists ld_journal_entry_run_date_idx
  on planner.ld_journal_entry (user_id, run_id, entry_date desc);
