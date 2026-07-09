-- Allow "Field Crew" as a console_role so field-crew members show in the
-- Users & Roles directory. console_role stays the org-chart label; the access
-- boundary is still user_role ('Field Crew' maps to role='crew' in manage-users).
alter table public.profiles drop constraint if exists profiles_console_role_check;
alter table public.profiles add constraint profiles_console_role_check
  check (console_role is null or console_role in
    ('Administrator', 'Supervisor', 'Officer', 'Dispatcher', 'Viewer', 'Field Crew'));
