-- Add thread support: group multiple posts into a single X thread.
-- Run in Supabase SQL Editor after 004_entries_queue.sql.

alter table public.entries add column if not exists thread_id uuid;
alter table public.entries add column if not exists thread_index int;

comment on column public.entries.thread_id is 'Groups posts into one thread. Null = standalone post.';
comment on column public.entries.thread_index is 'Order within thread (1, 2, 3...). Used when thread_id is set.';

create index if not exists idx_entries_thread_id on public.entries(thread_id);
