-- Demo population: realistic users and crew members for the live project.
--
-- Creates 35 confirmed auth accounts (22 citizens, 4 console staff, 9 field-crew
-- members across Crews Alpha/Beta/Gamma), relying on the private.handle_new_user
-- trigger to create each profile from metadata, then upgrading role/status/crew
-- and resyncing crews.member_count.
--
-- Two blocks: block 1 (below) creates the original 19 accounts at run-time now()
-- with password FixMyCity2026!. Block 2 (appended) adds 16 more citizens whose
-- join dates are back-dated randomly across the last 21 days, with password
-- `password`, so the citizen list looks organic for the demo.
--
-- Idempotent: accounts that already exist (by email) are skipped.
-- Emails use plus-addressing over four real inboxes so all mail is receivable.
--
-- Run against the linked project (SQL editor or MCP). This is NOT the local
-- `supabase/seed.sql` used by `supabase db reset`; it targets live demo data.

do $$
declare
  rec record;
  uid uuid;
  pw text := 'FixMyCity2026!';
  crew_alpha uuid; crew_beta uuid; crew_gamma uuid;
  created int := 0; skipped int := 0;
begin
  select id into crew_alpha from public.crews where name = 'Crew Alpha';
  select id into crew_beta  from public.crews where name = 'Crew Beta';
  select id into crew_gamma from public.crews where name = 'Crew Gamma';

  for rec in
    select * from (values
      -- citizens
      ('Kwame Boakye',      'trialweb4+1@gmail.com',      '024 552 1101', 'citizen', null,          null,         null,    'active'),
      ('Adwoa Mensimah',    'sammyborborbor+1@gmail.com', '020 314 7726', 'citizen', null,          null,         null,    'active'),
      ('Kojo Owusu',        'devsammy20+1@gmail.com',     '055 209 8834', 'citizen', null,          null,         null,    'active'),
      ('Abena Serwaa',      'trialweb4+2@gmail.com',      '027 660 2415', 'citizen', null,          null,         null,    'active'),
      ('Nana Yaa Amponsah', 'sammyborborbor+2@gmail.com', '026 481 9902', 'citizen', null,          null,         null,    'active'),
      ('Kwesi Appiah',      'devsammy20+2@gmail.com',     '054 773 5518', 'citizen', null,          null,         null,    'active'),
      -- console staff (spec names)
      ('Kofi Mensah',       'trialweb4+3@gmail.com',      '024 665 2210', 'officer', 'Supervisor',  'Sanitation',  null,   'active'),
      ('Ama Darko',         'sammyborborbor+3@gmail.com', '020 118 4437', 'officer', 'Officer',     'Drainage',    null,   'active'),
      ('Nii Lartey',        'devsammy20+3@gmail.com',     '055 902 6641', 'officer', 'Dispatcher',  'Control Room',null,   'active'),
      ('Efua Sarpong',      'trialweb4+4@gmail.com',      '026 337 8850', 'officer', 'Officer',     'Electrical',  null,   'suspended'),
      -- field crew members (leads first, matching crews.lead_name)
      ('Yaw Boateng',       'sammyborborbor+4@gmail.com', '024 118 0042', 'crew',    'Field Crew',  null,          'alpha', 'active'),
      ('Kofi Asamoah',      'devsammy20+4@gmail.com',     '024 006 7381', 'crew',    'Field Crew',  null,          'alpha', 'active'),
      ('Akosua Frimpong',   'trialweb4+5@gmail.com',      '055 441 2093', 'crew',    'Field Crew',  null,          'alpha', 'active'),
      ('Esi Addo',          'sammyborborbor+5@gmail.com', '020 776 5510', 'crew',    'Field Crew',  null,          'beta',  'active'),
      ('Kwabena Ofori',     'devsammy20+5@gmail.com',     '027 583 1147', 'crew',    'Field Crew',  null,          'beta',  'active'),
      ('Gifty Ansah',       'trialweb4+6@gmail.com',      '054 210 6678', 'crew',    'Field Crew',  null,          'beta',  'active'),
      ('Kojo Annan',        'sammyborborbor+6@gmail.com', '055 309 8821', 'crew',    'Field Crew',  null,          'gamma', 'active'),
      ('Ibrahim Fuseini',   'devsammy20+6@gmail.com',     '024 897 3302', 'crew',    'Field Crew',  null,          'gamma', 'active'),
      ('Selorm Agbeko',     'trialweb4+7@gmail.com',      '026 940 1156', 'crew',    'Field Crew',  null,          'gamma', 'active')
    ) as t(full_name, email, phone, urole, console_role, unit, crew_key, pstatus)
  loop
    if exists (select 1 from auth.users u where u.email = rec.email) then
      skipped := skipped + 1;
      continue;
    end if;

    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      rec.email, crypt(pw, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_strip_nulls(jsonb_build_object(
        'full_name', rec.full_name, 'phone', rec.phone,
        'console_role', rec.console_role, 'unit', rec.unit)),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', rec.email,
                         'email_verified', true, 'phone_verified', false),
      now(), now(), now()
    );

    -- trigger handle_new_user has created the profile; upgrade role/status/crew
    update public.profiles set
      role   = rec.urole::user_role,
      status = rec.pstatus::profile_status,
      crew_id = case rec.crew_key
                  when 'alpha' then crew_alpha
                  when 'beta'  then crew_beta
                  when 'gamma' then crew_gamma
                  else null end
    where id = uid;

    created := created + 1;
  end loop;

  -- resync member counts from reality
  update public.crews c
     set member_count = (select count(*) from public.profiles p where p.crew_id = c.id);

  raise notice 'created=% skipped=%', created, skipped;
