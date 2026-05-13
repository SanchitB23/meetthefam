-- Phase 5 sub-task 1: photos Storage bucket + RLS policies.
--
-- Creates the `photos` Storage bucket and the three write-side RLS policies
-- on `storage.objects` that gate INSERT / UPDATE / DELETE by tree membership.
-- Public reads are handled at the bucket level (public = true), so we do NOT
-- add a SELECT policy here.
--
-- References:
--   docs/architecture/photo-upload.md   -- storage path schema, capacity math
--   docs/architecture/auth-and-rls.md   -- per-bucket policy intent (source of truth)
--
-- Path convention (locked in photo-upload.md):
--   trees/<tree_id>/people/<person_id>/avatar.jpg
--
-- `storage.foldername(name)` splits the object name on '/' and returns a text[].
-- For our paths the array is ['trees', '<tree_id>', 'people', '<person_id>'],
-- so index [2] (1-based) is the tree UUID we parse out for the membership check.
--
-- Locked decisions from the Phase 5 sub-task 1 plan:
--   * Bucket `photos` is public-read; no storage.objects SELECT policy needed.
--   * file_size_limit = 524288 bytes (512 KB) -- safety lid above our ~150 KB target.
--   * allowed_mime_types = {'image/jpeg'} only. WebP encoding falls back silently
--     to PNG on older Safari and blows the size budget, so JPEG-only.
--   * Bucket upsert is idempotent (on conflict do nothing) so the migration can
--     re-run on a project that already has the bucket. The three policies are
--     NOT guarded with `if not exists` -- re-running on a project that already
--     has them is a drift signal, not something to silently swallow.

-- ============================================================================
-- 1. photos bucket
-- ============================================================================
-- public = true     -> reads bypass storage.objects RLS entirely.
-- 524288 bytes      -> 512 KB hard cap (we target ~150 KB after client resize).
-- {'image/jpeg'}    -> JPEG-only; see locked decision above.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 524288, array['image/jpeg'])
on conflict (id) do nothing;

-- ============================================================================
-- 2. RLS policies on storage.objects for the photos bucket
-- ============================================================================
-- All three predicates share the same shape:
--   * Restrict to bucket_id = 'photos' (so we don't grant access to other buckets).
--   * Parse the tree_id from the path (segment [2] after the literal 'trees').
--   * Require the caller to be an owner-or-editor on that tree, using the same
--     public.is_tree_editor helper that gates public.people writes -- one source
--     of truth for "can this user write to this tree's data."

-- INSERT: caller is owner or editor on the tree referenced in the path prefix.
create policy "photos_insert_editor"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and public.is_tree_editor(((storage.foldername(name))[2])::uuid)
  );

-- UPDATE: same predicate on both USING and WITH CHECK. USING gates which existing
-- rows the caller can target; WITH CHECK gates the post-update state -- both must
-- be a tree they can edit (rename across trees is implicitly forbidden).
create policy "photos_update_editor"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'photos'
    and public.is_tree_editor(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'photos'
    and public.is_tree_editor(((storage.foldername(name))[2])::uuid)
  );

-- DELETE: caller is owner or editor on the tree referenced in the path prefix.
create policy "photos_delete_editor"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and public.is_tree_editor(((storage.foldername(name))[2])::uuid)
  );
