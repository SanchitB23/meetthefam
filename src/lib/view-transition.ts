/**
 * #187 — View Transitions API helpers.
 *
 * `startViewTransition` wraps a DOM-mutating callback with
 * `document.startViewTransition(...)` when the API is available (Chrome 111+,
 * Safari 18+, Firefox 132+). Falls back to a direct call in older browsers —
 * the UX degrades gracefully to an instant swap.
 *
 * Reduced-motion is handled entirely in CSS (::view-transition-old / -new
 * duration set to 0ms). We intentionally do NOT skip calling startViewTransition
 * under prefers-reduced-motion because:
 *   1. The CSS 0-duration path still produces a clean non-janky swap (no flash).
 *   2. Some users set reduced-motion for vestibular reasons but still appreciate
 *      the non-jarring same-frame swap semantics.
 *
 * Usage:
 *   import { startViewTransition } from '@/lib/view-transition'
 *   startViewTransition(() => router.push('/dashboard'))
 */
export function startViewTransition(updateCallback: () => void): void {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API not yet in TypeScript stdlib for all targets
    ;(document as any).startViewTransition(updateCallback)
  } else {
    updateCallback()
  }
}
