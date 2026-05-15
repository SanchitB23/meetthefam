import Link from 'next/link'

export default function ShareNotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-serif text-4xl text-foreground mb-3">
        Tree not found
      </h1>
      <p className="text-foreground/70 max-w-md mb-6">
        This share link is no longer active. The owner may have disabled sharing or rotated the link.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
      >
        Sign up to create your own tree →
      </Link>
    </main>
  )
}
