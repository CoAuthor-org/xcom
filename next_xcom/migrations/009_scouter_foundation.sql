-- Run in Supabase SQL Editor: Scouter isolated module schema.
-- Additive migration only; does not alter existing tables.

create extension if not exists vector;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'scouter_knowledge_source_type_enum'
      and n.nspname = 'public'
  ) then
    create type public.scouter_knowledge_source_type_enum as enum ('email', 'rss', 'youtube', 'twitter');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'scouter_draft_platform_enum'
      and n.nspname = 'public'
  ) then
    create type public.scouter_draft_platform_enum as enum ('twitter', 'linkedin', 'blog');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'scouter_draft_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.scouter_draft_status_enum as enum ('pending', 'approved', 'published', 'discarded');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'scouter_opportunity_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.scouter_opportunity_status_enum as enum ('new', 'contacted', 'ignored');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'scouter_os_repo_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.scouter_os_repo_status_enum as enum ('pending', 'cloned', 'active');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'scouter_queue_status_enum'
      and n.nspname = 'public'
  ) then
    create type public.scouter_queue_status_enum as enum ('queued', 'processing', 'done', 'error');
  end if;
end
$$;

create table if not exists public.scouter_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_raw text not null,
  summary text not null,
  source_type public.scouter_knowledge_source_type_enum not null,
  source_url text,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists public.scouter_content_drafts (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.scouter_knowledge(id) on delete cascade,
  platform public.scouter_draft_platform_enum not null,
  draft_text text not null,
  status public.scouter_draft_status_enum not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.scouter_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  domain text not null,
  description text not null,
  source text not null,
  match_score integer not null check (match_score >= 1 and match_score <= 10),
  outreach_draft text not null,
  status public.scouter_opportunity_status_enum not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.scouter_os_repos (
  id uuid primary key default gen_random_uuid(),
  repo_name text not null,
  url text not null,
  language text not null,
  issue_title text not null,
  community_link text,
  status public.scouter_os_repo_status_enum not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.scouter_youtube_queue (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  status public.scouter_queue_status_enum not null default 'queued',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scouter_knowledge_created_at_idx
  on public.scouter_knowledge (created_at desc);
create index if not exists scouter_knowledge_source_type_idx
  on public.scouter_knowledge (source_type);
create index if not exists scouter_knowledge_source_url_idx
  on public.scouter_knowledge (source_url);

create index if not exists scouter_content_drafts_knowledge_id_idx
  on public.scouter_content_drafts (knowledge_id);
create index if not exists scouter_content_drafts_status_idx
  on public.scouter_content_drafts (status);
create index if not exists scouter_content_drafts_created_at_idx
  on public.scouter_content_drafts (created_at desc);

create index if not exists scouter_opportunities_status_idx
  on public.scouter_opportunities (status);
create index if not exists scouter_opportunities_score_idx
  on public.scouter_opportunities (match_score desc);
create index if not exists scouter_opportunities_created_at_idx
  on public.scouter_opportunities (created_at desc);
create index if not exists scouter_opportunities_domain_idx
  on public.scouter_opportunities (domain);

create index if not exists scouter_os_repos_status_idx
  on public.scouter_os_repos (status);
create index if not exists scouter_os_repos_language_idx
  on public.scouter_os_repos (language);
create index if not exists scouter_os_repos_created_at_idx
  on public.scouter_os_repos (created_at desc);

create index if not exists scouter_youtube_queue_status_idx
  on public.scouter_youtube_queue (status);
create index if not exists scouter_youtube_queue_created_at_idx
  on public.scouter_youtube_queue (created_at asc);

create index if not exists scouter_knowledge_embedding_ivfflat_idx
  on public.scouter_knowledge
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.scouter_match_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.22,
  match_count int default 8
)
returns table (
  id uuid,
  title text,
  summary text,
  source_url text,
  similarity float
)
language sql
stable
as $$
  select
    k.id,
    k.title,
    k.summary,
    k.source_url,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.scouter_knowledge k
  where k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) >= match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.scouter_knowledge enable row level security;
alter table public.scouter_content_drafts enable row level security;
alter table public.scouter_opportunities enable row level security;
alter table public.scouter_os_repos enable row level security;
alter table public.scouter_youtube_queue enable row level security;

-- Service role bypasses RLS; anon policies intentionally omitted.
