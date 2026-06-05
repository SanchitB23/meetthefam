'use client'

import { useEffect, useRef } from 'react'
import { notify } from './notify'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }
  | { success: true }
  | { error: string }
  | null
  | undefined

export type ToastMessages = {
  success?: string
  error?: (code: string) => string
}

type Picked = { channel: 'success' | 'error'; message: string } | null

// Pure decision: given an action-state result + configured messages, which
// toast (if any) should fire. Unit-tested without a DOM.
export function pickToast(state: ActionResult, messages: ToastMessages): Picked {
  if (!state) return null
  const ok = 'ok' in state ? state.ok : 'success' in state ? state.success === true : false
  if (ok) {
    return messages.success ? { channel: 'success', message: messages.success } : null
  }
  if ('error' in state && state.error && messages.error) {
    return { channel: 'error', message: messages.error(state.error) }
  }
  return null
}

// Adapter for `useActionState` call sites: fires a toast once per new
// terminal result (deduped by object identity so re-renders don't re-fire).
export function useToastOnResult(state: ActionResult, messages: ToastMessages): void {
  const seen = useRef<ActionResult>(null)
  useEffect(() => {
    if (!state || state === seen.current) return
    seen.current = state
    const picked = pickToast(state, messages)
    if (picked) notify[picked.channel](picked.message)
  }, [state, messages])
}
