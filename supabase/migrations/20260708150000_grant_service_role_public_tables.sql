-- Fix: service_role (the role every edge function's `admin` client uses) had
-- only TRUNCATE/REFERENCES/TRIGGER on public-schema tables, not SELECT/
-- INSERT/UPDATE/DELETE. Hosted Supabase provisions service_role with full
-- access to public-schema tables at the platform level outside of user
-- migrations; a fresh local `supabase start` does not replicate that step, so
-- every edge function (submit-report, transition-report, and now
-- classify-image/check-duplicates) fails locally with "permission denied for
-- table reports" despite bypassing RLS. Grant explicitly so local dev matches
-- the access hosted already has (a harmless no-op there if already granted).
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
