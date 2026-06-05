'use client'

import type { ReactNode } from 'react'
import { toast } from 'sonner'

// Per-channel auto-dismiss (ms). Error is sticky — dismiss only.
const DURATION = { success: 2000, info: 4000, warning: 6000 } as const

export type NotifyAction = { label: string; onClick: () => void }
export type NotifyOptions = { description?: ReactNode; action?: NotifyAction }

export const notify = {
  success(message: string, opts?: NotifyOptions) {
    return toast.success(message, { duration: DURATION.success, ...opts })
  },
  info(message: string, opts?: NotifyOptions) {
    return toast.info(message, { duration: DURATION.info, ...opts })
  },
  warning(message: string, opts?: NotifyOptions) {
    return toast.warning(message, { duration: DURATION.warning, ...opts })
  },
  error(message: string, opts?: NotifyOptions) {
    return toast.error(message, { duration: Infinity, ...opts })
  },
}
