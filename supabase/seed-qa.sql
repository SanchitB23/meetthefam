-- meetthefam QA seed: "Smith Family Demo" + cross-lineage duplicate trigger
--
-- PURPOSE
--   Populates the QA Supabase project (meetthefam-qa, ref: ljjvwtpifmoshfknlbaj)
--   with a 49-person demo family tree owned by the QA test user, plus a
--   deliberate cross-lineage marriage that causes family-chart to emit
--   duplicate-card markers (d.duplicate > 0) when the tree is viewed centered
--   on Daniel — required for Phase 8b-3 QA gate (locked decision #13).
--
-- EXPANSION (#69)
--   The original 14-person seed was too small to stress the v1.1 option-(d)
--   super-root show-all layout. Expanded to ~49 people / ~15 root subtrees
--   while PRESERVING the 8b-3 anchor exactly:
--     • Catherine ↔ Andrew remain married (the cross-lineage marriage).
--     • Maya Anderson (UUID 2ea46044-...) remains their child, b. 1998,
--       still produces d.duplicate > 0 when Daniel is the ego node.
--   Hartford + Brennan in-law families from supabase/seed.sql are deliberately
--   omitted in QA because their purpose there is to provide spouses for
--   Catherine + Andrew — slots that are already taken in the QA seed by
--   the cross-lineage marriage anchor. Okonkwo (Marcus's parents) remains.
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
-- 3. People — 49 rows across 4 generations
-- ----------------------------------------------------------------------------
-- Insertion order respects self-FK dependencies:
--   Gen 1 (no parents): George, Margaret, Henry, Eleanor + Chuka, Adaeze
--          Okonkwo (new — Marcus's parents)
--   Gen 2 (parents in Gen 1, or in-law): Robert, Catherine, Susan, Andrew
--          + Walter, Olivia, Eve, Carlos (Smith side), Helen + Marcus (Anderson
--          side). Eve & Carlos are UNMARRIED co-parents.
--   Gen 3 (parents in Gen 2, or in-law): Daniel, Adam, Penny, Nora, Maya
--          + Olivia, Ethan, Lucas Anderson (Catherine + Andrew's kids, Maya's
--          siblings); Jonah + Hazel Smith; Naomi + Isaac Okonkwo;
--          Sophia + Diego Vargas (unmarried-co-parent kids); 6 in-law spouses.
--   Gen 4 (parents in Gen 3): Theo + 12 cousins.

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

-- ---- Gen 1: Okonkwo in-laws (Marcus Okonkwo's parents) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '566f2897-610b-4ec6-afde-5473e6820994',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Chuka Okonkwo', 'Chuka', 'm', 1941, null, false,
    'Brooklyn, NY',
    'Civil-rights attorney. Came to New York from Lagos in 1965 and never stopped working.',
    'indigo',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'e0117f9b-89ba-4125-9711-7cee7d698e64',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Adaeze Okonkwo', 'Ada', 'f', 1943, null, false,
    'Brooklyn, NY',
    'Pediatric nurse. Knitted a blanket for every grandchild before they were born.',
    'green',
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

-- ---- Gen 2: New Smith siblings (Walter + Olivia, Eve + Carlos) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '842e6e8e-1040-42a1-b7ea-e578f66c5111',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Walter Smith', 'Uncle Walt', 'm', 1965, null, false,
    'Boston',
    'Eldest of George''s children. Took early retirement to coach Little League.',
    'sage',
    'ed81f46a-22be-4f95-8680-c2f59d55a1f0',  -- George
    'aa21e0d4-fb01-48ee-9a52-b39eb952f64c',  -- Margaret
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '687bb171-af26-43e8-a599-74b777104f46',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Olivia Smith', 'Aunt Liv', 'f', 1966, null, false,
    'Boston',
    'Marine biologist. Walter''s wife. Met him on a research cruise out of Woods Hole.',
    'green',
    null, null,  -- in-law: parents not in this tree
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'fdbb41cf-10e1-4dd4-91c6-c6da1239d838',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Eve Smith', 'Eve', 'f', 1975, null, false,
    'Portland, ME',
    'Youngest of George''s children. Runs a pottery studio. Never married Carlos but raised two kids with him.',
    'rose',
    'ed81f46a-22be-4f95-8680-c2f59d55a1f0',  -- George
    'aa21e0d4-fb01-48ee-9a52-b39eb952f64c',  -- Margaret
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '72748de7-dbdf-414e-a8cf-a3c77f0fa6fa',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Carlos Vargas', 'Carlos', 'm', 1974, null, false,
    'Portland, ME',
    'Sculptor and Eve''s long-time partner. Co-parented Sophia and Diego.',
    'indigo',
    null, null,  -- in-law: parents not in this tree
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 2: New Anderson sibling Helen + her husband Marcus Okonkwo ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'b57db8df-e027-4226-a567-6b30ff1db30b',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Helen Anderson', 'Aunt Helen', 'f', 1969, null, false,
    'Brooklyn, NY',
    'Civil-rights lawyer like her father-in-law. Moved to Brooklyn the year she married Marcus.',
    'amber',
    'c809c674-9398-40bd-b4ff-d61aa428ce99',  -- Henry
    '40a41b2a-d420-439b-b2e4-a3fb409071e6',  -- Eleanor
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'fd279b59-c7ff-4eb4-b6f1-6df14bdf8257',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Marcus Okonkwo', 'Marcus', 'm', 1973, null, false,
    'Brooklyn, NY',
    'Jazz pianist and music teacher. Plays the Village Vanguard every Tuesday.',
    'indigo',
    '566f2897-610b-4ec6-afde-5473e6820994',  -- Chuka
    'e0117f9b-89ba-4125-9711-7cee7d698e64',  -- Adaeze
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

-- ---- Gen 3: Maya's siblings (Catherine + Andrew's other kids) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '15b57336-aa5a-4997-8416-c894c2c18ee1',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Olivia Anderson', 'Liv', 'f', 2000, null, false,
    'Seattle',
    'Software engineer. Came out at 22 and married her wife Aisling in 2023.',
    'green',
    '50adf032-39d0-4871-9c57-a7564f25f00f',  -- Andrew
    'cde3ac39-eaf0-46e0-bb93-9f6d42a72818',  -- Catherine
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '02add366-5e01-403a-b7f7-f398047fdfa4',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Ethan Anderson', 'Ethan', 'm', 2003, null, false,
    'Portland, OR',
    'Sound designer for indie films. Lives in a converted school bus.',
    'sage',
    '50adf032-39d0-4871-9c57-a7564f25f00f',  -- Andrew
    'cde3ac39-eaf0-46e0-bb93-9f6d42a72818',  -- Catherine
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '59d2dbf5-1021-42ae-aa88-e093b0674a28',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Lucas Anderson', 'Luke', 'm', 2005, null, false,
    'Burlington, VT',
    'High-school senior. Captain of the cross-country team.',
    'indigo',
    '50adf032-39d0-4871-9c57-a7564f25f00f',  -- Andrew
    'cde3ac39-eaf0-46e0-bb93-9f6d42a72818',  -- Catherine
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 3: Walter + Olivia's children ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'e6aa95d0-579f-4e2a-894c-810e9e0c53d0',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Jonah Smith', 'Jonah', 'm', 1995, null, false,
    'Cambridge, MA',
    'Marine ecologist. Co-leads a kelp-restoration project off the Cape.',
    'green',
    '842e6e8e-1040-42a1-b7ea-e578f66c5111',  -- Walter
    '687bb171-af26-43e8-a599-74b777104f46',  -- Olivia
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '790e2969-24c8-4e89-ac3c-eeaa9e193bdd',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Hazel Smith', 'Hazel', 'f', 1998, null, false,
    'Boston',
    'Glassblower. Sells her work at the SoWa Open Market every Sunday.',
    'amber',
    '842e6e8e-1040-42a1-b7ea-e578f66c5111',  -- Walter
    '687bb171-af26-43e8-a599-74b777104f46',  -- Olivia
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 3: Helen + Marcus's children ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'd611f10f-5c4e-412e-84f8-a3cf78382b2e',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Naomi Okonkwo', 'Naomi', 'f', 2000, null, false,
    'Brooklyn, NY',
    'Public defender, just like her mother. Plays bass in a weekend band.',
    'rose',
    'fd279b59-c7ff-4eb4-b6f1-6df14bdf8257',  -- Marcus
    'b57db8df-e027-4226-a567-6b30ff1db30b',  -- Helen
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    'b9f23491-c310-4346-a5df-56ee4658cc5d',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Isaac Okonkwo', 'Isaac', 'm', 2003, null, false,
    'New Haven, CT',
    'Pre-med at Yale. Volunteers at the Brooklyn free clinic on breaks.',
    'sage',
    'fd279b59-c7ff-4eb4-b6f1-6df14bdf8257',  -- Marcus
    'b57db8df-e027-4226-a567-6b30ff1db30b',  -- Helen
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 3: Eve + Carlos's children (unmarried co-parents) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '98a89d14-2b85-458e-979a-71d6513aaecb',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Sophia Vargas', 'Sophie', 'f', 1999, null, false,
    'Portland, ME',
    'Photographer. Raising Luca solo while she finishes her MFA.',
    'indigo',
    '72748de7-dbdf-414e-a8cf-a3c77f0fa6fa',  -- Carlos
    'fdbb41cf-10e1-4dd4-91c6-c6da1239d838',  -- Eve
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '7e5087b3-8990-4536-9319-2d57d4e6cc71',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Diego Vargas', 'Diego', 'm', 2002, null, false,
    'Boston',
    'Apprentice ceramicist in his mother''s studio. Skates the Esplanade every morning.',
    'green',
    '72748de7-dbdf-414e-a8cf-a3c77f0fa6fa',  -- Carlos
    'fdbb41cf-10e1-4dd4-91c6-c6da1239d838',  -- Eve
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 3: In-law spouses (no parents in this tree) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, created_by
) values
  (
    '4df9944e-fce4-4d7b-8cd1-5bcc7530b06f',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Lily Carter', 'Lily', 'f', 1996, null, false,
    'Chicago',
    'Adam''s wife. Equity-research analyst. Patient enough to teach Adam to cook.',
    'rose',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '4246eca3-2b6c-4209-9e80-53e27cca1794',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Rohan Patel', 'Rohan', 'm', 1999, null, false,
    'Edinburgh',
    'Penny''s husband. Theatre director. Met Penny in her first year of law school.',
    'sage',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '47ff3331-6510-4acf-a467-5d7e2ac0d07a',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Aisling O''Connor', 'Ash', 'f', 1997, null, false,
    'Seattle',
    'Olivia Anderson''s wife. Cellist with the Seattle Symphony.',
    'amber',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '38566f66-2955-4457-82c2-e55c6d3dc16a',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Mei Lin', 'Mei', 'f', 1996, null, false,
    'Cambridge, MA',
    'Jonah''s wife. Climate-modelling researcher. Met Jonah at a kelp conference.',
    'green',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '7c91289f-e792-4d29-b36b-536f6c1556f8',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Sean Walsh', 'Sean', 'm', 1999, null, false,
    'Brooklyn, NY',
    'Naomi''s husband. Carpenter who specialises in restoring brownstone interiors.',
    'indigo',
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '90347e2a-975d-445b-b218-6333b84ff43f',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Brian Walsh', 'Brian', 'm', 1997, null, false,
    'Boston',
    'Hazel''s husband. Pastry chef at a North End bakery. Sean''s older cousin.',
    'sage',
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

-- ---- Gen 4: Adam + Lily's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'a0d85553-3e11-451b-a191-3e9a33d42f01',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Ava Smith', 'Ava', 'f', 2022, null, false,
    'Chicago',
    'Loves drawing dinosaurs. Sleeps with seven stuffed animals.',
    'rose',
    'dd1bb6c7-1a8c-4df0-9ba9-04d1e08af73d',  -- Adam
    '4df9944e-fce4-4d7b-8cd1-5bcc7530b06f',  -- Lily
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '5c675cd1-17dd-4a00-a6c9-0e229b0d059c',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Owen Smith', 'Owen', 'm', 2024, null, false,
    'Chicago',
    'Newest, smiliest baby in the Chicago wing of the family.',
    'sage',
    'dd1bb6c7-1a8c-4df0-9ba9-04d1e08af73d',  -- Adam
    '4df9944e-fce4-4d7b-8cd1-5bcc7530b06f',  -- Lily
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 4: Penny + Rohan's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'c57aa27a-ed31-4397-8120-a59f9365dde5',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Anya Smith-Patel', 'Anya', 'f', 2023, null, false,
    'Edinburgh',
    'First grandchild born outside the US.',
    'amber',
    '4246eca3-2b6c-4209-9e80-53e27cca1794',  -- Rohan
    '27441da6-b152-4dd9-85cf-0c9f511ae61d',  -- Penny
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '5083fddc-d124-4c1b-911f-cd2cc05c09ca',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Sage Smith-Patel', 'Sage', 'm', 2025, null, false,
    'Edinburgh',
    'Born during the Edinburgh Fringe. Slept through it all.',
    'green',
    '4246eca3-2b6c-4209-9e80-53e27cca1794',  -- Rohan
    '27441da6-b152-4dd9-85cf-0c9f511ae61d',  -- Penny
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 4: Olivia Anderson + Aisling's kid (same-sex parents) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'b008f0ac-1b51-4a8d-9d49-246b398f1a63',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Cara O''Connor-Anderson', 'Cara', 'f', 2024, null, false,
    'Seattle',
    'Born to two mothers. Already has the same laugh as her ima Aisling.',
    'rose',
    null,                                          -- no father in tree
    '15b57336-aa5a-4997-8416-c894c2c18ee1',        -- Olivia Anderson
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 4: Jonah + Mei's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '0b9d8675-a6a2-477b-b0b8-a736c076b0d5',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Nina Smith', 'Nina', 'f', 2021, null, false,
    'Cambridge, MA',
    'The oldest of the Cambridge cousins. Already insists on her own opinions.',
    'amber',
    'e6aa95d0-579f-4e2a-894c-810e9e0c53d0',  -- Jonah
    '38566f66-2955-4457-82c2-e55c6d3dc16a',  -- Mei
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '42ab90f1-cf09-48c7-a91e-38b2b800ade7',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Felix Smith', 'Felix', 'm', 2024, null, false,
    'Cambridge, MA',
    'Born during a blizzard. Slept through every storm since.',
    'indigo',
    'e6aa95d0-579f-4e2a-894c-810e9e0c53d0',  -- Jonah
    '38566f66-2955-4457-82c2-e55c6d3dc16a',  -- Mei
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '38c8ba48-80c9-4a53-8ef8-a54b46ced71c',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Iris Smith', 'Iris', 'f', 2025, null, false,
    'Cambridge, MA',
    'Youngest of three. Newborn-stage star of every video call.',
    'rose',
    'e6aa95d0-579f-4e2a-894c-810e9e0c53d0',  -- Jonah
    '38566f66-2955-4457-82c2-e55c6d3dc16a',  -- Mei
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 4: Hazel + Brian's kids ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '7b28a4f3-5a61-4d29-ae26-bf3636c59f3a',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Casey Walsh', 'Casey', 'm', 2022, null, false,
    'Boston',
    'Spirited toddler. Eats every pastry his father brings home.',
    'green',
    '90347e2a-975d-445b-b218-6333b84ff43f',  -- Brian
    '790e2969-24c8-4e89-ac3c-eeaa9e193bdd',  -- Hazel
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  ),
  (
    '8da36959-db44-462d-885c-b49d5b06c312',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Beatrice Walsh', 'Bea', 'f', 2024, null, false,
    'Boston',
    'Tiny owlish baby. Named after Brian''s grandmother.',
    'amber',
    '90347e2a-975d-445b-b218-6333b84ff43f',  -- Brian
    '790e2969-24c8-4e89-ac3c-eeaa9e193bdd',  -- Hazel
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 4: Naomi + Sean's kid ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    'f59617cb-e068-42d5-9f57-ecde66b1cce4',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Aria Walsh', 'Aria', 'f', 2025, null, false,
    'Brooklyn, NY',
    'Newest cousin on the Brooklyn side.',
    'sage',
    '7c91289f-e792-4d29-b36b-536f6c1556f8',  -- Sean
    'd611f10f-5c4e-412e-84f8-a3cf78382b2e',  -- Naomi
    '78faa043-feb8-4aa0-a679-89949fe3004d'
  )
on conflict (id) do nothing;

-- ---- Gen 4: Sophia's son (single parent, no father in tree) ----
insert into public.people (
  id, tree_id, full_name, nickname, gender, birth_year, death_year, deceased,
  location, bio, tone, father_id, mother_id, created_by
) values
  (
    '20123348-27e7-449c-9fdf-d073aab3bd42',
    'f07b40dc-6117-4355-8605-f19e8be8d481',
    'Luca Vargas', 'Luca', 'm', 2023, null, false,
    'Portland, ME',
    'Sophia''s son. Loves boats, dogs, and his grandfather Carlos''s sculpting studio.',
    'indigo',
    null,                                          -- father not in tree
    '98a89d14-2b85-458e-979a-71d6513aaecb',        -- Sophia
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

-- ---- New Gen-1 in-law couple (Chuka <-> Adaeze Okonkwo) ----
update public.people set spouse_id = 'e0117f9b-89ba-4125-9711-7cee7d698e64'
  where id = '566f2897-610b-4ec6-afde-5473e6820994' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = '566f2897-610b-4ec6-afde-5473e6820994'
  where id = 'e0117f9b-89ba-4125-9711-7cee7d698e64' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- ---- New Gen-2 marriages ----
-- Walter <-> Olivia Smith
update public.people set spouse_id = '687bb171-af26-43e8-a599-74b777104f46'
  where id = '842e6e8e-1040-42a1-b7ea-e578f66c5111' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = '842e6e8e-1040-42a1-b7ea-e578f66c5111'
  where id = '687bb171-af26-43e8-a599-74b777104f46' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Helen <-> Marcus Okonkwo
update public.people set spouse_id = 'fd279b59-c7ff-4eb4-b6f1-6df14bdf8257'
  where id = 'b57db8df-e027-4226-a567-6b30ff1db30b' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = 'b57db8df-e027-4226-a567-6b30ff1db30b'
  where id = 'fd279b59-c7ff-4eb4-b6f1-6df14bdf8257' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- NOTE: Eve Smith (fdbb41cf-...) <-> Carlos Vargas (72748de7-...) are
-- intentionally UNMARRIED co-parents — their children Sophia + Diego
-- exercise the non-spouse-parent-links rewriter in QA. No spouse_id update.

-- ---- New Gen-3 marriages ----
-- Adam <-> Lily Carter
update public.people set spouse_id = '4df9944e-fce4-4d7b-8cd1-5bcc7530b06f'
  where id = 'dd1bb6c7-1a8c-4df0-9ba9-04d1e08af73d' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = 'dd1bb6c7-1a8c-4df0-9ba9-04d1e08af73d'
  where id = '4df9944e-fce4-4d7b-8cd1-5bcc7530b06f' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Penny <-> Rohan Patel
update public.people set spouse_id = '4246eca3-2b6c-4209-9e80-53e27cca1794'
  where id = '27441da6-b152-4dd9-85cf-0c9f511ae61d' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = '27441da6-b152-4dd9-85cf-0c9f511ae61d'
  where id = '4246eca3-2b6c-4209-9e80-53e27cca1794' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Olivia Anderson <-> Aisling O'Connor (same-sex marriage)
update public.people set spouse_id = '47ff3331-6510-4acf-a467-5d7e2ac0d07a'
  where id = '15b57336-aa5a-4997-8416-c894c2c18ee1' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = '15b57336-aa5a-4997-8416-c894c2c18ee1'
  where id = '47ff3331-6510-4acf-a467-5d7e2ac0d07a' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Jonah <-> Mei Lin
update public.people set spouse_id = '38566f66-2955-4457-82c2-e55c6d3dc16a'
  where id = 'e6aa95d0-579f-4e2a-894c-810e9e0c53d0' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = 'e6aa95d0-579f-4e2a-894c-810e9e0c53d0'
  where id = '38566f66-2955-4457-82c2-e55c6d3dc16a' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Hazel <-> Brian Walsh
update public.people set spouse_id = '90347e2a-975d-445b-b218-6333b84ff43f'
  where id = '790e2969-24c8-4e89-ac3c-eeaa9e193bdd' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = '790e2969-24c8-4e89-ac3c-eeaa9e193bdd'
  where id = '90347e2a-975d-445b-b218-6333b84ff43f' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';

-- Naomi <-> Sean Walsh
update public.people set spouse_id = '7c91289f-e792-4d29-b36b-536f6c1556f8'
  where id = 'd611f10f-5c4e-412e-84f8-a3cf78382b2e' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
update public.people set spouse_id = 'd611f10f-5c4e-412e-84f8-a3cf78382b2e'
  where id = '7c91289f-e792-4d29-b36b-536f6c1556f8' and tree_id = 'f07b40dc-6117-4355-8605-f19e8be8d481';
