'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

type Props = {
  children: React.ReactNode
  pendingText?: string
  variant?: 'default' | 'outline' | 'destructive'
  className?: string
}

/**
 * Submit button that auto-renders a spinner + disables itself while the
 * surrounding `<form action={...}>`'s Server Action is in flight. Reads
 * its pending state from `useFormStatus()`, which only works when the
 * component is rendered INSIDE a `<form>` — that's the React contract.
 *
 * Use this for any Server Action form where the action does meaningful
 * server work (DB roundtrip, redirect, RPC). Without it, the user sees
 * the button as idle during the in-flight window and double-clicks.
 */
export function SubmitButton({
  children,
  pendingText = 'Loading…',
  variant = 'default',
  className = 'w-full',
}: Props) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
