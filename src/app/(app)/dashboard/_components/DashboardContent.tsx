import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/baseUrl'
import { TreeCard, type TreeRow } from './TreeCard'
import { TreeCardMenu } from './TreeCardMenu'

type Membership = {
  role: 'owner' | 'editor'
  trees: TreeRow | null
}

/**
 * Server component that runs the tree_members query and renders the dashboard
 * body. Mounted inside a <Suspense> in DashboardPage so the auth gate paints
 * immediately while this slower data fetch streams.
 *
 * Phase 8c-4: splits the data-fetch from the auth gate per the Suspense
 * boundary pattern (part of closing #50).
 */
export async function DashboardContent({ userId }: { userId: string }) {
  const supabase = await createClient()
  const baseUrl = await getBaseUrl()

  // `tree_members.tree_id` is a single FK to `trees.id` (many-to-one), so
  // `trees` is a single row per membership. Supabase's generic inference
  // sometimes widens embedded joins to arrays — cast via `.returns<...>()`
  // to keep the call-site shape correct.
  const { data: memberships } = await supabase
    .from('tree_members')
    .select(`
      role,
      trees (
        id, name, description, owner_id, created_at, updated_at, share_token
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .returns<Membership[]>()

  const trees = (memberships ?? []).filter(
    (m): m is Membership & { trees: TreeRow } => m.trees !== null,
  )

  // Header ("Your Trees" + New-tree modal) now lives in the page shell above
  // the Suspense boundary; this component renders only the data-dependent grid.
  return trees.length === 0 ? (
    <div className="text-center py-16 text-foreground/50">
      <p className="font-serif text-xl mb-2">No trees yet</p>
      <p className="text-sm">Create your first family tree to get started.</p>
    </div>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trees.map((m) => (
        <TreeCard
          key={m.trees.id}
          tree={m.trees}
          role={m.role}
          actions={
            m.role === 'owner' ? <TreeCardMenu tree={m.trees} baseUrl={baseUrl} /> : null
          }
        />
      ))}
    </div>
  )
}
