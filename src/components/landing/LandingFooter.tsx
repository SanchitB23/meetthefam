import Link from 'next/link'

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
      </p>
    </footer>
  )
}
