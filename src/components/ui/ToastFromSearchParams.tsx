'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { notify } from '@/lib/toast/notify'
import { mapErrorCode } from '@/lib/errors'

// Bridges Server-Action redirects that carry `?error=<code>` into an error
// toast, then strips the param so a refresh doesn't re-fire it.
export function ToastFromSearchParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const fired = useRef(false)
  useEffect(() => {
    const error = params.get('error')
    if (!error || fired.current) return
    fired.current = true
    notify.error(mapErrorCode(error))
    const next = new URLSearchParams(params)
    next.delete('error')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [params, router, pathname])
  return null
}
