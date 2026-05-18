import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardContent } from './_components/DashboardContent'
import DashboardLoading from './loading'

/**
 * Auth gate runs up here (synchronous before Suspense) so an unauthenticated
 * request redirects immediately rather than streaming a skeleton then 404ing.
 * The data fetch is deferred into <DashboardContent> behind a <Suspense>
 * boundary so the heirloom skeleton from 8c-3 paints while the query runs.
 *
 * Phase 8c-4: Suspense boundary pattern (part of closing #50).
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent userId={user.id} />
    </Suspense>
  )
}
