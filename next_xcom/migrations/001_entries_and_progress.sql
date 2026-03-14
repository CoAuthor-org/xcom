-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) to create tables for xcom.

-- Tweet/entry storage (replaces data.json)
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  created_at timestamptz not null default now(),
  topic_ref text,
  part int
);

-- Resume state for "From notes" (replaces progress.json): file_name → last chunk index
create table if not exists public.note_progress (
  file_name text primary key,
  last_chunk_index int not null default 0
);

-- Optional: enable RLS and allow service role full access (default with service_role key)
alter table public.entries enable row level security;
alter table public.note_progress enable row level security;

-- Policy: service role bypasses RLS. For anon key, uncomment below if you want public read/write.
-- create policy "Allow all for entries" on public.entries for all using (true) with check (true);
-- create policy "Allow all for note_progress" on public.note_progress for all using (true) with check (true);
