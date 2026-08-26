-- Add source + keep seed upserts idempotent for tables created before source existed.
alter table planner.snap_bookings
  add column if not exists source text;

update planner.snap_bookings
set source = 'manual'
where source is null;

alter table planner.snap_bookings
  alter column source set default 'manual';

do $$
begin
  alter table planner.snap_bookings
    alter column source set not null;
exception
  when others then null;
end $$;

do $$
begin
  alter table planner.snap_bookings
    drop constraint if exists snap_bookings_source_check;
  alter table planner.snap_bookings
    add constraint snap_bookings_source_check
    check (source in ('manual', 'notion_import'));
exception
  when others then null;
end $$;

create unique index if not exists snap_bookings_user_id_uidx
  on planner.snap_bookings (user_id, id);
