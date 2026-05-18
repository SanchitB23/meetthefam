import Link from 'next/link'
import { Logo } from '@/components/icons/Logo'

export function LandingHero() {
  return (
    <section className="px-6 py-24 max-w-3xl mx-auto text-center">
      <div className="inline-flex items-center gap-3 mb-8 text-primary">
        <Logo size={48} />
      </div>
      {/* Italic Cormorant kicker — within the whitelist per ADR 0008. */}
      <p className="font-serif italic text-accent text-lg mb-4">
        meet the people who already know each other
      </p>
      <h1 className="font-serif text-5xl text-foreground leading-tight mb-6">
        Build a family tree<br />that feels like home.
      </h1>
      <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
        Names, photos, stories. Up to two hundred people, designed for warmth, not for genealogy power-users.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center h-12 px-8 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
      >
        Sign in to begin
      </Link>
    </section>
  )
}
