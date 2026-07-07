-- FixMyCity initial schema
-- Tables, enums, RLS, reference generator, signup trigger, storage bucket.
-- Status changes are made ONLY by edge functions (service role); clients get
-- read access via RLS plus narrow column-level updates (profile contact info,
-- notification read flag).

-- ---- Extensions ---------------------------------------------------------
create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;

-- ---- Enums --------------------------------------------------------------
create type public.user_role as enum ('citizen', 'officer', 'crew', 'admin');
create type public.profile_status as enum ('active', 'suspended');
create type public.report_category as enum ('dumping', 'drain', 'streetlight');
create type public.report_status as enum
  ('submitted', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'rejected', 'reopened');
create type public.crew_department as enum ('sanitation', 'drainage', 'electrical');

-- ---- Private schema (helpers not exposed via the Data API) ---------------
create schema if not exists private;

-- ---- Crews ----------------------------------------------------------------
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department public.crew_department not null,
  lead_name text not null default '',
  phone text not null default '',
  member_count int not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---- Profiles (extends auth.users) ---------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.user_role not null default 'citizen',
  crew_id uuid references public.crews (id) on delete set null,
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now()
);

-- ---- Reports --------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default '',
  category public.report_category not null,
  description text not null default '',
  photo_urls text[] not null default '{}',
  location extensions.geography(point, 4326) not null,
  location_name text not null,
  status public.report_status not null default 'submitted',
  reporter_id uuid not null references public.profiles (id) on delete restrict,
  assigned_crew_id uuid references public.crews (id) on delete set null,
  ai_suggested_category public.report_category,
  ai_confidence real,
  embedding extensions.vector(512),
  created_at timestamptz not null default now()
);

create index reports_location_gix on public.reports using gist (location);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_status_idx on public.reports (status);
create index reports_created_idx on public.reports (created_at desc);
create index reports_crew_idx on public.reports (assigned_crew_id);

-- Reference generator: FMC-YYYY-NNNN. Seed data uses references below 0500,
-- so live numbering starts at 500.
create sequence public.report_reference_seq start 500;

create or replace function private.set_report_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'FMC-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.report_reference_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger set_report_reference
  before insert on public.reports
  for each row execute function private.set_report_reference();

-- ---- Status transitions (append-only audit log) ---------------------------
create table public.status_transitions (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  from_status public.report_status,
  to_status public.report_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.user_role,
  note text,
  created_at timestamptz not null default now()
);

create index transitions_report_idx on public.status_transitions (report_id, created_at);

-- Append-only even for the service role: block UPDATE/DELETE at trigger level.
create or replace function private.block_transition_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'status_transitions is append-only';
end $$;

create trigger transitions_append_only
  before update or delete on public.status_transitions
  for each row execute function private.block_transition_mutation();

-- ---- Notifications ---------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid references public.reports (id) on delete cascade,
  type text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---- Role helpers (security definer; avoids RLS recursion on profiles) -----
-- They only ever read the CALLING user's row, so they leak nothing.
create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
set search_path = ''
stable
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.current_user_crew()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select crew_id from public.profiles where id = (select auth.uid());
$$;

-- ---- Profile bootstrap on signup -------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---- Row Level Security -----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.crews enable row level security;
alter table public.reports enable row level security;
alter table public.status_transitions enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: staff read all" on public.profiles
  for select to authenticated
  using (private.current_user_role() in ('officer', 'admin'));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- crews: any signed-in user may read (citizens see their assigned crew's name)
create policy "crews: read" on public.crews
  for select to authenticated
  using (true);

-- reports
create policy "reports: reporter reads own" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy "reports: staff read all" on public.reports
  for select to authenticated
  using (private.current_user_role() in ('officer', 'admin'));

create policy "reports: crew reads assigned" on public.reports
  for select to authenticated
  using (
    private.current_user_role() = 'crew'
    and assigned_crew_id = private.current_user_crew()
  );

-- status_transitions: visible whenever the parent report is visible
-- (the subquery re-applies the reports policies for the querying user)
create policy "transitions: read via report" on public.status_transitions
  for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));

-- notifications
create policy "notifications: read own" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: mark own read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---- Grants ------------------------------------------------------------------
-- New projects do not auto-expose tables to the Data API (2026-04 change),
-- so grants are explicit. No anon grants: the app requires sign-in. No INSERT
-- grants: all writes go through edge functions (service role). Updates are
-- column-scoped: profile contact info and the notification read flag only.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select on public.crews to authenticated;
grant select on public.reports to authenticated;
grant select on public.status_transitions to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

-- ---- Storage: private bucket for report photos --------------------------------
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

-- Citizens upload into their own folder: report-photos/<uid>/...
create policy "photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos: read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos: staff read all" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-photos'
    and private.current_user_role() in ('officer', 'admin')
  );
