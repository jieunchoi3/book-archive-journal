-- Taste polaroid images + month backgrounds (paths in taste_stores jsonb).
insert into storage.buckets (id, name, public)
values ('taste-media', 'taste-media', false)
on conflict (id) do nothing;

drop policy if exists "taste_media_read_own" on storage.objects;
create policy "taste_media_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'taste-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "taste_media_write_own" on storage.objects;
create policy "taste_media_write_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'taste-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "taste_media_update_own" on storage.objects;
create policy "taste_media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'taste-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'taste-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "taste_media_delete_own" on storage.objects;
create policy "taste_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'taste-media' and (storage.foldername(name))[1] = auth.uid()::text);
