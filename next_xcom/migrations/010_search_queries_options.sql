-- Optional structured query builder state for X Engager search_queries.
-- Run in Supabase SQL Editor after 008_reply_automation.sql.

alter table public.search_queries
  add column if not exists query_options jsonb;

comment on column public.search_queries.query_options is
  'Scout query builder state (QueryOptionsV1): allWords, exactPhrase, filters, recommendedHashtags, etc.';
