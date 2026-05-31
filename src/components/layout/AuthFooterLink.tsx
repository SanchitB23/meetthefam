'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setState(data.user ? 'signed-in' : 'signed-out')
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

  // signed-in branch arrives in Task 2.
  return null
}
