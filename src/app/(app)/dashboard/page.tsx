import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Leaf } from '@/components/icons/Leaf'
import { DashboardContent } from './_components/DashboardContent'
import { CreateTreeModal } from './_components/CreateTreeModal'
import { DashboardListSkeleton } from './_components/DashboardListSkeleton'

/**
 * Auth gate runs up here (synchronous before Suspense) so an unauthenticated
 * request redirects immediately rather than streaming a skeleton then 404ing.
 *
 * The static page header ("Your Trees" + New-tree modal) renders in the shell
 * above the <Suspense> boundary — it has no data dependency, so it paints with
 * the shell instead of waiting on the tree_members query. Only the
 * data-dependent grid streams behind <DashboardListSkeleton>. Perf #249.
 *
 * Phase 8c-4: Suspense boundary pattern (part of closing #50).
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  // getClaims() validates the session JWT from the cookie locally (no Supabase
  // round-trip), unlike getUser() which makes a network call. proxy.ts already
  // gates /dashboard for unauthenticated requests, so this is purely the
  // in-page user.id read — dropping the pre-shell RTT off the critical path.
  // Perf #249.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/login')

  return (
    <main className="px-4 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-foreground flex items-center gap-2">
          <Leaf size={22} className="text-primary" />
          Your Trees
        </h1>
        <CreateTreeModal />
      </div>

      <Suspense fallback={<DashboardListSkeleton />}>
        <DashboardContent userId={userId} />
      </Suspense>
    </main>
  )
}
