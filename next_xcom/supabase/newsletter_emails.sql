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
  summary_status text not null default 'pending'
    check (summary_status in ('pending', 'ok', 'error')),
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
