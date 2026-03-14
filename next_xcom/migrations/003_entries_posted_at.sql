-- Add posted_at to entries for scheduler: null = not yet posted, set when posted to X.
-- Run in Supabase SQL Editor after 002_entries_image_url.sql.
-- Cron job posts the next entry where posted_at IS NULL (oldest first) and sets posted_at = now().

alter table public.entries add column if not exists posted_at timestamptz;

comment on column public.entries.posted_at is 'When this entry was posted to X (null = queued, not yet posted).';
