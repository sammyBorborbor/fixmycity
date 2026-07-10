-- Per-user console preferences (notification toggles, compact inbox, default
-- filter) persisted on the profile. Owner-writable: the "profiles: update own"
-- RLS policy already scopes rows; this grant scopes the column, matching the
-- existing narrow update(full_name, phone) grant.
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;

grant update (settings) on public.profiles to authenticated;
