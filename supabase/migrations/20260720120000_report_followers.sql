-- Follow-a-duplicate: when the CV service flags a citizen's submission as a
-- duplicate of an existing report, the citizen may FOLLOW that report instead of
-- filing a redundant one. A report can have many followers (many-to-many), and
-- every follower receives the same status notifications the reporter does
-- (fan-out lives in the transition-report edge function).
--
-- Privacy (Act 843, minimal PII): a follower may read the FULL followed report
-- (photos/description/category/location/status/timeline) but NOT the owner's
-- identity -- profiles is read-own/staff-only, so reporter_id (a uuid) and the
-- timeline's actor_id never resolve to a name for a follower. The owner and staff
-- see only an aggregate follower_count, never WHO is following.

-- ---- Join table ------------------------------------------------------------
create table public.report_followers (
  report_id  uuid not null references public.reports (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

-- fan-out in transition-report is "followers of report X"; the citizen store's
-- RLS-scoped read is "reports I follow".
create index report_followers_report_idx on public.report_followers (report_id);
create index report_followers_user_idx   on public.report_followers (user_id);

-- ---- Denormalised follower counter on reports ------------------------------
-- A cheap aggregate so "N people following" can be shown without exposing WHO.
alter table public.reports
  add column follower_count int not null default 0;

-- security definer so the trigger can bump the counter regardless of who caused
-- the follow/unfollow (writes always come via the service-role edge functions,
-- but keep it self-contained). It only ever touches the counter column.
create or replace function private.bump_follower_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.reports set follower_count = follower_count + 1
      where id = new.report_id;
  elsif tg_op = 'DELETE' then
    update public.reports set follower_count = greatest(follower_count - 1, 0)
      where id = old.report_id;
  end if;
  return null;
end $$;

create trigger report_followers_count
  after insert or delete on public.report_followers
  for each row execute function private.bump_follower_count();

-- ---- Row Level Security ----------------------------------------------------
alter table public.report_followers enable row level security;

-- A follower reads ONLY their own follow rows: they learn whether THEY follow a
-- report, never who else does. No policy for owners/staff, so follower identities
-- are never exposed -- only the aggregate follower_count on reports.
create policy "report_followers: read own" on public.report_followers
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No INSERT/UPDATE/DELETE policies: follows are written only by the
-- follow-report / unfollow-report edge functions (service role), matching the
-- writes-via-edge-functions convention.

-- A follower may read the full followed report. The existing
-- "transitions: read via report" policy re-applies the reports SELECT policies,
-- so this automatically exposes the followed report's timeline to followers too.
create policy "reports: follower reads followed" on public.reports
  for select to authenticated
  using (exists (
    select 1 from public.report_followers f
    where f.report_id = id and f.user_id = (select auth.uid())
  ));

-- ---- Grants ----------------------------------------------------------------
-- Read-only for authenticated (see own follow rows). service_role already has
-- full DML via the default privileges set in 20260708150000; grant explicitly
-- so a fresh local `supabase start` matches hosted.
grant select on public.report_followers to authenticated;
grant select, insert, update, delete on public.report_followers to service_role;
