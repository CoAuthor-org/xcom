-- Run after newsletter_emails.sql. Batch digest summaries (rolling 24h window).

create table if not exists public.newsletter_digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  tldr text not null,
  summary_markdown text not null,
  email_count int not null default 0
);

create index if not exists newsletter_digests_created_at_idx
  on public.newsletter_digests (created_at desc);

alter table public.newsletter_emails
  add column if not exists batch_digest_id uuid references public.newsletter_digests (id);

create index if not exists newsletter_emails_batch_digest_idx
  on public.newsletter_emails (batch_digest_id);

create index if not exists newsletter_emails_pending_digest_idx
  on public.newsletter_emails (created_at desc)
  where batch_digest_id is null;

-- Allow per-email rows to stay "collected" until a batch digest includes them.
alter table public.newsletter_emails drop constraint if exists newsletter_emails_summary_status_check;
alter table public.newsletter_emails add constraint newsletter_emails_summary_status_check
  check (summary_status in ('pending', 'ok', 'error', 'collected'));

comment on table public.newsletter_digests is 'One LLM summary per run over newsletter emails from a time window.';
