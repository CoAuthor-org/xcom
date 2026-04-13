-- Run in Supabase SQL Editor (or via migration tooling).
-- Table for Zapier-ingested newsletter emails + LLM summaries.

create table if not exists public.newsletter_emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  received_at timestamptz,
  external_id text,
  subject text not null default '',
  from_address text not null default '',
  raw_text text not null default '',
  raw_html text,
  link_primary text,
  links jsonb,
  tldr text,
  summary_markdown text,
  summary_status text not null default 'collected'
    check (summary_status in ('pending', 'ok', 'error', 'collected')),
  summary_error text,
  starred boolean not null default false,
  unnecessary boolean not null default false
);

create unique index if not exists newsletter_emails_external_id_key
  on public.newsletter_emails (external_id)
  where external_id is not null and length(trim(external_id)) > 0;

create index if not exists newsletter_emails_created_at_idx
  on public.newsletter_emails (created_at desc);

create index if not exists newsletter_emails_list_filter_idx
  on public.newsletter_emails (unnecessary, starred, created_at desc);

comment on table public.newsletter_emails is 'Newsletter ingest from Zapier webhook; optional RLS if exposing anon access.';

create table if not exists public.newsletter_digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  digest_date date not null,
  part_number int not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  tldr text not null,
  summary_markdown text not null,
  email_count int not null default 0,
  unique (digest_date, part_number)
);

create index if not exists newsletter_digests_created_at_idx
  on public.newsletter_digests (created_at desc);

create index if not exists newsletter_digests_digest_date_idx
  on public.newsletter_digests (digest_date desc, part_number desc);

alter table public.newsletter_emails
  add column if not exists batch_digest_id uuid references public.newsletter_digests (id);

create index if not exists newsletter_emails_batch_digest_idx
  on public.newsletter_emails (batch_digest_id);

create index if not exists newsletter_emails_pending_digest_idx
  on public.newsletter_emails (created_at desc)
  where batch_digest_id is null;

comment on table public.newsletter_digests is 'Batch LLM digest over emails in a time window.';

-- Server-side purge: unstarred rows whose effective date is before cutoff.
create or replace function public.delete_old_newsletter_emails(cutoff timestamptz)
returns bigint
language sql
as $$
  with d as (
    delete from public.newsletter_emails n
    where n.starred = false
      and coalesce(n.received_at, n.created_at) < cutoff
    returning n.id
  )
  select count(*) from d;
$$;
