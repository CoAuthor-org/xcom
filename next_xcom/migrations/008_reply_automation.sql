-- Run in Supabase SQL Editor: search queries + pending replies for X Engager (reply automation).

-- Saved X Advanced Search query strings
create table if not exists public.search_queries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  query_string text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists search_queries_created_at_idx on public.search_queries (created_at desc);
create index if not exists search_queries_is_active_idx on public.search_queries (is_active) where is_active = true;

-- Grok-generated replies awaiting human copy/paste on X
create table if not exists public.pending_replies (
  id uuid primary key default gen_random_uuid(),
  tweet_id text not null unique,
  original_text text not null,
  author_username text not null,
  post_url text not null,
  generated_reply text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists pending_replies_created_at_idx on public.pending_replies (created_at desc);
create index if not exists pending_replies_status_idx on public.pending_replies (status);
create index if not exists pending_replies_tweet_id_idx on public.pending_replies (tweet_id);

-- Single row: last successful discover run (for UI "last run")
create table if not exists public.reply_automation_meta (
  singleton smallint primary key default 1 check (singleton = 1),
  last_discover_at timestamptz,
  last_discover_error text
);

insert into public.reply_automation_meta (singleton) values (1)
  on conflict (singleton) do nothing;

alter table public.search_queries enable row level security;
alter table public.pending_replies enable row level security;
alter table public.reply_automation_meta enable row level security;

-- Service role bypasses RLS; anon policies omitted (app uses service role server-side only).
