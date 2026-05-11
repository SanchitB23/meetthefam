-- meetthefam local-dev seed: "Smith Family Demo"
--
-- Loaded by `supabase db reset`. Per Supabase convention `supabase/seed.sql` is
-- local-only -- it is NOT applied to remote (QA / prod) projects. See ADR 0008
-- ("Seed data") for why production starts empty.
--
-- Source shape: docs/ux/inspiration/kintree/project/data.jsx -- the sanitized
-- Smith / Anderson 4-generation family. Names, places, bios, tones, and
-- parent / spouse relations are copied verbatim from that file. The `role`
-- field there ("Paternal Grandfather" etc.) is dropped -- the people table
-- has no `role` column; the FK relationships imply the role.
--
-- Demo auth user (for the maintainer to log in as if they want a guided
-- screenshot pass later):
--   email:    demo@smith.family
--   id (uuid): 00000000-0000-0000-0000-000000000001
--   email_confirmed_at is set so the user can sign in via magic link without
--   a confirmation round-trip; in prod we never run this seed.

-- ----------------------------------------------------------------------------
-- 1. Demo auth user
-- ----------------------------------------------------------------------------
-- Inserting directly into auth.users is simpler than calling
-- auth.admin.create_user() from SQL and works for local-only seeds.
-- Per current GoTrue / Supabase Auth schema (2026-Q2), the columns below are
-- the minimum to produce a usable user. raw_app_meta_data identifies the
-- provider; raw_user_meta_data is what the profile-on-signup trigger reads.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'demo@smith.family',
  crypt('demo-password-not-for-prod', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Demo Smith"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

-- An auth.identities row is required for password / magic-link sign-in flows.
-- provider_id matches the user id (email provider convention).
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000001',
    'email', 'demo@smith.family',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  '00000000-0000-0000-0000-000000000001',
  now(),
  now(),
  now()
)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 2. Tree + owner membership
-- ----------------------------------------------------------------------------
insert into public.trees (id, name, description, owner_id)
values (
  '11111111-1111-1111-1111-111111111111',
  'Smith Family Demo',
  'A sanitized 4-generation demo family (Smith / Anderson) shipped with meetthefam for local development, onboarding screenshots, and visual regression tests.',
  '00000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into public.tree_members (tree_id, user_id, role, invited_by)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'owner',
  '00000000-0000-0000-0000-000000000001'
)
on conflict (tree_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. People -- 13 rows across 4 generations
-- ----------------------------------------------------------------------------
-- Insertion order respects self-FK dependencies:
--   Gen 1 (no parents): George, Margaret, Henry, Eleanor
--   Gen 2 (parents in Gen 1): Robert, Catherine, Susan, Andrew
--   Gen 3 (parents in Gen 2, or none for in-laws): Daniel, Adam, Penny, Nora
--   Gen 4 (parents in Gen 3): Theo
-- Spouse FKs are set in a follow-up UPDATE pass (bidirectional symmetry is
-- enforced in app code per data-model.md; here we just write both columns).

-- ---- Gen 1: Paternal grandparents (Smith) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '22222222-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'George Smith', 'George', 'm', 1938, 2011, true,
    'Boston, MA',
    'Opened the family hardware store on Main Street in 1962. Loved gardening and reading aloud.',
    'sage',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Margaret Smith', 'Margaret', 'f', 1942, null, false,
    'Hartford, CT',
    'Gentle storyteller, keeper of every recipe in the family. Lives with us in Boston.',
    'rose',
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 1: Maternal grandparents (Anderson) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '22222222-0000-0000-0000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Henry Anderson', 'Henry', 'm', 1940, 2019, true,
    'Springfield, MA',
    'Civil engineer. Built bridges across New England. Quietly proud of every one.',
    'indigo',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'Eleanor Anderson', 'Eleanor', 'f', 1944, null, false,
    'Providence, RI',
    'Schoolteacher for 38 years. Still corrects everyone''s grammar.',
    'amber',
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 2: Parents + siblings ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'Robert Smith', 'Robert', 'm', 1968, null, false,
    'Boston',
    'Took over the shop in 1995. Baseball fanatic, terrible singer.',
    'sage',
    '22222222-0000-0000-0000-000000000001',  -- George
    '22222222-0000-0000-0000-000000000002',  -- Margaret
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000006',
    '11111111-1111-1111-1111-111111111111',
    'Catherine Smith', 'Aunt Cathy', 'f', 1972, null, false,
    'Boston',
    'Lives in Seattle. Architect. Visits every Christmas.',
    'amber',
    '22222222-0000-0000-0000-000000000001',  -- George
    '22222222-0000-0000-0000-000000000002',  -- Margaret
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000007',
    '11111111-1111-1111-1111-111111111111',
    'Susan Smith', 'Susan', 'f', 1970, null, false,
    'Boston',
    'Pediatrician. Holds the family together with weekly Sunday dinners.',
    'rose',
    '22222222-0000-0000-0000-000000000003',  -- Henry
    '22222222-0000-0000-0000-000000000004',  -- Eleanor
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000008',
    '11111111-1111-1111-1111-111111111111',
    'Andrew Anderson', 'Uncle Drew', 'm', 1974, null, false,
    'Springfield',
    'Runs an organic farm outside Burlington.',
    'indigo',
    '22222222-0000-0000-0000-000000000003',  -- Henry
    '22222222-0000-0000-0000-000000000004',  -- Eleanor
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 3: User + siblings + in-law spouse ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000009',
    '11111111-1111-1111-1111-111111111111',
    'Daniel Smith', 'You', 'm', 1994, null, false,
    'Boston',
    'Started this tree on a quiet Sunday afternoon.',
    'green',
    '22222222-0000-0000-0000-000000000005',  -- Robert
    '22222222-0000-0000-0000-000000000007',  -- Susan
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000000a',
    '11111111-1111-1111-1111-111111111111',
    'Adam Smith', 'Adam', 'm', 1997, null, false,
    'Boston',
    'Younger brother. Lives in Chicago, works in finance.',
    'sage',
    '22222222-0000-0000-0000-000000000005',  -- Robert
    '22222222-0000-0000-0000-000000000007',  -- Susan
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000000b',
    '11111111-1111-1111-1111-111111111111',
    'Penny Smith', 'Penny', 'f', 2000, null, false,
    'Boston',
    'Youngest. Studying law in Edinburgh.',
    'amber',
    '22222222-0000-0000-0000-000000000005',  -- Robert
    '22222222-0000-0000-0000-000000000007',  -- Susan
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000000c',
    '11111111-1111-1111-1111-111111111111',
    'Nora Smith', 'Nora', 'f', 1995, null, false,
    'Burlington, VT',
    'Product designer. Married Daniel in 2021 in a quiet Vermont ceremony.',
    'rose',
    null, null,  -- in-law: parents not in this tree
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 4 ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-00000000000d',
    '11111111-1111-1111-1111-111111111111',
    'Theodore Smith', 'Theo', 'm', 2023, null, false,
    'Boston',
    'The newest branch on the tree.',
    'rose',
    '22222222-0000-0000-0000-000000000009',  -- Daniel
    '22222222-0000-0000-0000-00000000000c',  -- Nora
    '00000000-0000-0000-0000-000000000001'
  );

-- ----------------------------------------------------------------------------
-- 4. Spouse FKs -- written symmetrically (both sides)
-- ----------------------------------------------------------------------------
-- George <-> Margaret
update public.people set spouse_id = '22222222-0000-0000-0000-000000000002' where id = '22222222-0000-0000-0000-000000000001';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000001' where id = '22222222-0000-0000-0000-000000000002';

-- Henry <-> Eleanor
update public.people set spouse_id = '22222222-0000-0000-0000-000000000004' where id = '22222222-0000-0000-0000-000000000003';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000003' where id = '22222222-0000-0000-0000-000000000004';

-- Robert <-> Susan
update public.people set spouse_id = '22222222-0000-0000-0000-000000000007' where id = '22222222-0000-0000-0000-000000000005';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000005' where id = '22222222-0000-0000-0000-000000000007';

-- Daniel <-> Nora
update public.people set spouse_id = '22222222-0000-0000-0000-00000000000c' where id = '22222222-0000-0000-0000-000000000009';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000009' where id = '22222222-0000-0000-0000-00000000000c';
