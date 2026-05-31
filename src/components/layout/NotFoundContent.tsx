import Link from 'next/link'

/**
 * NotFoundContent — the shared body of the branded 404 (kicker + heading +
 * blurb + auth-aware CTA). Rendered by BOTH not-found boundaries:
 *
 * - `src/app/not-found.tsx` (root) wraps it in `<StatusPageShell>` for global
 *   unmatched URLs, which render in the bare root layout and need their own
 *   header + footer chrome. That boundary resolves the live auth state.
 * - `src/app/(app)/not-found.tsx` renders it bare inside a centering `<main>`,
 *   because the authenticated `(app)` layout already supplies the header +
 *   `<SiteFooter>`. That group is auth-gated, so it passes `isSignedIn`.
 *
 * Sharing this component keeps the two boundaries from diverging — and the
 * `(app)` one staying bare prevents the duplicated header/footer that a single
 * StatusPageShell root boundary produced when `notFound()` fired inside `(app)`.
 *
 * Presentational + synchronous: the caller resolves `isSignedIn` so this can be
 * rendered as a child (async Server Components can't be rendered as children in
 * the unit-test renderer).
 */
export function NotFoundContent({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="max-w-md w-full text-center">
      <p className="font-serif italic text-base text-muted-foreground mb-3">
        Lost in the family tree?
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
        We couldn&rsquo;t find that page
      </h1>
      <p className="font-sans text-base text-muted-foreground mb-8 leading-relaxed">
        The page you were looking for isn&rsquo;t here, or you don&rsquo;t have
        access to it.
      </p>
      <div className="flex justify-center">
        <Link
          href={isSignedIn ? '/dashboard' : '/login'}
          className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {isSignedIn ? 'Back to dashboard' : 'Sign in'}
        </Link>
      </div>
    </div>
  )
}
