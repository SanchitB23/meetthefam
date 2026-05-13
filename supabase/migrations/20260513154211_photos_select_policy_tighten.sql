-- Tighten the photos SELECT policy: gate by tree membership.
--
-- The just-prior migration `20260513153858_photos_select_policy` added a
-- broad SELECT policy (`bucket_id = 'photos'`) so the supabase-js upload
-- flow's implicit INSERT ... RETURNING could read back the inserted row.
-- That worked, but the Supabase advisor flagged it as
-- `public_bucket_allows_listing` (WARN): any authenticated user could LIST
-- the entire photos bucket and enumerate paths across every tree, leaking
-- "which trees have photos for which people." The file content itself is
-- already public-readable, but the path-existence signal isn't supposed
-- to be cross-tree-visible.
--
-- Per the migration runbook's forward-only discipline: rather than edit
-- the just-prior migration (already on QA), this migration drops the
-- broad policy and replaces it with a tighter one whose predicate matches
-- the INSERT/UPDATE/DELETE policies' shape — caller must be an owner or
-- editor on the tree referenced in the path's [2] segment.
--
-- After this migration, the post-INSERT RETURNING still works (the row
-- the user just inserted is on a tree they're a member of, so the SELECT
-- USING expression evaluates true for that row). Cross-tree listing is
-- blocked. Public file reads via the bucket's `public = true` flag are
-- unaffected — those go through storage-api's HTTP path and bypass
-- storage.objects RLS entirely.

drop policy "photos_select_authenticated" on storage.objects;

create policy "photos_select_editor"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photos'
    and public.is_tree_editor(((storage.foldername(name))[2])::uuid)
  );
