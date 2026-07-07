-- The project was provisioned with legacy blanket grants: anon/authenticated
-- held ALL privileges (including TRUNCATE, which RLS does NOT guard) on every
-- public table. Strip writes entirely; clients are read-only plus two narrow
-- column updates. All writes go through edge functions (service role).

-- strip write/utility privileges from client roles
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

-- anon needs nothing at all (the app requires sign-in)
revoke select on all tables in schema public from anon;
revoke usage on all sequences in schema public from anon, authenticated;

-- re-grant the two intentional narrow write paths
grant update (full_name, phone) on public.profiles to authenticated;
grant update (read) on public.notifications to authenticated;

-- future tables created by migrations must not inherit blanket grants
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke select on tables from anon;
alter default privileges in schema public revoke usage, select on sequences from anon, authenticated;
