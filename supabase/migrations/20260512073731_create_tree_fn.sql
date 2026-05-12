-- Atomically insert into trees + tree_members in a single transaction.
-- SECURITY DEFINER + locked search_path (Supabase advisor pattern).
create or replace function public.create_tree_with_owner(
  p_name        text,
  p_description text,
  p_owner_id    uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tree_id uuid;
begin
  if (select auth.uid()) != p_owner_id then
    raise exception 'Caller must be the owner';
  end if;

  insert into public.trees (name, description, owner_id)
  values (p_name, p_description, p_owner_id)
  returning id into v_tree_id;

  insert into public.tree_members (tree_id, user_id, role)
  values (v_tree_id, p_owner_id, 'owner');

  return v_tree_id;
end;
$$;
