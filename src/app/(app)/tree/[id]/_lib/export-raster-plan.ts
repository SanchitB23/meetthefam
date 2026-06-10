// src/app/(app)/tree/[id]/_lib/export-raster-plan.ts
// Pure geometry helper for native-scale PNG export (#218).
//
// The problem: before this change, captureTree always captured the
// fit-to-screen view (zoom scale ≈ 0.2–0.4 for big trees). Multiplying
// that shrunk layout by pixelRatio=3 still produced a blurry PNG because
// the per-card pixel budget was tiny.
//
// The fix (enlarge-container approach): temporarily resize the family-chart
// container to match the tree's native pixel extent (scale k=1) so
// family-chart's updateTree({ initial: true }) fits the tree into a
// *large* box rather than the viewport → renders at ≈1× → crisp capture.
//
// This file owns ONLY the pure geometry: given native dimensions and
// desired capture quality, compute the final box size + pixelRatio that
// keeps the raster within browser canvas caps. No DOM, no side-effects.
//
// Browser canvas size caps (conservative defaults):
//   maxCanvasSide = 16384 px  — Chrome / Firefox / most WebKit
//   maxCanvasArea = 268435456 — 16384² (Chrome; Firefox is similar)
//
// Safari / iOS note: Safari's cap is historically lower — empirically
// 4096×4096 on older iPhones, 8192×8192 on modern iPads.
// If testers see a blank/clipped PNG on Safari, lower MAX_CANVAS_SIDE
// to 8192 (and set MAX_CANVAS_AREA = 8192*8192 = 67_108_864). The
// constants are exported so callers can override them if needed.

export const MAX_CANVAS_SIDE = 16_384 // px; Safari may need 8192
export const MAX_CANVAS_AREA = 16_384 * 16_384 // px²; reduce proportionally

export interface NativeExtent {
  /** Native width of the fully-laid-out tree (pixels at scale k=1). */
  nativeW: number
  /** Native height of the fully-laid-out tree (pixels at scale k=1). */
  nativeH: number
}

export interface RasterPlanOptions {
  /**
   * Desired device-pixel ratio for the output PNG.
   * Default (and cap max): 3 — gives crisp cards on Retina at 1× zoom.
   */
  targetPixelRatio?: number
  /**
   * Maximum single-axis canvas dimension (px). Defaults to MAX_CANVAS_SIDE.
   * Override for Safari compatibility.
   */
  maxCanvasSide?: number
  /**
   * Maximum total canvas area (px²). Defaults to MAX_CANVAS_AREA.
   */
  maxCanvasArea?: number
}

export interface RasterPlan {
  /** Width of the container box family-chart should fit into (CSS px). */
  boxW: number
  /** Height of the container box family-chart should fit into (CSS px). */
  boxH: number
  /**
   * Pixel ratio to pass to html-to-image. The final canvas will be
   * boxW*pixelRatio × boxH*pixelRatio — guaranteed within the caps.
   */
  pixelRatio: number
  /**
   * True when the export can no longer render cards at native size — the box
   * was shrunk below the native extent (or the inputs were invalid). The
   * preflight gate (#225) uses this to show the degrade warning. Note the
   * returned pixelRatio is always ≥ 1 by construction, so box-shrink is the
   * only in-plan degradation signal.
   */
  degraded: boolean
}

/**
 * Compute the capture box size and pixel ratio for a native-scale PNG export.
 *
 * Algorithm (highest fidelity → degrades gracefully toward today's behaviour):
 *
 * 1. Start with box = native extent, pixelRatio = targetPixelRatio (ideal: crisp,
 *    canvas ≈ nativeW×targetPR × nativeH×targetPR).
 * 2. If the canvas exceeds maxCanvasSide on either axis, scale pixelRatio down
 *    until both axes fit. This keeps the box at native size but reduces DPI.
 * 3. After step 2, if the canvas still exceeds maxCanvasArea (area cap), reduce
 *    pixelRatio further until area fits.
 * 4. If pixelRatio would fall below 1.0, we can no longer fit by reducing pixelRatio
 *    alone. Clamp pixelRatio to 1.0 and shrink the box uniformly (keeping aspect
 *    ratio) until both caps are satisfied. This degrades toward the old fit-to-screen
 *    behaviour but never exceeds the cap → never produces a blank/clipped PNG.
 * 5. Round boxW/boxH down to integers (safe: the chart fits content into the box;
 *    a 1px difference is imperceptible). Round pixelRatio down to 2 decimal places.
 *
 * Defensive minimum: if either native dimension is ≤ 0 (shouldn't happen, but
 * guard against divide-by-zero), fall back to a 800×600 box at pixelRatio 1.
 */
