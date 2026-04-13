-- Versioned digests: one row per run, grouped by calendar day + part number.
-- Run in Supabase after newsletter_digests exists.

alter table public.newsletter_digests
  add column if not exists digest_date date;

alter table public.newsletter_digests
  add column if not exists part_number int;

-- Backfill from created_at (UTC calendar date); assign part order by created_at per day.
update public.newsletter_digests d
set digest_date = (d.created_at at time zone 'UTC')::date
where digest_date is null;

update public.newsletter_digests d
set part_number = s.pn
from (
  select id, row_number() over (partition by digest_date order by created_at) as pn
  from public.newsletter_digests
) s
where d.id = s.id and (d.part_number is null or d.part_number < 1);

update public.newsletter_digests set part_number = 1 where part_number is null;

alter table public.newsletter_digests alter column digest_date set not null;
alter table public.newsletter_digests alter column part_number set not null;

create unique index if not exists newsletter_digests_date_part_uidx
  on public.newsletter_digests (digest_date, part_number);

create index if not exists newsletter_digests_digest_date_idx
  on public.newsletter_digests (digest_date desc, part_number desc);
