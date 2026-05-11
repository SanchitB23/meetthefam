-- meetthefam initial schema
-- Phase 0 sub-task 4: profiles, trees, tree_members, people + RLS + tone trigger + profile-on-signup.
--
-- References:
--   docs/architecture/data-model.md         -- table shapes, FK rationale, 20-column people
--   docs/architecture/auth-and-rls.md       -- per-table policy intent (source of truth)
--   docs/ux/avatars-and-tones.md            -- tone enum + deterministic hash assignment
--   docs/adrs/0008-design-system.md         -- rationale for the tone column / seed plan
--
-- Conventions:
--   * Every table has RLS enabled.
--   * Every mutating policy has BOTH `USING` and `WITH CHECK`.
--   * No anonymous-role write paths. The /share/[token] read path uses service_role
--     in a Route Handler (Phase 7), so we do NOT add an anon-read RLS policy here.
--   * SECURITY DEFINER functions explicitly set `search_path = ''` and fully qualify
--     identifiers to defend against search_path attacks (Supabase advisor guidance).

-- ============================================================================
-- 1. trees (created first so helper functions referencing it compile cleanly)
-- ============================================================================
create table public.trees (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  share_token  text unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index trees_owner_id_idx on public.trees (owner_id);

alter table public.trees enable row level security;

-- ============================================================================
-- 2. tree_members (created before helper fns so they can reference it)
-- ============================================================================
create table public.tree_members (
  tree_id    uuid not null references public.trees(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'editor')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  primary key (tree_id, user_id)
);

create index tree_members_user_id_idx on public.tree_members (user_id);

alter table public.tree_members enable row level security;

-- ============================================================================
-- 3. Helper functions: membership / ownership checks
-- ============================================================================
-- SECURITY DEFINER + locked search_path lets these run consistently from RLS
-- contexts where the caller might not be able to SELECT from tree_members
-- directly (also avoids RLS recursion when called from tree_members policies).

create or replace function public.is_tree_member(p_tree_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tree_members tm
     where tm.tree_id = p_tree_id
       and tm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_tree_editor(p_tree_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tree_members tm
     where tm.tree_id = p_tree_id
       and tm.user_id = (select auth.uid())
       and tm.role in ('owner', 'editor')
  );
$$;

create or replace function public.is_tree_owner(p_tree_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.trees t
     where t.id = p_tree_id
       and t.owner_id = (select auth.uid())
  );
$$;

-- ============================================================================
-- 4. profiles -- 1:1 extension of auth.users
-- ============================================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SELECT: public (we may show display_name in members lists).
create policy "profiles_select_public"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- INSERT: only your own row. (Normally the trigger handles this, but allow
-- direct insert too in case a future Server Action backfills.)
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (id = (select auth.uid()));

-- Profile-on-signup trigger. Standard Supabase pattern.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 5. RLS policies on trees
-- ============================================================================
-- SELECT: caller is owner OR a member.
create policy "trees_select_owner_or_member"
  on public.trees
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_tree_member(id)
  );

-- INSERT: caller is creating a tree they own.
create policy "trees_insert_owner"
  on public.trees
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- UPDATE: caller is the owner.
create policy "trees_update_owner"
  on public.trees
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- DELETE: caller is the owner.
create policy "trees_delete_owner"
  on public.trees
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ============================================================================
-- 6. RLS policies on tree_members
-- ============================================================================
-- SELECT: caller is the user_id of the row, OR caller owns the tree.
-- Referencing trees.owner_id (via is_tree_owner) avoids self-recursion on
-- tree_members; the helper is SECURITY DEFINER so it bypasses caller's RLS.
create policy "tree_members_select_self_or_owner"
  on public.tree_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_tree_owner(tree_id)
  );

-- INSERT: caller owns the tree.
create policy "tree_members_insert_owner"
  on public.tree_members
  for insert
  to authenticated
  with check (public.is_tree_owner(tree_id));

-- UPDATE: caller owns the tree (role changes etc).
create policy "tree_members_update_owner"
  on public.tree_members
  for update
  to authenticated
  using (public.is_tree_owner(tree_id))
  with check (public.is_tree_owner(tree_id));

-- DELETE: caller owns the tree OR caller is leaving themselves.
create policy "tree_members_delete_owner_or_self"
  on public.tree_members
  for delete
  to authenticated
  using (
    public.is_tree_owner(tree_id)
    or user_id = (select auth.uid())
  );

-- ============================================================================
-- 7. people
-- ============================================================================
create table public.people (
  id           uuid primary key default gen_random_uuid(),
  tree_id      uuid not null references public.trees(id) on delete cascade,
  full_name    text not null,
  nickname     text,
  gender       text not null default 'unknown' check (gender in ('m', 'f', 'other', 'unknown')),
  photo_url    text,
  bio          text,
  birth_year   int,
  birth_date   date,
  location     text,
  occupation   text,
  deceased     boolean not null default false,
  death_year   int,
  father_id    uuid references public.people(id) on delete set null,
  mother_id    uuid references public.people(id) on delete set null,
  spouse_id    uuid references public.people(id) on delete set null,
  tone         text not null check (tone in ('sage', 'rose', 'indigo', 'amber', 'green')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index people_tree_id_idx   on public.people (tree_id);
create index people_father_id_idx on public.people (father_id);
create index people_mother_id_idx on public.people (mother_id);
create index people_spouse_id_idx on public.people (spouse_id);

alter table public.people enable row level security;

-- SELECT: caller owns the tree OR is a member of it.
create policy "people_select_member"
  on public.people
  for select
  to authenticated
  using (public.is_tree_member(tree_id));

-- INSERT / UPDATE / DELETE: caller is owner or editor on the tree.
create policy "people_insert_editor"
  on public.people
  for insert
  to authenticated
  with check (public.is_tree_editor(tree_id));

create policy "people_update_editor"
  on public.people
  for update
  to authenticated
  using (public.is_tree_editor(tree_id))
  with check (public.is_tree_editor(tree_id));

create policy "people_delete_editor"
  on public.people
  for delete
  to authenticated
  using (public.is_tree_editor(tree_id));

-- ============================================================================
-- 8. Triggers: deterministic tone + updated_at
-- ============================================================================
-- Deterministic tone auto-assignment on insert.
-- abs(hashtext(full_name)) % 5 indexed into the fixed TONE_ORDER array.
-- Deterministic so re-importing the same tree produces the same tones, and so
-- two people with the same name share a tone (no flicker between renders).
-- abs() guards against hashtext returning a negative int4.
create or replace function public.assign_default_tone()
returns trigger
language plpgsql
as $$
declare
  tone_order text[] := array['sage', 'rose', 'indigo', 'amber', 'green'];
begin
  if new.tone is null then
    new.tone := tone_order[1 + (abs(hashtext(new.full_name)) % 5)];
  end if;
  return new;
end;
$$;

create trigger people_assign_default_tone
  before insert on public.people
  for each row execute function public.assign_default_tone();

-- Keep updated_at fresh on UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger people_touch_updated_at
  before update on public.people
  for each row execute function public.touch_updated_at();

create trigger trees_touch_updated_at
  before update on public.trees
  for each row execute function public.touch_updated_at();
