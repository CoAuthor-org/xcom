-- Add queue column: which schedule slot (10am IST or 6pm IST). Null = not scheduled.
-- Run in Supabase SQL Editor after 003_entries_posted_at.sql.
-- Cron at 10am IST posts next entry with queue = '10am'; at 6pm IST posts next with queue = '6pm'.

alter table public.entries add column if not exists queue text;

comment on column public.entries.queue is 'Schedule slot: ''10am'' or ''6pm'' (IST). Null = not assigned to a queue.';

-- Constrain to allowed values (skip if already added)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entries_queue_check'
  ) then
    alter table public.entries add constraint entries_queue_check
      check (queue is null or queue in ('10am', '6pm'));
  end if;
end $$;
