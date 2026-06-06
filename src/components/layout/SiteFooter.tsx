import Link from 'next/link'
import { AuthFooterLink } from '@/components/layout/AuthFooterLink'
import { Logo } from '@/components/icons/Logo'

// Hosted status page (BetterStack). Set NEXT_PUBLIC_STATUS_URL in Vercel once
// the BetterStack page is live — the "Status" link only renders when it's set,
// so no dead link ships before launch. See docs/dev/prod-readiness.md §10.
const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL

/**
 * SiteFooter — the shared footer for every chrome.
 *
 * Consumed by the (legal) route-group layout, the landing page, and the (app)
 * layout. Carries the heirloom tagline plus the policy + contact links that
 * docs/dev/prod-readiness.md §8 requires before v1.0 launch. The Sign-in /
 * Sign-out slot is a client island (<AuthFooterLink />) — keeps SiteFooter
 * server-rendered and preserves the (legal) route group's force-static mode.
 *
 * Standing convention: every PR that ships a new public (legal) / standard
 * page must add its <Link> here AND assert the href in SiteFooter.test.tsx.
 * See docs/superpowers/specs/2026-05-30-legal-pages-design.md → Sibling-page
 * checklist.
 *
 * The leading logo links to `/`. Signed-in visitors hit the landing page's
 * Server Component, which immediately `redirect()`s them to `/dashboard` —
 * so the same Link works for both audiences without a client island.
 */
export function SiteFooter() {
  return (
    <footer className="px-6 py-12 text-center text-muted-foreground text-sm">
      <Link
        href="/"
        aria-label="Home"
        className="mb-3 inline-block text-primary"
      >
        <Logo size={28} />
      </Link>
      <p className="font-serif italic text-base mb-4">
        Made for the people who already know each other.
      </p>
      <nav
        aria-label="Footer"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      >
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="underline hover:text-foreground">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/childrens-privacy" className="underline hover:text-foreground">
          Children&apos;s Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/dmca" className="underline hover:text-foreground">
          DMCA
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact" className="underline hover:text-foreground">
          Contact
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/faq" className="underline hover:text-foreground">
          FAQ
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/about" className="underline hover:text-foreground">
          About
        </Link>
        <AuthFooterLink />
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
