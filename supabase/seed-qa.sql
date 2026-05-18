-- meetthefam QA seed: "Smith Family Demo" + cross-lineage duplicate trigger
--
-- PURPOSE
--   Populates the QA Supabase project (meetthefam-qa, ref: ljjvwtpifmoshfknlbaj)
--   with a 14-person demo family tree owned by the QA test user, plus a
--   deliberate cross-lineage marriage that causes family-chart to emit
--   duplicate-card markers (d.duplicate > 0) when the tree is viewed centered
--   on Daniel — required for Phase 8b-3 QA gate (locked decision #13).
--
-- NOT A MIGRATION
--   This file is NOT a Supabase migration and will not be applied automatically.
--   It is a one-off remote seed applied against the QA project via:
--     pnpm exec supabase db query --linked -f supabase/seed-qa.sql
--   OR copy/paste into the QA Supabase Studio SQL editor.
--
-- IDEMPOTENCY
--   Every INSERT uses ON CONFLICT DO NOTHING. Spouse UPDATE statements are
--   idempotent. Re-running the script against an already-seeded QA project is
--   safe.
--
-- DIFFERS FROM supabase/seed.sql
--   • Target email:  mtf.test1@sb23.anonaddy.me  (QA test account)
--   • Auth user UUID: 78faa043-feb8-4aa0-a679-89949fe3004d  (already in QA)
--   • All tree + people UUIDs are freshly generated (no overlap with local
--     00000000 / 11111111 / 22222222 fixtures).
--   • Catherine Smith ↔ Andrew Anderson are married (spouse_id set symmetrically).
--   • Maya Anderson (Gen 3, b.1998) is added as their child, creating a
--     dual-chain reachability scenario from Daniel's POV (duplicate marker).
--
-- DUPLICATE TRIGGER RATIONALE
--   Daniel is the ego node ("You"). Maya is his first cousin, reachable via:
--     Chain A: Daniel → father Robert → sister Catherine → daughter Maya
--     Chain B: Daniel → mother Susan → brother Andrew → daughter Maya
--   family-chart (ESM build, line ~880) sets d.duplicate > 0 on the second
--   occurrence found during tree construction. Catherine and Andrew themselves
--   become reachable through two chains from Daniel's perspective, surfacing
--   additional duplicate markers.
--
-- HOW TO LOG IN ON THE PREVIEW
--   Email: mtf.test1@sb23.anonaddy.me
--   The auth.users row is already confirmed (email_confirmed_at = now() was set
--   when first inserted). Trigger a magic-link via the preview login form —
--   it will work first try with no confirmation round-trip needed.

-- ============================================================================
-- CONSTANTS (copy here for reference; do not re-declare in SQL)
-- ============================================================================
--   QA user UUID    : 78faa043-feb8-4aa0-a679-89949fe3004d
--   tree            : f07b40dc-6117-4355-8605-f19e8be8d481
--   george          : ed81f46a-22be-4f95-8680-c2f59d55a1f0
--   margaret        : aa21e0d4-fb01-48ee-9a52-b39eb952f64c
--   henry           : c809c674-9398-40bd-b4ff-d61aa428ce99
--   eleanor         : 40a41b2a-d420-439b-b2e4-a3fb409071e6
--   robert          : 4176c5e9-54be-4419-a96b-1ca48c97568f
--   catherine       : cde3ac39-eaf0-46e0-bb93-9f6d42a72818
--   susan           : 7e787820-6110-4ab9-9c41-34404bb1146e
--   andrew          : 50adf032-39d0-4871-9c57-a7564f25f00f
--   daniel          : 94d2bb07-c2b4-4333-bed7-904d152f1e8e
--   adam            : dd1bb6c7-1a8c-4df0-9ba9-04d1e08af73d
--   penny           : 27441da6-b152-4dd9-85cf-0c9f511ae61d
--   nora            : c8ab3598-030f-4b9d-b15e-992054c3f780
--   theo            : e0516698-8551-4f24-951e-3902aabfd648
--   maya            : 2ea46044-0953-4b60-83a2-86ea1fa1b440

-- ============================================================================
-- NOTE: auth.users row for mtf.test1@sb23.anonaddy.me already exists in QA
-- (UUID 78faa043-feb8-4aa0-a679-89949fe3004d, inserted previously).
-- The INSERT below is included for completeness and will be skipped on conflict.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Auth user (idempotent — row already exists in QA)
-- ----------------------------------------------------------------------------
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
  '78faa043-feb8-4aa0-a679-89949fe3004d',
  'authenticated',
  'authenticated',
  'mtf.test1@sb23.anonaddy.me',
  crypt('qa-seed-placeholder', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"QA Smith"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

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
  '78faa043-feb8-4aa0-a679-89949fe3004d',
  jsonb_build_object(
    'sub',            '78faa043-feb8-4aa0-a679-89949fe3004d',
    'email',          'mtf.test1@sb23.anonaddy.me',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  '78faa043-feb8-4aa0-a679-89949fe3004d',
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
  'f07b40dc-6117-4355-8605-f19e8be8d481',
  'Smith Family Demo',
  'A sanitized 4-generation demo family (Smith / Anderson) seeded into the QA project for Phase 8b-3 duplicate-card visual QA. Includes a cross-lineage marriage (Catherine ↔ Andrew) that triggers family-chart duplicate markers when viewing Daniel as the ego node.',
  '78faa043-feb8-4aa0-a679-89949fe3004d'
)
on conflict (id) do nothing;

insert into public.tree_members (tree_id, user_id, role, invited_by)
values (
  'f07b40dc-6117-4355-8605-f19e8be8d481',
  '78faa043-feb8-4aa0-a679-89949fe3004d',
  'owner',
  '78faa043-feb8-4aa0-a679-89949fe3004d'
)
on conflict (tree_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. People — 14 rows across 4 generations
-- ----------------------------------------------------------------------------
-- Insertion order respects self-FK dependencies:
--   Gen 1 (no parents): George, Margaret, Henry, Eleanor
--   Gen 2 (parents in Gen 1): Robert, Catherine, Susan, Andrew
--   Gen 3 (parents in Gen 2, or no parents for in-laws): Daniel, Adam, Penny,
--          Nora, Maya (NEW — daughter of Catherine + Andrew)
--   Gen 4 (parents in Gen 3): Theo

-- ---- Gen 1: Paternal grandparents (Smith) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    'ed81f46a-22be-4f95-8680-c2f59d55a1f0',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'George Smith', 'George', 'm', 1938, 2011, true,
    'Boston, MA',
    'Opened the family hardware store on Main Street in 1962. Loved gardening and reading aloud.',
    'sage',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'aa21e0d4-fb01-48ee-9a52-b39eb952f64c',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Margaret Smith', 'Margaret', 'f', 1942, null, false,
    'Hartford, CT',
    'Gentle storyteller, keeper of every recipe in the family. Lives with us in Boston.',
    'rose',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 1: Maternal grandparents (Anderson) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    'c809c674-9398-40bd-b4ff-d61aa428ce99',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Henry Anderson', 'Henry', 'm', 1940, 2019, true,
    'Springfield, MA',
    'Civil engineer. Built bridges across New England. Quietly proud of every one.',
    'indigo',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '40a41b2a-d420-439b-b2e4-a3fb409071e6',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Eleanor Anderson', 'Eleanor', 'f', 1944, null, false,
    'Providence, RI',
    'Schoolteacher for 38 years. Still corrects everyone''s grammar.',
    'amber',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 2: Parents + siblings ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '4176c5e9-54be-4419-a96b-1ca48c97568f',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Robert Smith', 'Robert', 'm', 1968, null, false,
    'Boston',
    'Took over the shop in 1995. Baseball fanatic, terrible singer.',
    'sage',
    'ed81f46a-22be-4f95-8680-c2f59d55a1f0',  -- George
    'aa21e0d4-fb01-48ee-9a52-b39eb952f64c',  -- Margaret
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'cde3ac39-eaf0-46e0-bb93-9f6d42a72818',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Catherine Smith', 'Aunt Cathy', 'f', 1972, null, false,
    'Seattle, WA',
    'Architect based in Seattle. Visits every Christmas. Married Andrew Anderson in 2001.',
    'amber',
    'ed81f46a-22be-4f95-8680-c2f59d55a1f0',  -- George
    'aa21e0d4-fb01-48ee-9a52-b39eb952f64c',  -- Margaret
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '7e787820-6110-4ab9-9c41-34404bb1146e',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Susan Smith', 'Susan', 'f', 1970, null, false,
    'Boston',
    'Pediatrician. Holds the family together with weekly Sunday dinners.',
    'rose',
    'c809c674-9398-40bd-b4ff-d61aa428ce99',  -- Henry
    '40a41b2a-d420-439b-b2e4-a3fb409071e6',  -- Eleanor
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '50adf032-39d0-4871-9c57-a7564f25f00f',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Andrew Anderson', 'Uncle Drew', 'm', 1974, null, false,
    'Burlington, VT',
    'Runs an organic farm outside Burlington. Married Catherine Smith in 2001.',
    'indigo',
    'c809c674-9398-40bd-b4ff-d61aa428ce99',  -- Henry
    '40a41b2a-d420-439b-b2e4-a3fb409071e6',  -- Eleanor
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 3: Daniel (ego), siblings, in-law Nora, and Maya (new — duplicate trigger) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '94d2bb07-c2b4-4333-bed7-904d152f1e8e',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Daniel Smith', 'You', 'm', 1994, null, false,
    'Boston',
    'Started this tree on a quiet Sunday afternoon.',
    'green',
    '4176c5e9-54be-4419-a96b-1ca48c97568f',  -- Robert
    '7e787820-6110-4ab9-9c41-34404bb1146e',  -- Susan
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'dd1bb6c7-1a8c-4df0-9ba9-04d1e08af73d',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Adam Smith', 'Adam', 'm', 1997, null, false,
    'Chicago, IL',
    'Younger brother. Lives in Chicago, works in finance.',
    'sage',
    '4176c5e9-54be-4419-a96b-1ca48c97568f',  -- Robert
    '7e787820-6110-4ab9-9c41-34404bb1146e',  -- Susan
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '27441da6-b152-4dd9-85cf-0c9f511ae61d',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Penny Smith', 'Penny', 'f', 2000, null, false,
    'Edinburgh, UK',
    'Youngest. Studying law in Edinburgh.',
    'amber',
    '4176c5e9-54be-4419-a96b-1ca48c97568f',  -- Robert
    '7e787820-6110-4ab9-9c41-34404bb1146e',  -- Susan
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'c8ab3598-030f-4b9d-b15e-992054c3f780',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Nora Smith', 'Nora', 'f', 1995, null, false,
    'Burlington, VT',
    'Product designer. Married Daniel in 2021 in a quiet Vermont ceremony.',
    'rose',
    null, null,  -- in-law: parents not in this tree
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  -- Maya Anderson: daughter of Catherine + Andrew.
  -- She is Daniel's first cousin reachable via TWO chains:
  --   Chain A: Daniel → Robert (father) → Catherine (sister) → Maya
  --   Chain B: Daniel → Susan (mother) → Andrew (brother) → Maya
  -- family-chart sets d.duplicate > 0 on the second occurrence found, causing
  -- the duplicate-card overlay to appear when Daniel is the ego node.
  (
    '2ea46044-0953-4b60-83a2-86ea1fa1b440',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Maya Anderson', 'Maya', 'f', 1998, null, false,
    'Montpelier, VT',
    'Cousin in Vermont — illustrator and bookbinder.',
    'amber',
    '50adf032-39d0-4871-9c57-a7564f25f00f',  -- Andrew
    'cde3ac39-eaf0-46e0-bb93-9f6d42a72818',  -- Catherine
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 4 ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'e0516698-8551-4f24-951e-3902aabfd648',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Theodore Smith', 'Theo', 'm', 2023, null, false,
    'Boston',
    'The newest branch on the tree.',
    'rose',
    '94d2bb07-c2b4-4333-bed7-904d152f1e8e',  -- Daniel
    'c8ab3598-030f-4b9d-b15e-992054c3f780',  -- Nora
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Spouse FKs — written symmetrically (both sides), idempotent UPDATEs
-- ----------------------------------------------------------------------------
-- George <-> Margaret
update public.people set spouse_id = 'aa21e0d4-fb01-48ee-9a52-b39eb952f64c'
  where id = 'ed81f46a-22be-4f95-8680-c2f59d55a1f0' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = 'ed81f46a-22be-4f95-8680-c2f59d55a1f0'
  where id = 'aa21e0d4-fb01-48ee-9a52-b39eb952f64c' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Henry <-> Eleanor
update public.people set spouse_id = '40a41b2a-d420-439b-b2e4-a3fb409071e6'
  where id = 'c809c674-9398-40bd-b4ff-d61aa428ce99' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = 'c809c674-9398-40bd-b4ff-d61aa428ce99'
  where id = '40a41b2a-d420-439b-b2e4-a3fb409071e6' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Robert <-> Susan
update public.people set spouse_id = '7e787820-6110-4ab9-9c41-34404bb1146e'
  where id = '4176c5e9-54be-4419-a96b-1ca48c97568f' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = '4176c5e9-54be-4419-a96b-1ca48c97568f'
  where id = '7e787820-6110-4ab9-9c41-34404bb1146e' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Catherine <-> Andrew  (NEW: cross-lineage marriage — duplicate trigger)
update public.people set spouse_id = '50adf032-39d0-4871-9c57-a7564f25f00f'
  where id = 'cde3ac39-eaf0-46e0-bb93-9f6d42a72818' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = 'cde3ac39-eaf0-46e0-bb93-9f6d42a72818'
  where id = '50adf032-39d0-4871-9c57-a7564f25f00f' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Daniel <-> Nora
update public.people set spouse_id = 'c8ab3598-030f-4b9d-b15e-992054c3f780'
  where id = '94d2bb07-c2b4-4333-bed7-904d152f1e8e' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = '94d2bb07-c2b4-4333-bed7-904d152f1e8e'
  where id = 'c8ab3598-030f-4b9d-b15e-992054c3f780' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
