-- Inbound mentions + human-in-the-loop reply queue for X Engager (user mention timeline).

create table if not exists public.incoming_mentions (
  id text primary key,
  author_id text not null,
  author_username text not null default '',
  text text not null,
  conversation_id text,
  in_reply_to_tweet_id text,
  in_reply_to_user_id text,
  referenced_tweets jsonb,
  created_at timestamptz,
  processed boolean not null default false,
  inserted_at timestamptz not null default now()
);

create index if not exists incoming_mentions_created_at_idx
  on public.incoming_mentions (created_at desc);
create index if not exists incoming_mentions_processed_idx
  on public.incoming_mentions (processed);
create index if not exists incoming_mentions_in_reply_to_idx
  on public.incoming_mentions (in_reply_to_tweet_id);

create table if not exists public.inbound_reply_queue (
  id uuid primary key default gen_random_uuid(),
  mention_id text not null references public.incoming_mentions (id) on delete cascade,
  original_context jsonb not null default '{}',
  grok_suggestion text not null,
  edited_reply text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'posted', 'rejected', 'manual')),
  posted_tweet_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mention_id)
);

create index if not exists inbound_reply_queue_created_at_idx
  on public.inbound_reply_queue (created_at desc);
create index if not exists inbound_reply_queue_status_idx
  on public.inbound_reply_queue (status);

alter table public.reply_automation_meta add column if not exists last_mentions_since_id text;
alter table public.reply_automation_meta add column if not exists last_mentions_poll_at timestamptz;
alter table public.reply_automation_meta add column if not exists last_mentions_poll_error text;
alter table public.reply_automation_meta add column if not exists cached_x_user_id text;

alter table public.incoming_mentions enable row level security;
alter table public.inbound_reply_queue enable row level security;
