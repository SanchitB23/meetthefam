'use client'

// Phase 4 sub-task 4 — 500 ms tap / long-press differentiation.
// Phase 4 sub-task 6 — split into a pure DOM function + a thin React hook
// so the press-detection logic can be unit-tested in JSDOM without
// react-testing-library plumbing.
//
// Spec: docs/ux/mobile-gestures.md "Differentiating tap from long-press".
//
// Implementation notes:
//   - Event delegation on the chart container (not per-node binding via
//     family-chart's `onCardUpdate`). Equivalent outcome, simpler cleanup,
//     no leak risk if the library re-renders nodes underneath us.
//   - Tap detection is left to the library's `setOnCardClick` — this
//     module ONLY fires `onLongPress`. The library's click and our
//     long-press both happen on `pointerup`, so when long-press fires we
//     set a "suppress next click" flag the caller checks inside
//     `onCardClick`.
//   - Cancellation: `pointercancel`, `pointerleave` from the container,
//     and `pointermove` past a small drift threshold all abort the
//     long-press. Drift threshold guards against tiny finger jitter
//     triggering cancel.

import { useEffect, useRef, type RefObject } from 'react'

export const LONG_PRESS_MS = 500
export const DRIFT_THRESHOLD_PX = 8

export type PressHandlers = {
  /** Fires after `LONG_PRESS_MS` ms of held pointer over a `.mtf-node`. */
  onLongPress: (personId: string, event: PointerEvent) => void
}

export type PressOptions = PressHandlers & {
  /**
   * Mutable flag set to `true` for one click after a long-press fired.
   * Caller's onCardClick should early-return when this is set, then
   * clear it. Avoids the library opening the detail sheet on the
   * pointerup that ended a long-press gesture.
   */
  suppressClickRef: { current: boolean }
  /** Test seam — override the default 500 ms threshold. */
  longPressMs?: number
  /** Test seam — override the default 8 px drift threshold. */
  driftPx?: number
}

/**
 * Pure DOM function — attaches pointer listeners to `container` and
 * returns a cleanup function. Exported separately from the hook so
 * Vitest can drive it in a JSDOM environment without React lifecycle.
 */
export function attachPressDetector(
  container: HTMLElement,
  options: PressOptions,
): () => void {
  const longPressMs = options.longPressMs ?? LONG_PRESS_MS
  const driftPx = options.driftPx ?? DRIFT_THRESHOLD_PX

  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let activePersonId: string | null = null
  let activePointerId: number | null = null

  const clearActive = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    activePersonId = null
    activePointerId = null
  }

  const onPointerDown = (e: PointerEvent) => {
    // Library's pan/zoom uses pointer events too. Touch on a non-card
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

    timer = setTimeout(() => {
      if (activePersonId == null) return
      options.suppressClickRef.current = true
      navigator.vibrate?.(10)
      options.onLongPress(activePersonId, e)
      // Don't clear yet — pointerup/cancel does it. Suppress flag is
      // consumed by the library's onCardClick.
      activePersonId = null
      timer = null
    }, longPressMs)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (activePointerId == null || e.pointerId !== activePointerId) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (dx * dx + dy * dy > driftPx * driftPx) {
      clearActive()
    }
  }

  const onEndOrCancel = (e: PointerEvent) => {
    if (activePointerId == null || e.pointerId !== activePointerId) return
    clearActive()
  }

  // Capture phase so future library `stopPropagation` won't shadow us.
  container.addEventListener('pointerdown', onPointerDown, { capture: true })
  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerup', onEndOrCancel)
  container.addEventListener('pointercancel', onEndOrCancel)
  container.addEventListener('pointerleave', onEndOrCancel)

  return () => {
    clearActive()
    container.removeEventListener('pointerdown', onPointerDown, { capture: true })
    container.removeEventListener('pointermove', onPointerMove)
    container.removeEventListener('pointerup', onEndOrCancel)
    container.removeEventListener('pointercancel', onEndOrCancel)
    container.removeEventListener('pointerleave', onEndOrCancel)
  }
}

export type PressActions = {
  shouldSuppressNextClickRef: RefObject<boolean>
}

export function usePressActions(
  containerRef: RefObject<HTMLElement | null>,
  handlers: PressHandlers,
): PressActions {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const shouldSuppressNextClickRef = useRef(false)

  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    return attachPressDetector(cont, {
      onLongPress: (id, e) => handlersRef.current.onLongPress(id, e),
      suppressClickRef: shouldSuppressNextClickRef,
    })
  }, [containerRef])

  return { shouldSuppressNextClickRef }
}
