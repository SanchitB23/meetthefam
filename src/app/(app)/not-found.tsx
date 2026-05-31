import { NotFoundContent } from '@/components/layout/NotFoundContent'

// not-found boundary for the authenticated `(app)` route group. `notFound()`
// thrown inside `(app)` (e.g. /tree/[id] when RLS hides the tree, or no
// membership) resolves HERE — the closest boundary — instead of bubbling to
// the root `src/app/not-found.tsx`.
//
// Critically it renders the message BARE: the `(app)` layout already provides
// the header (nav + Sign out) and `<SiteFooter>`, so wrapping in
// `<StatusPageShell>` (as the root boundary does) would render a SECOND header
// + footer. The not-found boundary, unlike an error boundary, stays nested in
// its parent layouts — so the chrome must not be repeated here.
//
// The `(app)` group is auth-gated by the proxy, so the visitor is always signed
// in here → "Back to dashboard" CTA, no Supabase round-trip needed.
export default function AppNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <NotFoundContent isSignedIn />
    </main>
  )
}
