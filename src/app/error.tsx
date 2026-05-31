'use client'

import { useEffect } from 'react'

import { StatusPageShell } from '@/components/layout/StatusPageShell'

// App-level error boundary — catches errors thrown within the root layout's
// children and replaces the failed segment with this branded, heirloom-styled
// fallback. NOT the root-layout crash boundary: when the root layout ITSELF
// throws, `src/app/global-error.tsx` takes over instead. Named `AppError` to
// disambiguate from that sibling.
export default function AppError({
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
    <StatusPageShell>
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
    </StatusPageShell>
  )
}
