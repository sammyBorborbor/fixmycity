-- Security gate for follow-report (fixes an IDOR in the follow-a-duplicate flow).
--
-- Following a report grants read access to its FULL contents via the
-- "reports: follower reads followed" policy. Without a gate, any authenticated
-- citizen could POST an arbitrary report_id to follow-report and read another
-- citizen's photos/description/precise location — defeating the reporter-owns-own
-- RLS baseline. A citizen may only follow a report that submit-report actually
-- OFFERED them as a duplicate candidate; this table records those offers.

create table public.duplicate_offers (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  report_id  uuid not null references public.reports (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, report_id)
);

-- Server-only state: written by submit-report, checked by follow-report (both
-- service role). RLS on with NO policies => authenticated clients cannot read or
-- write it at all (they never need to; the offer is surfaced in submit-report's
-- response, not queried directly).
alter table public.duplicate_offers enable row level security;

grant select, insert, update, delete on public.duplicate_offers to service_role;
