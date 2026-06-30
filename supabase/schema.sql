-- Run this in the Supabase SQL Editor to create the books table.

create extension if not exists "pgcrypto";

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  author text not null default '',
  cover_url text,
  start_date date,
  end_date date,
  currently_reading boolean not null default false,
  favorite boolean not null default false,
  tags text[] not null default '{}',
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  notes jsonb not null default '[]'::jsonb,
  memorable_line text,
  added_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_added_at_idx on public.books (added_at desc);
create index if not exists books_currently_reading_idx on public.books (currently_reading);

create or replace function public.set_books_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists books_set_updated_at on public.books;

create trigger books_set_updated_at
before update on public.books
for each row
execute function public.set_books_updated_at();

alter table public.books enable row level security;

create policy "Allow public read access on books"
on public.books
for select
to anon, authenticated
using (true);

create policy "Allow public insert access on books"
on public.books
for insert
to anon, authenticated
with check (true);

create policy "Allow public update access on books"
on public.books
for update
to anon, authenticated
using (true)
with check (true);

create policy "Allow public delete access on books"
on public.books
for delete
to anon, authenticated
using (true);

-- Enable realtime sync across devices
alter publication supabase_realtime add table public.books;

-- Book cover images (Storage bucket: book-covers, public)
insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do update set public = true;

create policy "Public read book covers"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'book-covers');

create policy "Public upload book covers"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'book-covers');

create policy "Public update book covers"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'book-covers')
with check (bucket_id = 'book-covers');

create policy "Public delete book covers"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'book-covers');

-- Migration: add memorable_line column to existing projects
alter table public.books add column if not exists memorable_line text;
