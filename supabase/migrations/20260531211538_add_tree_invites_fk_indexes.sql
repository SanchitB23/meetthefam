-- Add FK covering indexes on tree_invites(accepted_by) and tree_invites(invited_by).
--
-- Both columns are foreign keys to auth.users(id) but had no covering index.
-- Surfaced by `supabase-validator` post-v1.0 ship via get_advisors
-- `unindexed_foreign_keys` advisory:
--   - tree_invites_accepted_by_fkey
--   - tree_invites_invited_by_fkey
--
-- Without indexes, FK cascade lookups, revocation flows (owner reading their
-- own past invites via invited_by), and admin/support queries (accepted_by)
-- would full-scan the table.
--
-- Index naming convention matches the existing tree_invites_tree_id_idx:
--   <table>_<column>_idx
--
-- Both columns are nullable uuid. Postgres B-tree indexes handle NULLs
-- efficiently, so these are standard full indexes (no WHERE clause) per the
-- issue spec (#176).
--
-- References:
--   docs/architecture/data-model.md         -- tree_invites schema
--   supabase/migrations/20260513211135_tree_invites.sql  -- original table + tree_id index

create index if not exists tree_invites_accepted_by_idx
  on public.tree_invites (accepted_by);

create index if not exists tree_invites_invited_by_idx
  on public.tree_invites (invited_by);
