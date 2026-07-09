-- Staff directory: make the console's Users & Roles page real.
--
-- The console shows a 5-role org chart (Administrator | Supervisor | Officer |
-- Dispatcher | Viewer) plus a Unit label and an email column. None of that fit
-- the DB before: user_role is the 4-value ACCESS-CONTROL enum wired into RLS
-- (citizen | officer | crew | admin) and email lives in auth.users (not readable
-- by the client). This migration adds presentation columns WITHOUT touching the
-- access-control model:
--   * console_role -> the org-chart label (Administrator gates as admin, the
--     other four gate as officer; role stays the true permission boundary).
--   * unit         -> free-text org unit shown in the staff table.
--   * email        -> mirrored from auth.users so the client can list staff
--     emails via its existing `select` grant on profiles.

alter table public.profiles
  add column if not exists console_role text
    check (console_role is null or console_role in
      ('Administrator', 'Supervisor', 'Officer', 'Dispatcher', 'Viewer')),
  add column if not exists unit text,
  add column if not exists email text;

-- Keep the profile bootstrap trigger in sync: carry email + the invite metadata
-- (console_role / unit) set by the manage-users edge function through inviteUserByEmail.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email, console_role, unit)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    new.raw_user_meta_data ->> 'console_role',
    new.raw_user_meta_data ->> 'unit'
  );
  return new;
end $$;

-- Backfill email for every existing profile from auth.users.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- Backfill a console_role for existing staff so they show in the directory.
-- (Only real staff accounts are affected; citizens/crew stay null.)
update public.profiles
set console_role = case when role = 'admin' then 'Administrator' else 'Officer' end,
    unit = coalesce(unit, 'Operations')
where role in ('officer', 'admin')
  and console_role is null;
