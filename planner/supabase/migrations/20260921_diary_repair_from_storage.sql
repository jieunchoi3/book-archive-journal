-- Rebuild missing planner.diary_entries rows from diary-media objects (legacy date_key folders).
-- Safe to run multiple times; only inserts days that have cover.jpg but no row.

create or replace function planner.repair_diary_entries_from_storage(p_user_id uuid)
returns table(repaired_date date, entry_id uuid)
language plpgsql
security definer
set search_path = planner, storage, public
as $$
begin
  return query
  with cover_days as (
    select split_part(o.name, '/', 2)::date as date_key,
           o.name as cover_path
    from storage.objects o
    where o.bucket_id = 'diary-media'
      and o.name like p_user_id::text || '/%/cover.jpg'
      and split_part(o.name, '/', 2) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  missing as (
    select c.date_key, c.cover_path
    from cover_days c
    left join planner.diary_entries e
      on e.user_id = p_user_id and e.date_key = c.date_key
    where e.entry_id is null
  ),
  layer_json as (
    select split_part(o.name, '/', 2)::date as date_key,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', regexp_replace(split_part(o.name, '/', 3), '^layer-(.+)\.jpg$', '\1'),
            'path', o.name,
            'x', 0,
            'y', 0,
            'scale', 1,
            'strokes', '[]'::jsonb
          )
          order by o.name
        ),
        '[]'::jsonb
      ) as layers
    from storage.objects o
    where o.bucket_id = 'diary-media'
      and o.name like p_user_id::text || '/%/layer-%'
      and split_part(o.name, '/', 2) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    group by 1
  ),
  inserted as (
    insert into planner.diary_entries (
      user_id, date_key, title, body, frame_color, canvas_strokes, layers,
      cover_path, body_images, main_tag, sub_tag, updated_at, id, entry_id
    )
    select
      p_user_id,
      m.date_key,
      ''::text,
      ''::text,
      '#F2F2F7',
      '[]'::jsonb,
      coalesce(l.layers, '[]'::jsonb),
      m.cover_path,
      '[]'::jsonb,
      null,
      null,
      now(),
      gen_random_uuid(),
      gen_random_uuid()
    from missing m
    left join layer_json l on l.date_key = m.date_key
    returning planner.diary_entries.date_key, planner.diary_entries.entry_id
  )
  select inserted.date_key, inserted.entry_id from inserted;
end;
$$;

comment on function planner.repair_diary_entries_from_storage(uuid) is
  'Emergency repair: recreate diary rows from Storage when DB rows were lost but images remain.';

grant execute on function planner.repair_diary_entries_from_storage(uuid) to service_role;
