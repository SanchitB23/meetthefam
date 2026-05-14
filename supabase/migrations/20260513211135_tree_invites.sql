-- Phase 6 sub-task 1: tree_invites table + RLS + accept_invite RPC.
--
-- Foundation for the collaboration phase. An owner can mint an email-locked,
-- 7-day, single-use invite token; the invited user clicks the link, logs in
-- under the matching email, and is atomically added to tree_members as an
-- editor via the SECURITY DEFINER `accept_invite` RPC.
--
-- References:
--   docs/tasks/current-phase.md             -- Phase 6 locked plan
--   docs/architecture/data-model.md         -- existing tables (trees, tree_members)
--   docs/architecture/auth-and-rls.md       -- per-table policy intent
--   /Users/sqb6461/.claude/plans/let-s-brainstorm-and-plan-valiant-globe.md
--                                           -- Phase 6 brainstorm + data-model spec
--
-- Locked decisions (from the brainstorm):
--   * Email-locked, single-use, 7-day TTL.
--   * Tokens are URL-safe random bytes minted in the APPLICATION LAYER
--     (`encode(gen_random_bytes(32), 'base64')` with `=/+` stripped in the
--     Server Action) -- this migration does NOT include a token-mint helper.
--   * Owners only for SELECT / INSERT / UPDATE / DELETE; accept-flow bypasses
--     SELECT RLS via the SECURITY DEFINER `accept_invite` RPC.
--   * `tree_members.role` enum unchanged -- no 'viewer' yet (Phase 7's share
--     link handles read-only anon viewing).
--
-- Conventions matched to the existing migrations:
--   * RLS enabled on the new table; every mutating policy has both USING and
--     WITH CHECK; no `if not exists` guards on policies.
--   * SECURITY DEFINER + `set search_path = ''` + fully-qualified identifiers
--     on the RPC, matching create_tree_with_owner / is_tree_owner style.
--   * Email is lowercased via a BEFORE INSERT/UPDATE trigger (CHECK constraints
--     can't mutate NEW; the trigger is the standard pattern and keeps the
--     partial unique index's `lower(email)` consistent with what's stored).

-- ============================================================================
-- 1. tree_invites table
-- ============================================================================
create table public.tree_invites (
  id           uuid primary key default gen_random_uuid(),
  tree_id      uuid not null references public.trees(id) on delete cascade,
  email        text not null,                                  -- normalised to lower() via trigger
  token        text not null unique,                           -- 32-byte URL-safe random, minted in the Server Action
  role         text not null default 'editor' check (role = 'editor'),
  invited_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id),
  revoked_at   timestamptz
);

-- Lookup by tree_id is the dominant read pattern (MembersSheet pending-invites list).
create index tree_invites_tree_id_idx on public.tree_invites (tree_id);

