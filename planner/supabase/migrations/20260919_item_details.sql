alter table planner.items
  add column if not exists details text not null default '';
