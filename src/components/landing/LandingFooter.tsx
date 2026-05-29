import Link from 'next/link'

// Hosted status page (BetterStack). Set NEXT_PUBLIC_STATUS_URL in Vercel once
// the BetterStack page is live — the "Status" link only renders when it's set,
// so no dead link ships before launch. See docs/dev/prod-readiness.md §10.
const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL

export function LandingFooter() {
  return (
    <footer className="px-6 py-12 text-center text-muted-foreground text-sm">
      <p className="font-serif italic text-base mb-4">
        Made for the people who already know each other.
      </p>
      <p>
        <Link href="/login" className="underline hover:text-foreground">
          Sign in
        </Link>
        {STATUS_URL ? (
          <>
            {' · '}
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
      </p>
    </footer>
  )
}
