-- Fix: photos bucket SELECT policy for authenticated users.
--
-- Caught during sub-task 3 manual QA on 2026-05-13 — uploading a photo from
-- the PersonForm picker failed with "new row violates row-level security
-- policy for table objects" even when the user was a confirmed editor on the
-- target tree. Root cause: supabase-js's `storage.from('photos').upload(...)`
-- runs INSERT into storage.objects with an implicit RETURNING clause to
-- echo back the inserted row. In PostgreSQL, INSERT ... RETURNING requires
-- BOTH the INSERT WITH CHECK policy AND a SELECT USING policy on the same
-- table — the RETURNING is a SELECT under the hood. The original sub-task
-- 1 migration (20260513141141_photos_bucket_and_rls.sql) only added INSERT
-- / UPDATE / DELETE policies because the bucket's `public = true` flag
-- handles public file reads via the storage-api HTTP layer — but that flag
-- does NOT grant row-level SELECT on storage.objects.
--
-- Fix: add a SELECT policy for `authenticated` users on `bucket_id = 'photos'`.
-- Trade-off: any signed-in user can SELECT rows in the photos bucket (i.e.
-- see which paths exist). The file content is already public-readable via
-- the bucket's public flag, so this isn't a privacy regression — only the
-- existence of paths becomes visible. We accept that trade-off for v0.1;
-- if we later move the bucket to private, this policy needs to gate
-- SELECT by tree membership like INSERT/UPDATE/DELETE do.
--
-- References:
--   docs/architecture/auth-and-rls.md      -- updated to add the SELECT row
--   docs/dev/migrations.md                 -- runbook (forward-only; this is
--                                             a new migration, not an edit
--                                             of the prior one)
--
-- Discovered + verified via:
--   1. Reproduced the failure in a `SET LOCAL ROLE authenticated; INSERT ...
--      RETURNING` simulation in the local DB.
--   2. Confirmed `INSERT` without `RETURNING` succeeds under the same
--      session — isolating the RETURNING-needs-SELECT issue.
--   3. Added this policy, retried `INSERT ... RETURNING`, succeeded.

create policy "photos_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'photos');
