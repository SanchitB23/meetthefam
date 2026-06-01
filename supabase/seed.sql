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
-- 3. People -- 58 rows across 4 generations
-- ----------------------------------------------------------------------------
-- Expanded for #69 (option d super-root): the original 13-person seed had
-- only 5 root subtrees, which under-stressed the super-root show-all layout.
-- The expansion brings the demo up to ~60 people, ~19 root subtrees, with
-- the original 13 UUIDs + relationships preserved verbatim (so any test
-- fixtures keyed off them keep working).
--
-- Notable structures the expansion exercises:
--   * 3 new Gen-1 in-law couples (Hartford / Brennan / Okonkwo) become
--     siblings-of-Gen-1 in the layout via the super-root.
--   * Catherine + Andrew + new Gen-2 siblings (Walter, Helen, Eve) all
--     get spouses; Eve & Carlos are deliberately UNMARRIED co-parents to
--     exercise the non-spouse-parent-links rewriter.
--   * Olivia Brennan-Smith ↔ Aisling O'Connor — same-sex Gen-3 marriage.
--   * Sophia Vargas raises Luca alone (single-parent / father not in tree).
--
-- Insertion order respects self-FK dependencies:
--   Gen 1 (no parents): George, Margaret, Henry, Eleanor + 6 new in-laws
--   Gen 2 (parents in Gen 1, or in-law with null): Robert, Catherine,
--     Susan, Andrew + 8 new (siblings + Gen-2 in-laws who marry in)
--   Gen 3 (parents in Gen 2, or in-law with null): Daniel, Adam, Penny,
--     Nora + 16 new (cousins + their in-law spouses)
--   Gen 4 (parents in Gen 3): Theo + 13 new (Theo's cousins)
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

-- ---- Gen 1: Hartford in-laws (Beth Hartford's parents) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '22222222-0000-0000-0000-00000000000e',
    '11111111-1111-1111-1111-111111111111',
    'David Hartford', 'David', 'm', 1936, 2010, true,
    'Charleston, SC',
    'Maritime lawyer turned sailboat restorer. Famous for the rum punch he served at every family wedding.',
    'indigo',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000000f',
    '11111111-1111-1111-1111-111111111111',
    'Linda Hartford', 'Linda', 'f', 1940, null, false,
    'Charleston, SC',
    'Watercolour painter. Her landscapes hang in every grandchild''s nursery.',
    'amber',
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 1: Brennan in-laws (James Brennan's parents) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '22222222-0000-0000-0000-000000000010',
    '11111111-1111-1111-1111-111111111111',
    'Patrick Brennan', 'Pat', 'm', 1938, null, false,
    'Worcester, MA',
    'Retired firefighter. Still keeps the squad''s annual pancake breakfast running.',
    'sage',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000011',
    '11111111-1111-1111-1111-111111111111',
    'Marie Brennan', 'Marie', 'f', 1941, null, false,
    'Worcester, MA',
    'Children''s librarian, story-time legend at the Worcester Public.',
    'rose',
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 1: Okonkwo in-laws (Marcus Okonkwo's parents) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '22222222-0000-0000-0000-000000000012',
    '11111111-1111-1111-1111-111111111111',
    'Chuka Okonkwo', 'Chuka', 'm', 1941, null, false,
    'Brooklyn, NY',
    'Civil-rights attorney. Came to New York from Lagos in 1965 and never stopped working.',
    'indigo',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000013',
    '11111111-1111-1111-1111-111111111111',
    'Adaeze Okonkwo', 'Ada', 'f', 1943, null, false,
    'Brooklyn, NY',
    'Pediatric nurse. Knitted a blanket for every grandchild before they were born.',
    'green',
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

-- ---- Gen 2: New Smith siblings + their spouses ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000014',
    '11111111-1111-1111-1111-111111111111',
    'Walter Smith', 'Uncle Walt', 'm', 1965, null, false,
    'Boston',
    'Eldest of George''s children. Took early retirement to coach Little League.',
    'sage',
    '22222222-0000-0000-0000-000000000001',  -- George
    '22222222-0000-0000-0000-000000000002',  -- Margaret
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000015',
    '11111111-1111-1111-1111-111111111111',
    'Olivia Smith', 'Aunt Liv', 'f', 1966, null, false,
    'Boston',
    'Marine biologist. Walter''s wife. Met him on a research cruise out of Woods Hole.',
    'green',
    null, null,  -- in-law: parents not in this tree
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000001a',
    '11111111-1111-1111-1111-111111111111',
    'Eve Smith', 'Eve', 'f', 1975, null, false,
    'Portland, ME',
    'Youngest of George''s children. Runs a pottery studio. Never married Carlos but raised two kids with him.',
    'rose',
    '22222222-0000-0000-0000-000000000001',  -- George
    '22222222-0000-0000-0000-000000000002',  -- Margaret
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000001b',
    '11111111-1111-1111-1111-111111111111',
    'Carlos Vargas', 'Carlos', 'm', 1974, null, false,
    'Portland, ME',
    'Sculptor and Eve''s long-time partner. Co-parented Sophia and Diego.',
    'indigo',
    null, null,  -- in-law: parents not in this tree
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 2: Catherine's husband (James Brennan) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000016',
    '11111111-1111-1111-1111-111111111111',
    'James Brennan', 'Jim', 'm', 1970, null, false,
    'Seattle',
    'Architect. Met Catherine on a project in Boston in the late 90s and followed her to Seattle.',
    'sage',
    '22222222-0000-0000-0000-000000000010',  -- Patrick Brennan
    '22222222-0000-0000-0000-000000000011',  -- Marie Brennan
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 2: New Anderson sibling + spouse (Helen + Marcus) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000017',
    '11111111-1111-1111-1111-111111111111',
    'Helen Anderson', 'Aunt Helen', 'f', 1969, null, false,
    'Brooklyn, NY',
    'Civil-rights lawyer like her father-in-law. Moved to Brooklyn the year she married Marcus.',
    'amber',
    '22222222-0000-0000-0000-000000000003',  -- Henry
    '22222222-0000-0000-0000-000000000004',  -- Eleanor
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000018',
    '11111111-1111-1111-1111-111111111111',
    'Marcus Okonkwo', 'Marcus', 'm', 1973, null, false,
    'Brooklyn, NY',
    'Jazz pianist and music teacher. Plays the Village Vanguard every Tuesday.',
    'indigo',
    '22222222-0000-0000-0000-000000000012',  -- Chuka
    '22222222-0000-0000-0000-000000000013',  -- Adaeze
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 2: Andrew's wife (Beth Hartford) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000019',
    '11111111-1111-1111-1111-111111111111',
    'Beth Hartford', 'Beth', 'f', 1975, null, false,
    'Burlington, VT',
    'Veterinarian. Runs the farm''s livestock practice with Andrew.',
    'rose',
    '22222222-0000-0000-0000-00000000000e',  -- David Hartford
    '22222222-0000-0000-0000-00000000000f',  -- Linda Hartford
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

-- ---- Gen 3: Catherine + James's children ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-00000000001c',
    '11111111-1111-1111-1111-111111111111',
    'Olivia Brennan-Smith', 'Liv', 'f', 1998, null, false,
    'Seattle',
    'Software engineer. Came out at 22 and married her wife Aisling in 2023.',
    'green',
    '22222222-0000-0000-0000-000000000016',  -- James Brennan
    '22222222-0000-0000-0000-000000000006',  -- Catherine Smith
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000001d',
    '11111111-1111-1111-1111-111111111111',
    'Ethan Brennan-Smith', 'Ethan', 'm', 2001, null, false,
    'Portland, OR',
    'Sound designer for indie films. Lives in a converted school bus.',
    'sage',
    '22222222-0000-0000-0000-000000000016',  -- James Brennan
    '22222222-0000-0000-0000-000000000006',  -- Catherine Smith
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 3: Andrew + Beth's children ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-00000000001e',
    '11111111-1111-1111-1111-111111111111',
    'Maya Anderson', 'Maya', 'f', 2002, null, false,
    'Burlington, VT',
    'Veterinary student. Apprentices on the family farm every summer.',
    'amber',
    '22222222-0000-0000-0000-000000000008',  -- Andrew Anderson
    '22222222-0000-0000-0000-000000000019',  -- Beth Hartford
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000001f',
    '11111111-1111-1111-1111-111111111111',
    'Lucas Anderson', 'Luke', 'm', 2005, null, false,
    'Burlington, VT',
    'High-school senior. Captain of the cross-country team.',
    'indigo',
    '22222222-0000-0000-0000-000000000008',  -- Andrew Anderson
    '22222222-0000-0000-0000-000000000019',  -- Beth Hartford
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 3: Walter + Olivia's children ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000020',
    '11111111-1111-1111-1111-111111111111',
    'Jonah Smith', 'Jonah', 'm', 1995, null, false,
    'Cambridge, MA',
    'Marine ecologist. Co-leads a kelp-restoration project off the Cape.',
    'green',
    '22222222-0000-0000-0000-000000000014',  -- Walter
    '22222222-0000-0000-0000-000000000015',  -- Olivia
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000021',
    '11111111-1111-1111-1111-111111111111',
    'Hazel Smith', 'Hazel', 'f', 1998, null, false,
    'Boston',
    'Glassblower. Sells her work at the SoWa Open Market every Sunday.',
    'amber',
    '22222222-0000-0000-0000-000000000014',  -- Walter
    '22222222-0000-0000-0000-000000000015',  -- Olivia
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 3: Helen + Marcus's children ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000022',
    '11111111-1111-1111-1111-111111111111',
    'Naomi Okonkwo', 'Naomi', 'f', 2000, null, false,
    'Brooklyn, NY',
    'Public defender, just like her mother. Plays bass in a weekend band.',
    'rose',
    '22222222-0000-0000-0000-000000000018',  -- Marcus
    '22222222-0000-0000-0000-000000000017',  -- Helen
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000023',
    '11111111-1111-1111-1111-111111111111',
    'Isaac Okonkwo', 'Isaac', 'm', 2003, null, false,
    'New Haven, CT',
    'Pre-med at Yale. Volunteers at the Brooklyn free clinic on breaks.',
    'sage',
    '22222222-0000-0000-0000-000000000018',  -- Marcus
    '22222222-0000-0000-0000-000000000017',  -- Helen
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 3: Eve + Carlos's children (unmarried co-parents) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000024',
    '11111111-1111-1111-1111-111111111111',
    'Sophia Vargas', 'Sophie', 'f', 1999, null, false,
    'Portland, ME',
    'Photographer. Raising Luca solo while she finishes her MFA.',
    'indigo',
    '22222222-0000-0000-0000-00000000001b',  -- Carlos
    '22222222-0000-0000-0000-00000000001a',  -- Eve
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000025',
    '11111111-1111-1111-1111-111111111111',
    'Diego Vargas', 'Diego', 'm', 2002, null, false,
    'Boston',
    'Apprentice ceramicist in his mother''s studio. Skates the Esplanade every morning.',
    'green',
    '22222222-0000-0000-0000-00000000001b',  -- Carlos
    '22222222-0000-0000-0000-00000000001a',  -- Eve
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 3: In-law spouses (no parents in this tree) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '22222222-0000-0000-0000-000000000026',
    '11111111-1111-1111-1111-111111111111',
    'Lily Carter', 'Lily', 'f', 1996, null, false,
    'Chicago',
    'Adam''s wife. Equity-research analyst. Patient enough to teach Adam to cook.',
    'rose',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000027',
    '11111111-1111-1111-1111-111111111111',
    'Rohan Patel', 'Rohan', 'm', 1999, null, false,
    'Edinburgh',
    'Penny''s husband. Theatre director. Met Penny in her first year of law school.',
    'sage',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000028',
    '11111111-1111-1111-1111-111111111111',
    'Aisling O''Connor', 'Ash', 'f', 1997, null, false,
    'Seattle',
    'Olivia Brennan-Smith''s wife. Cellist with the Seattle Symphony.',
    'amber',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000029',
    '11111111-1111-1111-1111-111111111111',
    'Mei Lin', 'Mei', 'f', 1996, null, false,
    'Cambridge, MA',
    'Jonah''s wife. Climate-modelling researcher. Met Jonah at a kelp conference.',
    'green',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000002a',
    '11111111-1111-1111-1111-111111111111',
    'Sean Walsh', 'Sean', 'm', 1999, null, false,
    'Brooklyn, NY',
    'Naomi''s husband. Carpenter who specialises in restoring brownstone interiors.',
    'indigo',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000002b',
    '11111111-1111-1111-1111-111111111111',
    'Brian Walsh', 'Brian', 'm', 1997, null, false,
    'Boston',
    'Hazel''s husband. Pastry chef at a North End bakery. Sean''s older cousin.',
    'sage',
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

-- ---- Gen 4: Adam + Lily's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-00000000002c',
    '11111111-1111-1111-1111-111111111111',
    'Ava Smith', 'Ava', 'f', 2022, null, false,
    'Chicago',
    'Loves drawing dinosaurs. Sleeps with seven stuffed animals.',
    'rose',
    '22222222-0000-0000-0000-00000000000a',  -- Adam
    '22222222-0000-0000-0000-000000000026',  -- Lily Carter
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-00000000002d',
    '11111111-1111-1111-1111-111111111111',
    'Owen Smith', 'Owen', 'm', 2024, null, false,
    'Chicago',
    'Newest, smiliest baby in the Chicago wing of the family.',
    'sage',
    '22222222-0000-0000-0000-00000000000a',  -- Adam
    '22222222-0000-0000-0000-000000000026',  -- Lily Carter
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 4: Penny + Rohan's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-00000000002e',
    '11111111-1111-1111-1111-111111111111',
    'Anya Smith-Patel', 'Anya', 'f', 2023, null, false,
    'Edinburgh',
    'First grandchild born outside the US.',
    'amber',
    '22222222-0000-0000-0000-000000000027',  -- Rohan Patel
    '22222222-0000-0000-0000-00000000000b',  -- Penny
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000035',
    '11111111-1111-1111-1111-111111111111',
    'Sage Smith-Patel', 'Sage', 'm', 2025, null, false,
    'Edinburgh',
    'Born during the Edinburgh Fringe. Slept through it all.',
    'green',
    '22222222-0000-0000-0000-000000000027',  -- Rohan Patel
    '22222222-0000-0000-0000-00000000000b',  -- Penny
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 4: Olivia BS + Aisling's kid (same-sex parents) ----
-- The donor-assisted child carries both surnames; family-chart will lay her
-- out as the child of two female parents — exercises the "two same-gender
-- parents" code path in the layout engine.
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-00000000002f',
    '11111111-1111-1111-1111-111111111111',
    'Cara O''Connor-Brennan', 'Cara', 'f', 2024, null, false,
    'Seattle',
    'Born to two mothers. Already has the same laugh as her ima Aisling.',
    'rose',
    null,                                          -- no father in tree
    '22222222-0000-0000-0000-00000000001c',        -- Olivia Brennan-Smith
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 4: Jonah + Mei's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000030',
    '11111111-1111-1111-1111-111111111111',
    'Nina Smith', 'Nina', 'f', 2021, null, false,
    'Cambridge, MA',
    'The oldest of the Cambridge cousins. Already insists on her own opinions.',
    'amber',
    '22222222-0000-0000-0000-000000000020',  -- Jonah
    '22222222-0000-0000-0000-000000000029',  -- Mei Lin
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000031',
    '11111111-1111-1111-1111-111111111111',
    'Felix Smith', 'Felix', 'm', 2024, null, false,
    'Cambridge, MA',
    'Born during a blizzard. Slept through every storm since.',
    'indigo',
    '22222222-0000-0000-0000-000000000020',  -- Jonah
    '22222222-0000-0000-0000-000000000029',  -- Mei Lin
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000036',
    '11111111-1111-1111-1111-111111111111',
    'Iris Smith', 'Iris', 'f', 2025, null, false,
    'Cambridge, MA',
    'Youngest of three. Newborn-stage star of every video call.',
    'rose',
    '22222222-0000-0000-0000-000000000020',  -- Jonah
    '22222222-0000-0000-0000-000000000029',  -- Mei Lin
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 4: Hazel + Brian's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000032',
    '11111111-1111-1111-1111-111111111111',
    'Casey Walsh', 'Casey', 'm', 2022, null, false,
    'Boston',
    'Spirited toddler. Eats every pastry his father brings home.',
    'green',
    '22222222-0000-0000-0000-00000000002b',  -- Brian Walsh
    '22222222-0000-0000-0000-000000000021',  -- Hazel
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000037',
    '11111111-1111-1111-1111-111111111111',
    'Beatrice Walsh', 'Bea', 'f', 2024, null, false,
    'Boston',
    'Tiny owlish baby. Named after Brian''s grandmother.',
    'amber',
    '22222222-0000-0000-0000-00000000002b',  -- Brian Walsh
    '22222222-0000-0000-0000-000000000021',  -- Hazel
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 4: Naomi + Sean's kid ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000033',
    '11111111-1111-1111-1111-111111111111',
    'Aria Walsh', 'Aria', 'f', 2025, null, false,
    'Brooklyn, NY',
    'Newest cousin on the Brooklyn side.',
    'sage',
    '22222222-0000-0000-0000-00000000002a',  -- Sean Walsh
    '22222222-0000-0000-0000-000000000022',  -- Naomi
    '00000000-0000-0000-0000-000000000001'
  );

-- ---- Gen 4: Sophia's son (single parent, no father in tree) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '22222222-0000-0000-0000-000000000034',
    '11111111-1111-1111-1111-111111111111',
    'Luca Vargas', 'Luca', 'm', 2023, null, false,
    'Portland, ME',
    'Sophia''s son. Loves boats, dogs, and his grandfather Carlos''s sculpting studio.',
    'indigo',
    null,                                          -- father not in tree
    '22222222-0000-0000-0000-000000000024',        -- Sophia
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

-- ---- New Gen-1 in-law couples ----
-- David Hartford <-> Linda Hartford
update public.people set spouse_id = '22222222-0000-0000-0000-00000000000f' where id = '22222222-0000-0000-0000-00000000000e';
update public.people set spouse_id = '22222222-0000-0000-0000-00000000000e' where id = '22222222-0000-0000-0000-00000000000f';

-- Patrick Brennan <-> Marie Brennan
update public.people set spouse_id = '22222222-0000-0000-0000-000000000011' where id = '22222222-0000-0000-0000-000000000010';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000010' where id = '22222222-0000-0000-0000-000000000011';

-- Chuka Okonkwo <-> Adaeze Okonkwo
update public.people set spouse_id = '22222222-0000-0000-0000-000000000013' where id = '22222222-0000-0000-0000-000000000012';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000012' where id = '22222222-0000-0000-0000-000000000013';

-- ---- New Gen-2 marriages (existing-meets-in-law + new-sibling marriages) ----
-- Catherine Smith <-> James Brennan
update public.people set spouse_id = '22222222-0000-0000-0000-000000000016' where id = '22222222-0000-0000-0000-000000000006';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000006' where id = '22222222-0000-0000-0000-000000000016';

-- Andrew Anderson <-> Beth Hartford
update public.people set spouse_id = '22222222-0000-0000-0000-000000000019' where id = '22222222-0000-0000-0000-000000000008';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000008' where id = '22222222-0000-0000-0000-000000000019';

-- Walter Smith <-> Olivia Smith
update public.people set spouse_id = '22222222-0000-0000-0000-000000000015' where id = '22222222-0000-0000-0000-000000000014';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000014' where id = '22222222-0000-0000-0000-000000000015';

-- Helen Anderson <-> Marcus Okonkwo
update public.people set spouse_id = '22222222-0000-0000-0000-000000000018' where id = '22222222-0000-0000-0000-000000000017';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000017' where id = '22222222-0000-0000-0000-000000000018';

-- NOTE: Eve Smith (001a) <-> Carlos Vargas (001b) are intentionally UNMARRIED
-- co-parents (their children Sophia + Diego deliberately exercise the
-- non-spouse-parent-links rewriter). No spouse_id update here.

-- ---- New Gen-3 marriages ----
-- Adam Smith <-> Lily Carter
update public.people set spouse_id = '22222222-0000-0000-0000-000000000026' where id = '22222222-0000-0000-0000-00000000000a';
update public.people set spouse_id = '22222222-0000-0000-0000-00000000000a' where id = '22222222-0000-0000-0000-000000000026';

-- Penny Smith <-> Rohan Patel
update public.people set spouse_id = '22222222-0000-0000-0000-000000000027' where id = '22222222-0000-0000-0000-00000000000b';
update public.people set spouse_id = '22222222-0000-0000-0000-00000000000b' where id = '22222222-0000-0000-0000-000000000027';

-- Olivia Brennan-Smith <-> Aisling O'Connor (same-sex marriage)
update public.people set spouse_id = '22222222-0000-0000-0000-000000000028' where id = '22222222-0000-0000-0000-00000000001c';
update public.people set spouse_id = '22222222-0000-0000-0000-00000000001c' where id = '22222222-0000-0000-0000-000000000028';

-- Jonah Smith <-> Mei Lin
update public.people set spouse_id = '22222222-0000-0000-0000-000000000029' where id = '22222222-0000-0000-0000-000000000020';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000020' where id = '22222222-0000-0000-0000-000000000029';

-- Hazel Smith <-> Brian Walsh
update public.people set spouse_id = '22222222-0000-0000-0000-00000000002b' where id = '22222222-0000-0000-0000-000000000021';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000021' where id = '22222222-0000-0000-0000-00000000002b';

-- Naomi Okonkwo <-> Sean Walsh
update public.people set spouse_id = '22222222-0000-0000-0000-00000000002a' where id = '22222222-0000-0000-0000-000000000022';
update public.people set spouse_id = '22222222-0000-0000-0000-000000000022' where id = '22222222-0000-0000-0000-00000000002a';
