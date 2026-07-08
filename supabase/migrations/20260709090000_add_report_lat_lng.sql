-- supabase/migrations/20260709090000_add_report_lat_lng.sql
-- Milestone 6: real Leaflet maps. Both apps currently position pins using a
-- client-side area-name lookup (COORDS/GEO), so every report in the same
-- named area stacks at one point. These generated columns expose each
-- report's actual stored coordinates (always in sync with `location`, no new
-- write path) so the map can plot precise, distinct pins per report.
alter table public.reports
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;
