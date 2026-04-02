-- Blog Poster: GitHub OAuth token persistence, tracked repos, commit → tweet drafts.
-- Run in Supabase SQL Editor (same pattern as other migrations).

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'blog_commit_draft_status_enum' and n.nspname = 'public'
  ) then
    create type public.blog_commit_draft_status_enum as enum (
      'pending',
      'approved',
      'rejected',
      'published'
    );
  end if;
end $$;

create table if not exists public.blog_github_connections (
  github_user_id bigint primary key,
  github_login text not null unique,
  access_token text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_github_tracked_repos (
  id uuid primary key default gen_random_uuid(),
  github_user_id bigint not null references public.blog_github_connections (github_user_id) on delete cascade,
  full_name text not null,
  branch_filter text,
  created_at timestamptz not null default now(),
  unique (github_user_id, full_name)
);

create index if not exists blog_github_tracked_repos_full_name_idx
  on public.blog_github_tracked_repos (full_name);

create table if not exists public.blog_commit_drafts (
  id uuid primary key default gen_random_uuid(),
  github_user_id bigint not null references public.blog_github_connections (github_user_id) on delete cascade,
  repo_full_name text not null,
  commit_sha text not null,
  commit_message text,
  diff_excerpt text,
  generated_text text not null,
  status public.blog_commit_draft_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  unique (github_user_id, repo_full_name, commit_sha)
);

create index if not exists blog_commit_drafts_github_user_id_idx
  on public.blog_commit_drafts (github_user_id);
create index if not exists blog_commit_drafts_status_idx
  on public.blog_commit_drafts (status);
create index if not exists blog_commit_drafts_created_at_idx
  on public.blog_commit_drafts (created_at desc);

alter table public.blog_github_connections enable row level security;
alter table public.blog_github_tracked_repos enable row level security;
alter table public.blog_commit_drafts enable row level security;
