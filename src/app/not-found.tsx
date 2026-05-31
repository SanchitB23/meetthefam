// Root not-found boundary — the heirloom-styled replacement for Next.js's
// stock dark-themed 404. Handles genuinely-unknown URLs (the implicit
// `/_not-found` route), which render in the BARE root layout, so this boundary
// supplies its own chrome via `<StatusPageShell>` (logo header + SiteFooter).
//
// `notFound()` thrown from inside the authenticated `(app)` group resolves at
// the closer `src/app/(app)/not-found.tsx` instead — that one renders bare,
// because the `(app)` layout already provides the header + footer. The shared
// body lives in `<NotFoundContent>` so the two boundaries can't drift.
//
// Server Component — checks the session so the CTA matches the visitor's auth
// state: signed-in users get "Back to dashboard", anonymous visitors "Sign in".
// See ADR 0008 for the design-token rationale.

import { NotFoundContent } from '@/components/layout/NotFoundContent'
import { StatusPageShell } from '@/components/layout/StatusPageShell'
import { createClient } from '@/lib/supabase/server'

export default async function NotFound() {
  // Auth boundary mirror: same `supabase.auth.getUser()` shape the tree page +
  // dashboard use. Failures (no session, expired token, RLS-gated) all collapse
  // to "no user" → show the Sign-in CTA.
  let isSignedIn = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isSignedIn = Boolean(user)
  } catch {
    // Defensive — `createClient()` shouldn't throw, but if it does we fall back
    // to the anonymous CTA rather than leak a server error out of the boundary.
    isSignedIn = false
  }

  return (
    <StatusPageShell>
      <NotFoundContent isSignedIn={isSignedIn} />
    </StatusPageShell>
  )
}