export function planExportRaster(
  { nativeW, nativeH }: NativeExtent,
  {
    targetPixelRatio = 3,
    maxCanvasSide = MAX_CANVAS_SIDE,
    maxCanvasArea = MAX_CANVAS_AREA,
  }: RasterPlanOptions = {},
): RasterPlan {
  // Defensive minimum.
  if (nativeW <= 0 || nativeH <= 0) {
    return { boxW: 800, boxH: 600, pixelRatio: 1, degraded: true }
  }

  let boxW = nativeW
  let boxH = nativeH
  let pixelRatio = targetPixelRatio
  let degraded = false

  // Step 2: reduce pixelRatio so neither canvas axis exceeds maxCanvasSide.
  // canvasW = boxW * pixelRatio ≤ maxCanvasSide  →  pixelRatio ≤ maxCanvasSide / boxW
  // canvasH = boxH * pixelRatio ≤ maxCanvasSide  →  pixelRatio ≤ maxCanvasSide / boxH
  const maxPrFromSide = Math.min(maxCanvasSide / boxW, maxCanvasSide / boxH)
  if (pixelRatio > maxPrFromSide) {
    pixelRatio = maxPrFromSide
  }

  // Step 3: reduce pixelRatio further so canvas area ≤ maxCanvasArea.
  // area = boxW * pixelRatio * boxH * pixelRatio = boxW * boxH * pixelRatio²
  //   ≤ maxCanvasArea  →  pixelRatio ≤ sqrt(maxCanvasArea / (boxW * boxH))
  const maxPrFromArea = Math.sqrt(maxCanvasArea / (boxW * boxH))
  if (pixelRatio > maxPrFromArea) {
    pixelRatio = maxPrFromArea
  }

  // Steps 4: if pixelRatio < 1.0, clamp it to 1.0 and shrink the box instead.
  if (pixelRatio < 1.0) {
    pixelRatio = 1.0
    // Now shrink the box so that boxW*1 ≤ maxCanvasSide, boxH*1 ≤ maxCanvasSide,
    // and boxW*boxH ≤ maxCanvasArea (all at pixelRatio=1).
    // Scale uniformly by the most restrictive constraint.
    const scaleFromSide = Math.min(maxCanvasSide / boxW, maxCanvasSide / boxH)
    const scaleFromArea = Math.sqrt(maxCanvasArea / (boxW * boxH))
    const scale = Math.min(scaleFromSide, scaleFromArea)
    if (scale < 1.0) {
      boxW = boxW * scale
      boxH = boxH * scale
      degraded = true
    }
  }

  // Step 5: floor box dimensions (safe), round pixelRatio down to 2dp.
  return {
    boxW: Math.floor(boxW),
    boxH: Math.floor(boxH),
    pixelRatio: Math.floor(pixelRatio * 100) / 100,
    degraded,
  }
}

/**
 * Read the current d3-zoom scale from family-chart's DOM.
 *
 * family-chart composites cards and SVG connector lines in the same coordinate
 * space. The d3-zoom transform is stored on the `<g class="view">` element
 * inside `svg.main_svg` as an SVG `transform` attribute of the form
 * `translate(x, y) scale(k)` — the same coordinate family-chart writes via
 * `g.view.attr('transform', ...)` in its zoom handler.
 *
 * The alternative reading path — `el.__zoom.k` on the SVG/parent — exists in
 * d3-zoom's internal state but is not guaranteed to stay in sync across all
 * family-chart versions. We parse the visible attribute instead as it is the
 * ground truth for what is actually rendered.
 *
 * Returns `null` when the transform cannot be read (chart not yet mounted,
 * or an unexpected DOM shape). Callers should fall back to the current
 * fit-to-screen behaviour.
 */
