-- Rebuild diary rows when cover.jpg exists under user/{entry_id}/ but diary_entries row is missing.

create or replace function planner.repair_diary_orphan_entry_covers(p_user_id uuid)
returns table(repaired_date date, entry_id uuid, cover_path text)
language plpgsql
security definer
set search_path = planner, storage, public
as $$
begin
  return query
  with covers as (
    select
      split_part(o.name, '/', 2)::uuid as eid,
      o.name as cover_path,
      o.created_at
    from storage.objects o
    where o.bucket_id = 'diary-media'
      and o.name like p_user_id::text || '/%/cover.jpg'
      and split_part(o.name, '/', 2) ~ '^[0-9a-f]{8}-'
  ),
  missing as (
    select c.*
    from covers c
    left join planner.diary_entries e
      on e.user_id = p_user_id and e.entry_id = c.eid
    where e.entry_id is null
  ),
  layer_json as (
    select
      split_part(o.name, '/', 2) as eid,
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
      and split_part(o.name, '/', 2) ~ '^[0-9a-f]{8}-'
    group by 1
  ),
  inserted as (
    insert into planner.diary_entries (
      user_id, date_key, title, body, frame_color, canvas_strokes, layers,
      cover_path, body_images, main_tag, sub_tag, updated_at, id, entry_id
    )
    select
      p_user_id,
      (m.created_at at time zone 'Asia/Seoul')::date,
      ''::text,
      ''::text,
      '#F2F2F7',
      '[]'::jsonb,
      coalesce(l.layers, '[]'::jsonb),
      m.cover_path,
      '[]'::jsonb,
      null,
      null,
      m.created_at,
      gen_random_uuid(),
      m.eid
    from missing m
    left join layer_json l on l.eid = m.eid::text
    returning planner.diary_entries.date_key, planner.diary_entries.entry_id, planner.diary_entries.cover_path
  )
  select inserted.date_key, inserted.entry_id, inserted.cover_path from inserted;
end;
$$;

grant execute on function planner.repair_diary_orphan_entry_covers(uuid) to service_role;