-- At most one OPEN invite per (tree, email). `accepted_at is null and
-- revoked_at is null` is the "open" predicate; once an invite is accepted or
-- revoked it falls out of the unique constraint, so the owner can re-invite
-- the same email later. `lower(email)` matches the trigger-enforced storage.
create unique index tree_invites_open_per_email
  on public.tree_invites (tree_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.tree_invites enable row level security;

-- ============================================================================
-- 2. Email-lowercase trigger
-- ============================================================================
-- Postgres CHECK constraints can't mutate the row, so we can't write
-- `check (email = lower(email))` AND have the column auto-normalise. A
-- BEFORE INSERT/UPDATE trigger sets NEW.email = lower(NEW.email) so the
-- partial unique index's `lower(email)` expression matches stored data
-- byte-for-byte; callers can pass any case and the DB normalises.
create or replace function public.lowercase_invite_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$$;

create trigger tree_invites_lowercase_email
  before insert or update on public.tree_invites
  for each row execute function public.lowercase_invite_email();

-- ============================================================================
-- 3. RLS policies on tree_invites
-- ============================================================================
-- All four policies gate on `is_tree_owner(tree_id)`. The accept-flow does NOT
-- go through SELECT here -- it uses the SECURITY DEFINER `accept_invite` RPC
-- below, which bypasses RLS to look up the invite by token. This is deliberate:
-- the invitee is not a tree member yet, so they have no SELECT rights on the
-- invite; the RPC is the only legitimate way they touch the row.
create policy "tree_invites_select_owner"
  on public.tree_invites
  for select
  to authenticated
  using (public.is_tree_owner(tree_id));

create policy "tree_invites_insert_owner"
  on public.tree_invites
  for insert
  to authenticated
  with check (public.is_tree_owner(tree_id));

create policy "tree_invites_update_owner"
  on public.tree_invites
  for update
  to authenticated
  using (public.is_tree_owner(tree_id))
  with check (public.is_tree_owner(tree_id));

create policy "tree_invites_delete_owner"
  on public.tree_invites
  for delete
  to authenticated
  using (public.is_tree_owner(tree_id));

-- ============================================================================
-- 4. accept_invite(p_token text) RPC
-- ============================================================================
-- SECURITY DEFINER so it bypasses the invitee's lack of SELECT rights on
-- tree_invites (they're not a member yet) and can INSERT into tree_members
-- without needing to satisfy `tree_members_insert_owner`. The function
-- runs as `postgres` (the migration owner); ownership is set explicitly
-- below to lock that down.
--
-- Validation order matters -- the same row can be in multiple "bad" states
-- and the error returned should reflect the FIRST failing check so the UI
-- can show the most actionable message. Order is fixed at:
--   1. not_found       -- token doesn't exist
--   2. revoked         -- owner revoked the invite (most-actionable: owner's call)
--   3. expired         -- TTL elapsed (most-actionable: ask for resend)
--   4. email_mismatch  -- wrong account; tells the user to switch logins
--   5. already_accepted-- nothing to do; treat as soft success at the action layer
--
-- Idempotency: if the invitee was somehow already in tree_members (e.g. they
-- were added via another path), the ON CONFLICT (tree_id, user_id) DO NOTHING
-- swallows the insert and we still mark the invite accepted. The Server Action
-- treats "already a member" as success.
--
-- Return shape: single-column jsonb so the Server Action reads `data.tree_id`
-- uniformly. Errors are raised as P0001 with the friendly tag as the message
-- text -- the Server Action pattern-matches on the message to translate to
-- user-facing copy. (Existing RPCs in this project return `void` and use the
-- same P0001 + message convention; this is the first one that needs a payload,
-- hence jsonb.)
--
-- `search_path = ''` + fully-qualified identifiers per Supabase advisor
-- guidance, matching the helper functions above and create_tree_with_owner.
create or replace function public.accept_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite       public.tree_invites%rowtype;
  v_user_id      uuid := (select auth.uid());
  v_user_email   text;
  v_was_member   boolean;
begin
  if v_user_id is null then
    -- Caller is not authenticated. RPCs are exposed to anon by default, so we
    -- gate explicitly. Surface as not_found rather than leaking the existence
    -- of the token to anon callers.
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- 1. Look up by token. No RLS interference (SECURITY DEFINER runs as postgres).
  select * into v_invite
    from public.tree_invites
   where token = p_token;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- 2. Revoked beats every other bad state -- owner explicitly killed this link.
  if v_invite.revoked_at is not null then
    raise exception 'revoked' using errcode = 'P0001';
  end if;

  -- 3. Expired -- TTL elapsed.
  if v_invite.expires_at <= now() then
    raise exception 'expired' using errcode = 'P0001';
  end if;

  -- 4. Email match. Pull the caller's email from auth.users and compare
  --    case-insensitively. v_invite.email is already lowercase (trigger), so
  --    the lower() on the left side is defensive only.
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null or lower(v_invite.email) <> lower(v_user_email) then
    raise exception 'email_mismatch' using errcode = 'P0001';
  end if;

  -- 5. Already accepted.
  if v_invite.accepted_at is not null then
    raise exception 'already_accepted' using errcode = 'P0001';
  end if;

  -- Insert the membership row. ON CONFLICT handles the "user was already a
  -- member via some other path" edge case idempotently. v_was_member captures
  -- whether the row pre-existed (i.e. no insert happened); we treat that as
  -- success either way and mark the invite accepted.
  insert into public.tree_members (tree_id, user_id, role, invited_by, joined_at)
  values (v_invite.tree_id, v_user_id, 'editor', v_invite.invited_by, now())
  on conflict (tree_id, user_id) do nothing;

  get diagnostics v_was_member = row_count;
  -- v_was_member = 1 means insert happened; 0 means the row already existed.
  -- Either is fine; we mark the invite accepted below regardless.

  update public.tree_invites
     set accepted_at = now(),
         accepted_by = v_user_id
   where id = v_invite.id;

  return jsonb_build_object('tree_id', v_invite.tree_id);
end;
$$;

-- Lock function owner to postgres so SECURITY DEFINER runs with predictable
-- privileges across local / QA / prod (the migration runner is `postgres`
-- on all three).
alter function public.accept_invite(text) owner to postgres;

-- The function needs to be callable by authenticated users. Anon is excluded
-- on purpose -- the not-logged-in branch above is belt-and-braces.
revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
