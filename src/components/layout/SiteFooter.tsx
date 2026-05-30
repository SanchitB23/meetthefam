import Link from 'next/link'

// Hosted status page (BetterStack). Set NEXT_PUBLIC_STATUS_URL in Vercel once
// the BetterStack page is live — the "Status" link only renders when it's set,
// so no dead link ships before launch. See docs/dev/prod-readiness.md §10.
const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL

/**
 * SiteFooter — the shared footer for every chrome.
 *
 * Consumed by the (legal) route-group layout, the landing page, and the (app)
 * layout. Carries the heirloom tagline plus the policy + contact links that
 * docs/dev/prod-readiness.md §8 requires before v1.0 launch. Replaces the old
 * landing-only LandingFooter.
 */
export function SiteFooter() {
  return (
    <footer className="px-6 py-12 text-center text-muted-foreground text-sm">
      <p className="font-serif italic text-base mb-4">
        Made for the people who already know each other.
      </p>
      <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="underline hover:text-foreground">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact" className="underline hover:text-foreground">
          Contact
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/about" className="underline hover:text-foreground">
          About
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/login" className="underline hover:text-foreground">
          Sign in
        </Link>
        {STATUS_URL ? (
          <>
            <span aria-hidden="true">·</span>
            <a
              href={STATUS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Status
            </a>
          </>
        ) : null}
      </nav>
    </footer>
  )
}
