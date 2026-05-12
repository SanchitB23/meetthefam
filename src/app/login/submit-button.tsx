'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

type Props = {
  children: React.ReactNode
  pendingText?: string
  variant?: 'default' | 'outline'
}

export function SubmitButton({
  children,
  pendingText = 'Loading…',
  variant = 'default',
}: Props) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant={variant}
      className="w-full"
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
