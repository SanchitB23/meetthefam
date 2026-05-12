-- Phase 3 sub-task 4: linking-after-creation atomic RPCs.
--
-- Three plpgsql functions that span multiple UPDATEs in a single transaction
-- so spouse symmetry + cycle detection are genuinely atomic. Server Actions
-- can't span SQL statements transactionally; RPC is the only path to that.
--
-- All three are SECURITY INVOKER so the caller's session-level RLS on
-- public.people still gates every row touched. The matching policy is
-- `people_update_editor` in 20260511034131_initial_schema.sql -- non-editors
-- calling these will see the function "succeed" (no Postgres error) but the
-- UPDATEs will affect 0 rows. The RLS test suite asserts that policy-level
-- rejection directly.
--
-- search_path = '' + fully-qualified identifiers per Supabase advisor pattern,
-- matching the style of create_tree_with_owner and delete_person_atomic.

-- ============================================================================
-- 1. set_spouse_atomic(p_person_a, p_person_b)
-- ============================================================================
-- Set a bidirectional A<->B spouse bond, clearing whatever prior bond either
-- side had. Order matters: we clear priors FIRST so a transition like
-- A<->B  =>  A<->C cleanly nulls B's pointer before A starts pointing at C.
--
-- Defensive checks:
--   * Reject self-spouse (UI should already guard, but DB invariant is cheap).
--   * Reject cross-tree pairing -- a spouse bond that crosses tree_id makes
--     no semantic sense and would break Phase 4's tree-scoped queries.
create or replace function public.set_spouse_atomic(
  p_person_a uuid,
  p_person_b uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tree_count int;
  v_row_count  int;
begin
  if p_person_a = p_person_b then
    raise exception 'Cannot set a person as their own spouse.' using errcode = 'P0001';
  end if;

  -- Confirm both rows exist AND share a tree_id. The aggregate hits each row
  -- exactly once: count(*) = 2 proves existence, count(distinct tree_id) = 1
  -- proves they share a tree.
  select count(*), count(distinct tree_id)
    into v_row_count, v_tree_count
    from public.people
   where id in (p_person_a, p_person_b);

  if v_row_count <> 2 or v_tree_count <> 1 then
    raise exception 'Spouses must belong to the same family tree.' using errcode = 'P0001';
  end if;

  -- Clear prior spouse on either side (skipping the to-be-set bond).
  update public.people set spouse_id = null
   where spouse_id = p_person_a and id <> p_person_b;
  update public.people set spouse_id = null
   where spouse_id = p_person_b and id <> p_person_a;

  -- Set the new bidirectional bond.
  update public.people set spouse_id = p_person_b where id = p_person_a;
  update public.people set spouse_id = p_person_a where id = p_person_b;
end;
$$;

-- ============================================================================
-- 2. set_parents_atomic(p_person_id, p_father_id, p_mother_id)
-- ============================================================================
-- Set (or clear, via NULL) father_id / mother_id on a person, with an
-- ancestor-cycle check.
--
-- Decision #6 in the plan: cycle detection is ancestor-only. Spouse-self /
-- spouse-of-ancestor are handled as UI guards in the person picker, not DB
-- rejections.
--
-- Cycle detection runs as a recursive CTE seeded with the two NEW parents and
-- walking up via father_id + mother_id. We use UNION (not UNION ALL) so any
-- pre-existing cycle in the data dedupes and the recursion terminates.
create or replace function public.set_parents_atomic(
  p_person_id uuid,
  p_father_id uuid,
  p_mother_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_tree uuid;
  v_father_tree uuid;
  v_mother_tree uuid;
  v_cycle_id    uuid;
begin
  -- Self-as-parent guard.
  if p_father_id = p_person_id or p_mother_id = p_person_id then
    raise exception 'Cannot set a person as their own parent.' using errcode = 'P0001';
  end if;

  -- Same-tree guard: any non-null parent must share tree_id with the target.
  select tree_id into v_person_tree from public.people where id = p_person_id;
  if v_person_tree is null then
    -- Target row doesn't exist (or RLS hid it). Either way, nothing to do --
    -- the final UPDATE will affect 0 rows. Bail early so we don't run an
    -- expensive ancestor walk on a missing target.
    return;
  end if;

  if p_father_id is not null then
    select tree_id into v_father_tree from public.people where id = p_father_id;
    if v_father_tree is null or v_father_tree <> v_person_tree then
      raise exception 'Parents must belong to the same family tree as the person.' using errcode = 'P0001';
    end if;
  end if;

  if p_mother_id is not null then
    select tree_id into v_mother_tree from public.people where id = p_mother_id;
    if v_mother_tree is null or v_mother_tree <> v_person_tree then
      raise exception 'Parents must belong to the same family tree as the person.' using errcode = 'P0001';
    end if;
  end if;

  -- Ancestor-cycle check. Walk up from each new parent via father_id / mother_id.
  -- If p_person_id appears anywhere up that chain, the proposed link would
  -- make the person a descendant of themselves.
  if p_father_id is not null or p_mother_id is not null then
    with recursive ancestors(id) as (
      -- Base: the two NEW parents themselves (filter nulls).
      select pf.id
        from public.people pf
       where pf.id in (p_father_id, p_mother_id)
         and pf.id is not null
      union  -- UNION (not UNION ALL) terminates even on pre-existing cycles.
      -- Step: chase father_id AND mother_id of every ancestor we've seen.
      -- For each ancestor row a, emit any non-null pp where pp.id matches
      -- a's father_id or mother_id -- one row per parent link.
      select pp.id
        from public.people a_row
        join ancestors a on a.id = a_row.id
        join public.people pp on pp.id = a_row.father_id or pp.id = a_row.mother_id
    )
    select id into v_cycle_id from ancestors where id = p_person_id limit 1;

    if v_cycle_id is not null then
      raise exception 'This would create a circular ancestry.' using errcode = 'P0001';
    end if;
  end if;

  update public.people
     set father_id = p_father_id,
         mother_id = p_mother_id
   where id = p_person_id;
end;
$$;

-- ============================================================================
-- 3. clear_spouse_atomic(p_person_id)
-- ============================================================================
-- Null both ends of whatever spouse bond this person was part of. No
-- validation needed -- clearing is always safe. The first UPDATE handles any
-- row that pointed AT this person; the second clears this person's own pointer.
-- Idempotent when called on a person with no spouse (both UPDATEs touch 0 rows).
create or replace function public.clear_spouse_atomic(p_person_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.people set spouse_id = null where spouse_id = p_person_id;
  update public.people set spouse_id = null where id = p_person_id;
end;
$$;
