// Issue #69 (v1.1) — option (d') pivot: camera pan without re-rooting.
//
// PROBLEM
//   The original spike POC pinned `main_id` to the clicked person on
//   re-center, which made family-chart re-walk its strict ancestry-up /
//   progeny-down hierarchies from that node. Anything not on the new
//   parent-or-child chain disappeared — exactly the "out of thin air"
//   complaint #69 was filed to fix. The super-root transform alone
//   doesn't help: family-chart's walk never crosses back DOWN through
//   the super-root's other children (verified against
//   `node_modules/family-chart/dist/family-chart.js:675`
//   `hierarchyGetterChildren` — it only follows the focused subtree).
//
// APPROACH
//   Keep `main_id` permanently pinned to `__super_root__`. The progeny
//   walk from there reaches every real root → every subtree → every
//   person on the canvas. To "re-center" on a person, we pan the d3-zoom
//   camera so the person's card sits at the viewport centre, leaving
//   the layout untouched. Everyone stays visible; only the camera moves.
//
//   family-chart already implements this via `cardToMiddle` in its
//   `handlers` namespace (see family-chart.js:1098-1101). It accepts the
//   laid-out tree datum (with `x`, `y` in chart-space coordinates) and
//   reuses the chart's existing d3-zoom listener to apply a translation
//   transform. We just supply the datum and current zoom scale.

import f3 from 'family-chart'

type Chart = ReturnType<typeof f3.createChart>

// Family-chart's `cardToMiddle` lives on the bundled handlers namespace
// but the TypeScript surface (`node_modules/family-chart/dist/types/`)
// doesn't enumerate every helper. Cast through `unknown` so we don't
// leak `any` into our callers.
type F3Handlers = {
  cardToMiddle: (args: {
    datum: { x: number; y: number }
    svg: SVGSVGElement
    svg_dim: DOMRect
    scale?: number
    transition_time?: number
  }) => void
  getCurrentZoom: (svg: SVGSVGElement) => { k: number; x: number; y: number }
}

function getHandlers(): F3Handlers {
  return (f3 as unknown as { handlers: F3Handlers }).handlers
}

/**
 * Smoothly pan the chart's camera so the card for `personId` sits at
 * the viewport centre. Preserves the current zoom scale. No-op if the
 * person id isn't in the laid-out tree (e.g. the synthetic super-root,
 * which is invisible by design).
 *
 * Implementation notes:
 *  - `chart.store.getTreeDatum(id)` returns the d3-laid-out node with
 *    `x`/`y` coordinates in family-chart's internal "chart space" (not
 *    screen space). `cardToMiddle` does the d3-zoom math to translate
 *    those coords into a viewport-centred transform.
 *  - We pass the current zoom `k` as `scale` so the user's manual
 *    pinch-zoom level is preserved across re-centres.
 *  - Transition time defaults to 800 ms to match family-chart's own
 *    `chart.setTransitionTime(800)` configured in FamilyTree.tsx.
 */
export function panCameraTo(
  chart: Chart,
  container: HTMLElement,
  personId: string,
  opts: { transitionTime?: number } = {},
): void {
  const svg = container.querySelector<SVGSVGElement>('svg.main_svg')
  if (!svg) return

  // `getTreeDatum` is on the store interface returned by `createStore`.
  // The chart's public `.store` exposes it (family-chart.js:5138-5142).
  const store = (chart as unknown as {
    store: { getTreeDatum: (id: string) => { x: number; y: number } | null }
  }).store
  const datum = store.getTreeDatum(personId)
  if (!datum) return

  const handlers = getHandlers()
  const currentZoom = handlers.getCurrentZoom(svg)
  handlers.cardToMiddle({
    datum,
    svg,
    svg_dim: svg.getBoundingClientRect(),
    scale: currentZoom.k,
    transition_time: opts.transitionTime ?? 800,
  })
}
