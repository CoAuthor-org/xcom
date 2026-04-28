-- Alpha Extraction Engine CRM foundation
-- Create core CRM tables for companies, people, and repositories.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  github_org_url text,
  website_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  role text,
  github_handle text,
  social_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  url text not null,
  primary_language text,
  is_open_source boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists repositories_company_id_url_idx
  on public.repositories (company_id, url);

create index if not exists companies_name_idx
  on public.companies (name);

create index if not exists companies_category_idx
  on public.companies (category);

create index if not exists people_company_id_idx
  on public.people (company_id);

create index if not exists repositories_company_id_idx
  on public.repositories (company_id);

alter table public.companies enable row level security;
alter table public.people enable row level security;
alter table public.repositories enable row level security;

drop policy if exists companies_authenticated_full_access on public.companies;
create policy companies_authenticated_full_access
  on public.companies
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists people_authenticated_full_access on public.people;
create policy people_authenticated_full_access
  on public.people
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists repositories_authenticated_full_access on public.repositories;
create policy repositories_authenticated_full_access
  on public.repositories
  for all
  to authenticated
  using (true)
  with check (true);
