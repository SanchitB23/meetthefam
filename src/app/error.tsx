'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <p className="font-serif italic text-base text-muted-foreground mb-3">
          Something went wrong
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
          An unexpected error occurred
        </h1>
        <p className="font-sans text-base text-muted-foreground mb-8 leading-relaxed">
          We could not complete your request. If this keeps happening, try
          refreshing the page.
        </p>
        <div className="flex justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  )
}
