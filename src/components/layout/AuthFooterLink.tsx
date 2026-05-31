'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/app/(app)/_actions/signOut'

type AuthState = 'loading' | 'signed-in' | 'signed-out'

/**
 * Auth link slot for <SiteFooter>. Renders nothing while reading auth
 * (avoids a "Sign in" flash for authed visitors on the statically-rendered
 * (legal) pages), then resolves to either a Sign-in link or a Sign-out
 * form on hydration. Encapsulates its own leading middot separator so
 * SiteFooter doesn't render an orphan dot while we're loading.
 */
export function AuthFooterLink() {
  const [state, setState] = useState<AuthState>('loading')

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return
        setState(data.user ? 'signed-in' : 'signed-out')
      })
      .catch(() => {
        // Fail-open: a network / CORS / Supabase error means we couldn't read auth,
        // so render the signed-out state and keep the Sign-in link reachable rather
        // than getting stuck in the loading null state (which would also surface as
        // an unhandled rejection in the console).
        if (cancelled) return
        setState('signed-out')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return null
  }

  if (state === 'signed-out') {
    return (
      <>
        <span aria-hidden="true">·</span>
        <Link href="/login" className="underline hover:text-foreground">
          Sign in
        </Link>
      </>
    )
  }

  // signed-in branch — reuse the existing server action used by SignOutButton
  // (src/app/(app)/_components/SignOutButton.tsx) so we get identical cookie
  // cleanup + redirect-to-/login behavior. The button is styled to match
  // surrounding underlined footer links rather than the nav's button chrome.
  return (
    <>
      <span aria-hidden="true">·</span>
      <form action={signOut} className="contents">
        <button
          type="submit"
          className="cursor-pointer underline hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </>
  )
}