export function readCurrentZoomK(container: HTMLElement): number | null {
  try {
    const svg = container.querySelector<SVGSVGElement>('svg.main_svg')
    if (!svg) return null

    // Try reading from the <g class="view"> transform attribute inside the SVG
    // (family-chart v0.0.x writes the d3-zoom transform here).
    const viewG = svg.querySelector<SVGGElement>('g.view')
    if (viewG) {
      const transform = viewG.getAttribute('transform')
      if (transform) {
        const k = parseTransformScale(transform)
        if (k !== null && k > 0) return k
      }
    }

    // Fallback: try d3's internal __zoom property on the SVG or its parent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomEl = (svg as any).__zoomObj ? svg : svg.parentElement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoom = (zoomEl as any)?.__zoom
    if (zoom && typeof zoom.k === 'number' && zoom.k > 0) return zoom.k

    return null
  } catch {
    return null
  }
}

/**
 * Parse a d3-zoom SVG transform string and return the scale value.
 * d3 writes transforms as `translate(x,y) scale(k)` or the matrix form.
 * We handle both common forms.
 */
function parseTransformScale(transform: string): number | null {
  // form: "translate(x, y) scale(k)"
  const scaleMatch = transform.match(/scale\s*\(\s*([\d.eE+-]+)\s*\)/)
  if (scaleMatch) {
    const k = parseFloat(scaleMatch[1])
    return isFinite(k) ? k : null
  }

  // form: "matrix(a, b, c, d, e, f)" where a=d=k for uniform scale
  const matrixMatch = transform.match(/matrix\s*\(\s*([\d.eE+-]+)/)
  if (matrixMatch) {
    const k = parseFloat(matrixMatch[1])
    return isFinite(k) ? k : null
  }

  return null
}

/**
 * Measure the bounding box of the rendered content within a family-chart
 * container, then compute the native (k=1) extent.
 *
 * Strategy: read the rendered dimensions of the svg.main_svg.parentElement
 * (the same element captureTree targets), which encompasses all cards + lines.
 * Divide by the current zoom k to get the native extent.
 *
 * Returns `null` when measurement fails — callers fall back to viewport size.
 */
export function measureNativeExtent(container: HTMLElement): NativeExtent | null {
  try {
    const svg = container.querySelector<SVGSVGElement>('svg.main_svg')
    const target = svg?.parentElement
    if (!target) return null

    const k = readCurrentZoomK(container)
    if (k === null || k <= 0) return null

    // The SVG itself is sized to the viewport — it doesn't tell us the content
    // extent. We need the bounding box of the content inside the SVG.
    // family-chart draws all connector paths inside the SVG; the union of all
    // path bounding boxes gives us the content extent.
    const allPaths = svg.querySelectorAll<SVGElement>('path, line, circle, rect, foreignObject')
    if (allPaths.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    allPaths.forEach((el) => {
      try {
        const bbox = (el as SVGGraphicsElement).getBBox?.()
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          minX = Math.min(minX, bbox.x)
          minY = Math.min(minY, bbox.y)
          maxX = Math.max(maxX, bbox.x + bbox.width)
          maxY = Math.max(maxY, bbox.y + bbox.height)
        }
      } catch {
        // getBBox throws for hidden/detached elements; tolerate.
      }
    })

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      return null
    }

    // The bbox is in SVG coordinate space (before the d3 transform).
    // Multiply by k to get screen pixels, divide by k² / k = 1... actually:
    // content native extent = (maxX - minX) + padding, same for Y.
    // But since the SVG content coords are already "chart space" (the family-chart
    // native layout), the native extent is just the bbox size + a small margin.
    const MARGIN = 80 // px at native scale
    const nativeW = (maxX - minX) + MARGIN * 2
    const nativeH = (maxY - minY) + MARGIN * 2

    return {
      nativeW: Math.max(nativeW, 400),
      nativeH: Math.max(nativeH, 300),
    }
  } catch {
    return null
  }
}
