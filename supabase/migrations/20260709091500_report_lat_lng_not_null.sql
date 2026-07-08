-- Follow-up to 20260709090000_add_report_lat_lng.sql: Postgres does not
-- automatically mark a generated column NOT NULL even when its source
-- expression can never be null. `location` is NOT NULL and ST_X/ST_Y are
-- total functions on a valid point, so lat/lng can never actually be null —
-- but without this, the catalog (and therefore Supabase's generated
-- TypeScript types) reports them as nullable, which the app's types
-- disagree with.
alter table public.reports
  alter column lat set not null,
  alter column lng set not null;
