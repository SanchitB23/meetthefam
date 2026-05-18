import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
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

  const baseUrl = (await headers()).get('origin') ?? 'http://localhost:3000'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tree } = await supabase
    .from('trees')
    .select('id, name, description, share_token')
    .eq('id', id)
    .maybeSingle<TreeRow>()

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
