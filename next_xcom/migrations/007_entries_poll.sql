-- Add poll support to entries. Poll tweets have question in text and options + duration here.
-- X API: 2-4 options, each option max 25 characters; duration_minutes (e.g. 60, 360, 1440, 10080).

alter table public.entries
  add column if not exists poll_options text[],
  add column if not exists poll_duration_minutes int;

comment on column public.entries.poll_options is 'For poll tweets: array of 2-4 option strings, each max 25 chars. Null = regular tweet.';
comment on column public.entries.poll_duration_minutes is 'For poll tweets: duration in minutes (e.g. 60, 360, 1440, 10080). Null = regular tweet.';
