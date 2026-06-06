'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorAlert } from '@/components/ui/error-alert'

// Listens for `mtf-access-lost` (dispatched when a Server Action returns
// `forbidden` mid-session) and shows a page-level banner + dashboard CTA.
export function AccessLostBanner() {
  const router = useRouter()
  const [lost, setLost] = useState(false)
  useEffect(() => {
    const handler = () => setLost(true)
    window.addEventListener('mtf-access-lost', handler)
    return () => window.removeEventListener('mtf-access-lost', handler)
  }, [])
  if (!lost) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 p-3">
      <ErrorAlert
        variant="banner"
        message="You no longer have access to this tree."
        action={
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-sm font-medium underline"
          >
            Go to dashboard
          </button>
        }
      />
    </div>
  )
}