end $$;

-- ---------------------------------------------------------------------------
-- Block 2 (appended 2026-07-24): 16 additional citizen accounts whose join
-- dates are back-dated randomly across the last 21 days, so the citizen list
-- looks organic for the demo. Password for THIS batch only: password
-- Block 1 above is untouched. Same idempotent guard (skips existing emails).
-- All rows are citizens (role citizen, status active) — no crew/console lookups.
-- ---------------------------------------------------------------------------
do $$
declare
  rec record;
  uid uuid;
  ts  timestamptz;
  pw text := 'password';
  created int := 0; skipped int := 0;
begin
  for rec in
    select * from (values
      ('Yaw Darko',      'trialweb4+8@gmail.com',       '024 771 3390'),
      ('Akua Boahen',    'trialweb4+9@gmail.com',       '020 559 4471'),
      ('Kwaku Ntim',     'trialweb4+10@gmail.com',      '055 830 1264'),
      ('Afia Owusu',     'trialweb4+11@gmail.com',      '027 412 6689'),
      ('Kojo Bediako',   'trialweb4+12@gmail.com',      '026 903 5512'),
      ('Adjoa Nyarko',   'sammyborborbor+7@gmail.com',  '024 118 7734'),
      ('Fiifi Quaye',    'sammyborborbor+8@gmail.com',  '020 664 2201'),
      ('Ama Konadu',     'sammyborborbor+9@gmail.com',  '054 337 9980'),
      ('Kwame Agyeman',  'sammyborborbor+10@gmail.com', '055 220 4417'),
      ('Esinam Doe',     'sammyborborbor+11@gmail.com', '027 781 3345'),
      ('Yaa Asantewaa',  'devsammy20+7@gmail.com',      '024 509 6628'),
      ('Kofi Sarpong',   'devsammy20+8@gmail.com',      '020 947 1150'),
      ('Abena Kyei',     'devsammy20+9@gmail.com',      '026 315 8823'),
      ('Nana Adjei',     'devsammy20+10@gmail.com',     '055 604 7792'),
      ('Efua Mensa',     'devsammy20+11@gmail.com',     '054 872 2036'),
      ('Samuel Owusu',   'sammyowusu+1@hotmail.com',    '024 660 0912')
    ) as t(full_name, email, phone)
  loop
    if exists (select 1 from auth.users u where u.email = rec.email) then
      skipped := skipped + 1;
      continue;
    end if;

    uid := gen_random_uuid();
    ts  := now() - (random() * interval '21 days');

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      rec.email, crypt(pw, gen_salt('bf')),
      ts, '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', rec.full_name, 'phone', rec.phone),
      ts, ts, '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', rec.email,
                         'email_verified', true, 'phone_verified', false),
      ts, ts, ts
    );

    -- trigger handle_new_user stamped the profile at now(); back-date it to ts
    update public.profiles set
      role       = 'citizen'::user_role,
      status     = 'active'::profile_status,
      created_at = ts
    where id = uid;

    created := created + 1;
  end loop;

  raise notice 'block2 created=% skipped=%', created, skipped;
end $$;
