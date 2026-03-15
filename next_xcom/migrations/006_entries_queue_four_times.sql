-- Expand queue from 2 slots (10am, 6pm) to 4 slots (8am, 12pm, 4pm, 8pm) IST.
-- Run in Supabase SQL Editor after 004_entries_queue.sql (and 005 if you use threads).
-- Cron runs at 02:30, 06:30, 10:30, 14:30 UTC (= 8am, 12pm, 4pm, 8pm IST).

-- 1. Drop old check constraint first (so we can write new values)
alter table public.entries drop constraint if exists entries_queue_check;

-- 2. Migrate existing data: old queue values map to new slots
update public.entries set queue = '8am'  where queue = '10am';
update public.entries set queue = '8pm'  where queue = '6pm';

-- 3. Add new check constraint for 4 queues
alter table public.entries add constraint entries_queue_check
  check (queue is null or queue in ('8am', '12pm', '4pm', '8pm'));

comment on column public.entries.queue is 'Schedule slot (IST): ''8am'', ''12pm'', ''4pm'', ''8pm''. Null = not scheduled.';
