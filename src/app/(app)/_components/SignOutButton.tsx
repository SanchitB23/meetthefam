'use client'

import { useFormStatus } from 'react-dom'
import { signOut } from '@/lib/actions/signOut'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm text-foreground/60 underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <SubmitButton />
    </form>
  )
}
