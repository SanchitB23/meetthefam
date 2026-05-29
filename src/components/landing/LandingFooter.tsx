import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="px-6 py-12 text-center text-muted-foreground text-sm">
      <p className="font-serif italic text-base mb-4">
        Made for the people who already know each other.
      </p>
      <p className="flex items-center justify-center gap-3">
        <Link href="/login" className="underline hover:text-foreground">
          Sign in
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/sanchitb23/meetthefam/blob/main/STATUS.md"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Status
        </a>
      </p>
    </footer>
  )
}
