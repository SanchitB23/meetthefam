// src/__tests__/lib/inline-link-strokes.test.ts
/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inlineLinkStrokes } from '@/app/(app)/tree/[id]/_lib/inline-link-strokes'

/** Build a target element with one or more `path.link` SVG paths inside an SVG. */
function buildTarget(count = 1, computedStroke = 'rgb(51, 61, 51)', computedStrokeWidth = '1.75px'): {
  target: HTMLDivElement
  paths: SVGPathElement[]
} {
  const target = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const paths: SVGPathElement[] = []

  for (let i = 0; i < count; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'link')
    // Simulate family-chart's hard-coded white attribute.
    path.setAttribute('stroke', '#fff')
    paths.push(path)
    svg.appendChild(path)
  }

  target.appendChild(svg)

  // Stub getComputedStyle to return our fake computed values for path.link elements.
  // Use nodeName + classList check instead of `instanceof SVGPathElement` because
  // jsdom does not expose SVGPathElement as a global in all environments.
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
    const isLinkPath =
      el instanceof Element &&
      el.nodeName === 'path' &&
      el.classList.contains('link')
    if (isLinkPath) {
      return {
        stroke: computedStroke,
        strokeWidth: computedStrokeWidth,
      } as unknown as CSSStyleDeclaration
    }
    // Fallback to real getComputedStyle for non-path elements.
    return window.getComputedStyle(el)
  })

  return { target, paths }
}

describe('inlineLinkStrokes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets inline stroke from getComputedStyle on each path.link', () => {
    const { target, paths } = buildTarget(1, 'rgb(51, 61, 51)', '1.75px')
    inlineLinkStrokes(target)
    expect(paths[0].style.stroke).toBe('rgb(51, 61, 51)')
    expect(paths[0].style.strokeWidth).toBe('1.75px')
  })

  it('restore() resets inline stroke back to original values', () => {
    const { target, paths } = buildTarget(1)
    const restore = inlineLinkStrokes(target)
    // Before restore: inline style was set by inlineLinkStrokes.
    expect(paths[0].style.stroke).toBeTruthy()
    restore()
    // After restore: back to original empty strings (no prior inline style).
    expect(paths[0].style.stroke).toBe('')
    expect(paths[0].style.strokeWidth).toBe('')
  })

  it('restore() preserves pre-existing inline styles if they were set before calling', () => {
    const { target, paths } = buildTarget(1)
    // Simulate a path that already had inline styles set.
    paths[0].style.stroke = 'green'
    paths[0].style.strokeWidth = '2px'

    const restore = inlineLinkStrokes(target)
    restore()

    expect(paths[0].style.stroke).toBe('green')
    expect(paths[0].style.strokeWidth).toBe('2px')
  })

  it('handles multiple path.link elements', () => {
    const { target, paths } = buildTarget(3, 'rgb(51, 61, 51)', '1.75px')
    const restore = inlineLinkStrokes(target)

    for (const path of paths) {
      expect(path.style.stroke).toBe('rgb(51, 61, 51)')
      expect(path.style.strokeWidth).toBe('1.75px')
    }

    restore()
    for (const path of paths) {
      expect(path.style.stroke).toBe('')
      expect(path.style.strokeWidth).toBe('')
    }
  })

  it('does not touch non-.link paths', () => {
    const { target } = buildTarget(1)
    // Add a non-link path sibling.
    const svg = target.querySelector('svg')!
    const otherPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    otherPath.setAttribute('class', 'other')
    svg.appendChild(otherPath)

    inlineLinkStrokes(target)

    // otherPath should have no inline stroke (we never touched it).
    expect(otherPath.style.stroke).toBe('')
  })

  it('handles transparent computed stroke (super-root-suppressed links flow through naturally)', () => {
    // Suppressed links have d='M0,0'; getComputedStyle may return rgba(0,0,0,0).
    const { target, paths } = buildTarget(1, 'rgba(0, 0, 0, 0)', '0px')
    const restore = inlineLinkStrokes(target)
    // The transparent value is written inline — that's correct; it preserves suppressor intent.
    expect(paths[0].style.stroke).toBe('rgba(0, 0, 0, 0)')
    restore()
    // After restore: back to original empty strings (no prior inline style before our call).
    expect(paths[0].style.stroke).toBe('')
  })

  it('does not throw when the target has no path.link elements', () => {
    const target = document.createElement('div')
    expect(() => inlineLinkStrokes(target)).not.toThrow()
    const restore = inlineLinkStrokes(target)
    expect(() => restore()).not.toThrow()
  })
})
