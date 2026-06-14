import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getBaseUrl } from '@/lib/baseUrl'
import { TreeContent } from './_components/TreeContent'
import TreeLoading from './loading'

type TreeRow = {
  id: string
  name: string
  description: string | null
  share_token: string | null
}

/**
 * Auth gate + permission gate run synchronously before the <Suspense> boundary
 * so unauthenticated / unauthorized requests redirect or 404 immediately rather
 * than streaming a skeleton and then failing.
 *
 * The bulk data fetch (members, profiles, invites, people) is deferred into
 * <TreeContent> behind a <Suspense> so the heirloom skeleton from 8c-3 paints
 * while the queries run.
 *
 * Phase 8c-4: Suspense boundary pattern (part of closing #50).
 */
export default async function TreePage(props: PageProps<'/tree/[id]'>) {
  // Phase 4 sub-task 5 — await both async APIs per ADR 0007. `?p=<uuid>`
  // seeds the tree's initial focus person; the FamilyTree client picks
  // a `#p=<uuid>` hash over this on mount when present (hash is the
  // single source of truth at runtime).
  const { id } = await props.params
  const sp = await props.searchParams
  const rawFocus = sp?.p
  const initialFocusId =
    typeof rawFocus === 'string' && rawFocus.length > 0 ? rawFocus : null

  const baseUrl = await getBaseUrl()

  const supabase = await createClient()

  // getUser() (auth validation) and the trees read are independent — the
  // trees RLS is enforced by the session cookie, not user.id — so run them
  // concurrently. tree_members below still needs user.id, so it follows.
  // 3 serial round-trips -> 2. Gate order/behaviour unchanged. Perf #249.
  const [
    {
      data: { user },
    },
    { data: tree },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('trees')
      .select('id, name, description, share_token')
      .eq('id', id)
      .maybeSingle<TreeRow>(),
  ])

  if (!user) redirect('/login')

  if (!tree) notFound()

  // Phase 6 sub-task 4 — fetch current user's role in this tree.
  // RLS ensures only tree members can read their own row; if the user is
  // not a member this returns null and we 404 (same effect as the tree
  // being inaccessible via the existing people RLS).
  const { data: myMembership } = await supabase
    .from('tree_members')
    .select('role')
    .eq('tree_id', id)
    .eq('user_id', user.id)
    .maybeSingle<{ role: 'owner' | 'editor' }>()

  if (!myMembership) notFound()

  const currentUserRole = myMembership.role

  return (
    <Suspense fallback={<TreeLoading />}>
      <TreeContent
        treeId={id}
        userId={user.id}
        tree={tree}
        currentUserRole={currentUserRole}
        initialFocusId={initialFocusId}
        baseUrl={baseUrl}
      />
    </Suspense>
  )
}
