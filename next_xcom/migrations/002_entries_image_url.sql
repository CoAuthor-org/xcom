-- Add image URL column for per-tweet uploaded images (Supabase Storage).
-- Run in Supabase SQL Editor after 001_entries_and_progress.sql.
--
-- Then create a Storage bucket: Dashboard → Storage → New bucket
--   Name: tweet-images
--   Public: Yes (so entry cards can display images via URL)

alter table public.entries add column if not exists image_url text;
