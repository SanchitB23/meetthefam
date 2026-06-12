// src/app/(app)/tree/[id]/_lib/inline-link-strokes.ts
// Safari fix for #218: family-chart hard-codes `stroke="#fff"` as an SVG
// *attribute* on every `path.link`. On-screen this is overridden by our CSS
// rule `.f3 .link { stroke: ...; stroke-width: 1.75px }`. But html-to-image
// serialises the DOM without carrying the stylesheet into Safari's clone, so
// the attribute wins and connectors appear white-on-cream (invisible).
//
// Fix: before toBlob(), for each `path.link` read the **computed** stroke /
// stroke-width via getComputedStyle and write them as *inline* style properties.
// The clone now carries the concrete resolved values regardless of stylesheet
// availability.
//
// Restore: reset each element's inline style properties back to what they were
// before we touched them. Caller MUST call restore() in a `finally` block.
//
// The super-root suppressor zeroes some links to `M0,0`; their computed stroke
// may be `rgba(0,0,0,0)` or similar transparent value — that's fine. We inline
// whatever getComputedStyle returns, which preserves the suppressor's intent.

/** A single link element + its saved inline style values. */
type SavedLinkStyle = {
  el: SVGPathElement
  stroke: string
  strokeWidth: string
}

/**
 * For each `path.link` under `target`, resolve the current computed stroke and
 * stroke-width and write them as inline style properties.
 *
 * Returns a `restore` function that resets the inline styles to their
 * pre-call values. The caller MUST invoke `restore()` in a `finally` block.
 */
export function inlineLinkStrokes(target: HTMLElement): () => void {
  const paths = Array.from(target.querySelectorAll<SVGPathElement>('path.link'))

  const saved: SavedLinkStyle[] = paths.map((el) => {
    // Snapshot the existing inline style (may be '' if not previously set).
    const saved: SavedLinkStyle = {
      el,
      stroke: el.style.stroke,
      strokeWidth: el.style.strokeWidth,
    }

    // Resolve the concrete computed values.
    const cs = getComputedStyle(el)
    const resolvedStroke = cs.stroke
    const resolvedStrokeWidth = cs.strokeWidth

    // Write resolved values inline so html-to-image's clone carries them.
    if (resolvedStroke) el.style.stroke = resolvedStroke
    if (resolvedStrokeWidth) el.style.strokeWidth = resolvedStrokeWidth

    return saved
  })

  return function restore() {
    for (const { el, stroke, strokeWidth } of saved) {
      el.style.stroke = stroke
      el.style.strokeWidth = strokeWidth
    }
  }
}
