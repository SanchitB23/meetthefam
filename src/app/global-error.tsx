'use client'

import { Cormorant_Garamond, Manrope } from 'next/font/google'
import { useEffect } from 'react'

import './globals.css'

// global-error.tsx — the root-layout crash boundary. Unlike error.tsx (which
// catches errors *within* the root layout's children), this fires when the
// root layout ITSELF throws, so Next.js unmounts everything — including
// src/app/layout.tsx. It must therefore render its own <html>/<body> and
// re-establish the heirloom chrome from scratch: globals.css for the tokens
// plus the same next/font setup as the root layout, so `font-serif` /
// `font-sans` still resolve even with the layout dead. No <SiteFooter> or
// <Link> here — routing context is unreliable in this boundary, so recovery
// is a plain reset(). Active in production only (the dev overlay shows in dev).

const manrope = Manrope({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

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
    <html
      lang="en"
      className={`${manrope.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex items-center justify-center bg-background px-6 py-16">
        <div className="max-w-md w-full text-center">
          <p className="font-serif italic text-base text-muted-foreground mb-3">
            Something went wrong
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
            The app ran into a problem
          </h1>
          <p className="font-sans text-base text-muted-foreground mb-8 leading-relaxed">
            A part of meetthefam failed to load. Try again, and if it keeps
            happening, refresh the page in a few minutes.
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
      </body>
    </html>
  )
}
