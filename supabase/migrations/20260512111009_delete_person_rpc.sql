-- Phase 3 sub-task 3: delete_person_atomic RPC.
--
-- Thin wrapper around `delete from public.people where id = p_person_id`.
--
-- Why this is a one-liner (and why we considered more):
--   The plan called for explicitly nulling inbound FKs across `people` rows
--   that pointed AT this person (father_id / mother_id / spouse_id) before
--   deleting the row. Inspection of the schema in 20260511034131_initial_schema.sql
--   (lines 263-265) shows all three columns are declared with
--   `on delete set null` -- so Postgres' FK action handles the cleanup for us:
--
--     father_id  uuid references public.people(id) on delete set null,
--     mother_id  uuid references public.people(id) on delete set null,
--     spouse_id  uuid references public.people(id) on delete set null,
--
--   Spouse-symmetry nuance: when A is deleted and B.spouse_id = A, the FK on
--   B.spouse_id -> people fires `set null` -- so B.spouse_id becomes null,
--   which is exactly the symmetry cleanup we want. An asymmetric pointer
--   (A->B but B->C) leaves C.spouse_id untouched, which is correct (C was
--   never paired to A in the first place).
--
--   Writing redundant `update public.people set spouse_id = null where ...`
--   etc. would be both noise and a subtle correctness risk: the trigger
--   `people_touch_updated_at` would fire on partners, bumping their
--   `updated_at` for a non-edit and polluting any future "recently changed"
--   UI. Delegating to the FK action keeps the touch trigger silent.
--
-- SECURITY INVOKER (default, but stated explicitly) is deliberate: the
-- caller's RLS still gates the DELETE via `people_delete_editor`. Non-editors
-- calling this will see the function succeed but affect 0 rows -- the RLS
-- test in sub-task 6 will assert that policy-level rejection.
--
-- search_path = '' + fully-qualified identifiers per Supabase advisor pattern,
-- matching the style of create_tree_with_owner in 20260512073731_create_tree_fn.sql.
create or replace function public.delete_person_atomic(p_person_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.people where id = p_person_id;
end;
$$;
