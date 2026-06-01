'use client'

// #187 — wrap the signOut server action with startViewTransition so the
// (app)/... → landing page swap cross-fades instead of cutting instantly.
//
// We switch from the declarative <form action={signOut}> + useFormStatus
// pattern to an onClick + useTransition handler. The transition:
//   1. Calls document.startViewTransition (Chrome 111+, Safari 18+, FF 132+).
//   2. Inside that callback, kicks React's useTransition to run signOut
//      as a server action (same semantics as the old formAction path, but
//      now coordinated with the view-transition animation window).
//
// Fallback for unsupported browsers: startViewTransition() in
// src/lib/view-transition.ts calls the callback directly, so the button
// works as before with an instant swap.

import { useTransition } from 'react'
import { signOut } from '@/lib/actions/signOut'
import { startViewTransition } from '@/lib/view-transition'

export function SignOutButton() {
  const [isPending, startTransition] = useTransition()

  const handleSignOut = () => {
    startViewTransition(() => {
      startTransition(async () => {
        await signOut()
      })
    })
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="text-sm text-foreground/60 underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
