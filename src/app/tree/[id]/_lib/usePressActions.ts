'use client'

// Phase 4 sub-task 4 — 500 ms tap / long-press differentiation.
//
// Spec: docs/ux/mobile-gestures.md "Differentiating tap from long-press".
//
// Implementation notes:
//   - Event delegation on the chart container (not per-node binding via
//     family-chart's `onCardUpdate`). Equivalent outcome, simpler cleanup,
//     no leak risk if the library re-renders nodes underneath us.
//   - Tap detection is left to the library's `setOnCardClick` — this hook
//     ONLY fires `onLongPress`. The library's click and our long-press both
//     happen on `pointerup`, so when long-press fires we set a "suppress
//     next click" flag the caller checks inside `onCardClick`.
//   - Cancellation: `pointercancel`, `pointerleave` from the container, and
//     `pointermove` past a small drift threshold all abort the long-press.
//     Drift threshold guards against tiny finger jitter triggering cancel.

import { useEffect, useRef, type RefObject } from 'react'

const LONG_PRESS_MS = 500
const DRIFT_THRESHOLD_PX = 8

export type PressHandlers = {
  /** Fires after `longPressMs` ms of held pointer over a `.mtf-node`. */
  onLongPress: (personId: string, event: PointerEvent) => void
}

export type PressActions = {
  /**
   * Mutable flag — true for ~one click after a long-press fired. Caller's
   * onCardClick should early-return when this is set, then clear it.
   * Avoids the library opening the detail sheet on the pointerup that
   * ends a long-press gesture.
   */
  shouldSuppressNextClickRef: RefObject<boolean>
}

export function usePressActions(
  containerRef: RefObject<HTMLElement | null>,
  handlers: PressHandlers,
): PressActions {
  // Keep the latest handler in a ref so the effect can register listeners
  // once without churning on every render. `useEffectEvent` would be the
  // React 19.2 way but it's not yet stable here.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const shouldSuppressNextClickRef = useRef(false)

  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return

    let timer: number | null = null
    let startX = 0
    let startY = 0
    let activePersonId: string | null = null
    let activePointerId: number | null = null

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
      activePersonId = null
      activePointerId = null
    }

    const onPointerDown = (e: PointerEvent) => {
      // Library's pan / zoom uses pointer events too. Touch on a non-card
      // surface (e.g. the canvas background) shouldn't start a long-press.
      const target = e.target as HTMLElement | null
      const node = target?.closest('.mtf-node') as HTMLElement | null
      if (!node) return

      // The 3-dot trigger is its own immediate-action path via onCardClick.
      // Don't start a long-press from inside it.
      if (target?.closest('[data-action-trigger]')) return

      const personId = node.dataset.personId
      if (!personId) return

      startX = e.clientX
      startY = e.clientY
      activePersonId = personId
      activePointerId = e.pointerId

      timer = window.setTimeout(() => {
        if (activePersonId == null) return
        shouldSuppressNextClickRef.current = true
        // Best-effort tactile feedback — no-op on Safari iOS.
        navigator.vibrate?.(10)
        handlersRef.current.onLongPress(activePersonId, e)
        // Don't clear yet — we want pointerup/cancel to land cleanly,
        // and the suppress flag is consumed by the library's onCardClick.
        activePersonId = null
        timer = null
      }, LONG_PRESS_MS)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (activePointerId == null || e.pointerId !== activePointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (dx * dx + dy * dy > DRIFT_THRESHOLD_PX * DRIFT_THRESHOLD_PX) {
        clearTimer()
      }
    }

    const onPointerEndOrCancel = (e: PointerEvent) => {
      if (activePointerId == null || e.pointerId !== activePointerId) return
      clearTimer()
    }

    // Note: `pointerdown` uses capture so we beat any library handlers that
    // call stopPropagation. The library currently doesn't, but if a future
    // version does, capture phase keeps us ahead.
    cont.addEventListener('pointerdown', onPointerDown, { capture: true })
    cont.addEventListener('pointermove', onPointerMove)
    cont.addEventListener('pointerup', onPointerEndOrCancel)
    cont.addEventListener('pointercancel', onPointerEndOrCancel)
    cont.addEventListener('pointerleave', onPointerEndOrCancel)

    return () => {
      clearTimer()
      cont.removeEventListener('pointerdown', onPointerDown, { capture: true })
      cont.removeEventListener('pointermove', onPointerMove)
      cont.removeEventListener('pointerup', onPointerEndOrCancel)
      cont.removeEventListener('pointercancel', onPointerEndOrCancel)
      cont.removeEventListener('pointerleave', onPointerEndOrCancel)
    }
  }, [containerRef])

  return { shouldSuppressNextClickRef }
}
