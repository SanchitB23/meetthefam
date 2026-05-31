-- Fix two security hardening gaps on the tree_invites functions flagged by
-- the supabase-validator scan run after v1.0.0 ship (2026-05-31).
--
-- References:
--   docs/architecture/auth-and-rls.md  -- RLS model + invites flow
--   docs/architecture/data-model.md    -- tree_invites schema
--   GitHub issue #175
--
-- A. lowercase_invite_email() missing SET search_path = ''
--    The trigger function body only references NEW.email (no table names), so
--    adding an empty search_path is safe without qualifying anything else.
--    The CREATE OR REPLACE preserves the trigger binding -- no need to drop and
--    recreate the trigger itself.
--
-- B. anon has EXECUTE on accept_invite(text)
--    The Phase 6 migration ran `REVOKE ALL ... FROM public` but hosted Supabase
--    grants EXECUTE on all public.* functions to the `anon` role at
--    project-provisioning time, independently of the `public` pseudo-role.
--    A targeted REVOKE FROM anon closes the gap.  The authenticated grant
--    already exists from the Phase 6 migration; we re-issue it defensively in
--    case of a future db reset.

-- ============================================================================
-- A. Pin search_path on lowercase_invite_email
-- ============================================================================
create or replace function public.lowercase_invite_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$$;

-- ============================================================================
-- B. Revoke EXECUTE on accept_invite from anon; keep authenticated grant
-- ============================================================================
revoke execute on function public.accept_invite(text) from anon;
grant execute on function public.accept_invite(text) to authenticated;
