'use client'

import { useSyncExternalStore } from 'react'

// Shared hydration-safe media-query hook for the responsive
// `<Sheet>` (mobile) ↔ `<Dialog>` (desktop) swap pattern. Extracted from
// the inline implementation that originally lived in
// `src/app/tree/[id]/_components/PersonForm.tsx` so PersonPicker +
// SetParentsDialog can share the same source of truth.
//
// `useSyncExternalStore` is the idiomatic React 19 path for external
// sources — it avoids the `react-hooks/set-state-in-effect` lint warning
// you'd get with the naive `useState + useEffect` shape.

const DESKTOP_QUERY = '(min-width: 640px)'

function subscribeToMedia(callback: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches
}

function getServerSnapshot(): boolean {
  // Render the mobile surface during SSR + first client paint. Both
  // surfaces stay `open=false` on first paint anyway — the swap is
  // invisible to the user.
  return false
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToMedia,
    getDesktopSnapshot,
    getServerSnapshot,
  )
}
