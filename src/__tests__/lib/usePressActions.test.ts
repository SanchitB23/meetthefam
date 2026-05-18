// @vitest-environment jsdom
//
// Phase 4 sub-task 6 — JSDOM tests for the press-detector logic. We test
// `attachPressDetector` directly (the pure DOM function the React hook
// `usePressActions` wraps) so the assertions stay in the realm of "given
// these pointer events, does the timer + suppress flag behave?" with no
// React lifecycle plumbing.
//
// Fake timers drive the 500 ms long-press threshold without real waits.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { attachPressDetector } from '@/app/(app)/tree/[id]/_lib/usePressActions'

function makeContainer(): HTMLElement {
  const cont = document.createElement('div')
  document.body.appendChild(cont)
  return cont
}

function makeNode(personId: string): HTMLElement {
  const node = document.createElement('div')
  node.className = 'mtf-node'
  node.dataset.personId = personId
  // A 3-dot trigger lives inside the card per `person-node-html.ts`;
  // tests use it to assert pointerdowns inside it never start a press.
  const trigger = document.createElement('button')
  trigger.setAttribute('data-action-trigger', '')
  node.appendChild(trigger)
  return node
}

function pointerEvent(
  type: string,
  target: Element,
  init: Partial<PointerEventInit> = {},
): PointerEvent {
  // JSDOM ships a PointerEvent constructor but not all PointerEventInit
  // fields default sanely — pass everything explicitly.
  const e = new PointerEvent(type, {
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(e)
  return e
}

describe('attachPressDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  test('500 ms hold over a .mtf-node fires onLongPress with the person id', () => {
    const cont = makeContainer()
    const node = makeNode('alice')
    cont.appendChild(node)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, { onLongPress, suppressClickRef })

    pointerEvent('pointerdown', node, { clientX: 100, clientY: 100 })
    vi.advanceTimersByTime(499)
    expect(onLongPress).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onLongPress.mock.calls[0][0]).toBe('alice')
    expect(suppressClickRef.current).toBe(true)
    cleanup()
  })

  test('release before 500 ms — no long-press fires, suppress flag stays false', () => {
    const cont = makeContainer()
    const node = makeNode('bob')
    cont.appendChild(node)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, { onLongPress, suppressClickRef })

    pointerEvent('pointerdown', node, { clientX: 50, clientY: 50 })
    vi.advanceTimersByTime(300)
    pointerEvent('pointerup', node, { clientX: 50, clientY: 50 })
    vi.advanceTimersByTime(500)

    expect(onLongPress).not.toHaveBeenCalled()
    expect(suppressClickRef.current).toBe(false)
    cleanup()
  })

  test('pointercancel during hold aborts the press', () => {
    const cont = makeContainer()
    const node = makeNode('cathy')
    cont.appendChild(node)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, { onLongPress, suppressClickRef })

    pointerEvent('pointerdown', node, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(200)
    pointerEvent('pointercancel', node, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(1000)
    expect(onLongPress).not.toHaveBeenCalled()
    cleanup()
  })

  test('pointermove past the drift threshold aborts the press', () => {
    const cont = makeContainer()
    const node = makeNode('dan')
    cont.appendChild(node)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, {
      onLongPress,
      suppressClickRef,
      driftPx: 8,
    })

    pointerEvent('pointerdown', node, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(100)
    // 10 px move (> 8 px threshold) — should cancel.
    pointerEvent('pointermove', node, { clientX: 10, clientY: 0 })
    vi.advanceTimersByTime(1000)
    expect(onLongPress).not.toHaveBeenCalled()
    cleanup()
  })

  test('pointermove within the drift threshold does NOT abort', () => {
    const cont = makeContainer()
    const node = makeNode('eve')
    cont.appendChild(node)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, {
      onLongPress,
      suppressClickRef,
      driftPx: 8,
    })

    pointerEvent('pointerdown', node, { clientX: 0, clientY: 0 })
    // Tiny 3 px jitter — should NOT cancel.
    pointerEvent('pointermove', node, { clientX: 3, clientY: 0 })
    vi.advanceTimersByTime(500)
    expect(onLongPress).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('pointerdown on non-.mtf-node target does not start a press', () => {
    const cont = makeContainer()
    const outside = document.createElement('div')
    cont.appendChild(outside)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, { onLongPress, suppressClickRef })

    pointerEvent('pointerdown', outside, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(1000)
    expect(onLongPress).not.toHaveBeenCalled()
    cleanup()
  })

  test('pointerdown on [data-action-trigger] inside a card does not start a press', () => {
    const cont = makeContainer()
    const node = makeNode('frank')
    cont.appendChild(node)
    const trigger = node.querySelector('[data-action-trigger]') as HTMLElement

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, { onLongPress, suppressClickRef })

    pointerEvent('pointerdown', trigger, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(1000)
    expect(onLongPress).not.toHaveBeenCalled()
    cleanup()
  })

  test('cleanup removes listeners — no fires after teardown', () => {
    const cont = makeContainer()
    const node = makeNode('greta')
    cont.appendChild(node)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, { onLongPress, suppressClickRef })
    cleanup()

    pointerEvent('pointerdown', node, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(1000)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  test('overridable longPressMs — useful for snappier tests', () => {
    const cont = makeContainer()
    const node = makeNode('helen')
    cont.appendChild(node)

    const onLongPress = vi.fn()
    const suppressClickRef = { current: false }
    const cleanup = attachPressDetector(cont, {
      onLongPress,
      suppressClickRef,
      longPressMs: 100,
    })

    pointerEvent('pointerdown', node, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(99)
    expect(onLongPress).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onLongPress).toHaveBeenCalledTimes(1)
    cleanup()
  })
})
