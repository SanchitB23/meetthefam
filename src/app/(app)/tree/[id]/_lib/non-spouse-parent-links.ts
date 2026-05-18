// v0.0.5 hotfix — non-spouse co-parent connector geometry.
//
// PROBLEM
//   family-chart 0.9.0 always draws a single ancestry link from a child up
//   to the *midpoint* between its two parents (see `handleAncestrySide` in
//   `node_modules/family-chart/dist/family-chart.esm.js` around line 1136).
//   The resulting stepped curve includes a horizontal segment joining the
//   two parents — visually identical to the dedicated "spouse" link the
//   library uses for married couples. When the two parents are NOT actually
//   each other's spouse (e.g. unmarried co-parents), that horizontal bar
//   reads as a marriage where none exists.
//
// APPROACH
//   The library exposes no path-generator hook (no `setLinkPathCreator`,
//   no custom `Link` factory; see `node_modules/family-chart/dist/types/
//   core/chart.d.ts`). It DOES expose `setAfterUpdate(fn)` which fires
//   right after `view()` has appended/updated the `<path class="link">`
//   nodes and *scheduled* their d3 transitions to `createPath(d)`.
//
//   So: after every update we
//     1. walk `.links_view path.link`, identify each ancestry link's
//        d3-bound `__data__` (containing `source = child`, `target = [p1,
//        p2]`, `is_ancestry: true`),
//     2. for the subset where the two parents are NOT bidirectionally
//        married in our domain model, swap the `d=` attribute for two
//        independent stepped vertical paths (one per parent),
//     3. install a `MutationObserver` on the links_view's `d` attributes
//        so we re-apply our override every time d3's transition tweens
//        the attribute during the ~800ms animation window. The observer
//        runs the rewrite again, which is idempotent.
//
//   `MutationObserver` (rather than a `requestAnimationFrame` poll loop) is
//   the lightest-weight way to outrun d3's transition without importing d3
//   ourselves. We skip our own write events by checking whether the path's
//   current `d=` already matches what we want.
//
// WHY THIS IS A REASONABLE PATH
//   * It uses d3 data binding the library already maintains — we identify
//     links by their bound datum, not by coordinate-matching.
//   * Marriage-pair behaviour (Robert + Susan) is left alone: those links
//     still flow through `handleAncestrySide`'s midpoint geometry.
//   * No fork of family-chart. If/when the library exposes a path-creator
//     hook, this file deletes cleanly.
//   * No CSS clip-paths or other geometry-fragile hacks.

import type { PersonRow } from './types'
import { arePartnersMarried } from './family-chart-data'

// Minimal shape we read off the d3-bound `__data__` on each ancestry path.
// See `createLinks` / `handleAncestrySide` in the family-chart bundle for
// the canonical structure. We only touch fields we read.
type TreeNodeLike = {
  x: number
  y: number
  data?: { id?: unknown }
}

type AncestryLinkDatum = {
  is_ancestry?: boolean
  source?: TreeNodeLike // the child
  target?: TreeNodeLike[] // [p1, p2]; p2 falls back to p1 for single-parent
}

// family-chart emits a SECOND ancestry path per parent-pair: a horizontal
// bar joining the two parents at their y-level. Its datum carries a `spouse`
// key, `target` is a SINGLE TreeNode (the other parent — NOT an array), and
// `d=` is a flat horizontal line. We need this distinct from the parent →
// children link so we can suppress it for unmarried co-parents.
type CoupleBarDatum = {
  is_ancestry?: boolean
  spouse?: unknown // sentinel — its presence is what marks this datum
  source?: TreeNodeLike // one parent
  target?: TreeNodeLike // the other parent (object, not array)
}

// `path.__data__` is the d3-bound datum. Type-narrowed at the call site.
type PathWithData = SVGPathElement & {
  __data__?: unknown
}

/**
 * Build a stepped vertical SVG path string from a parent node down to the
 * child node, mirroring family-chart's own `LinkVertical` geometry but with
 * a single fixed `x` (the parent's x) rather than the midpoint between two
 * parents. This is the geometry we'd get if the child had exactly one
 * parent — which is conceptually what we want per parent when they're not
 * married.
 */
function singleParentPathD(parent: TreeNodeLike, child: TreeNodeLike): string {
  // Same vertical step that the library's `LinkVertical` produces:
  //   child → child.x,hy → parent.x,hy → parent.x,parent.y
  // where `hy` is the y-midpoint between child and parent.
  const cx = child.x
  const cy = child.y
  const px = parent.x
  const py = parent.y
  const hy = cy + (py - cy) / 2
  // M cx cy → V hy → H px → V py.  Plain SVG path commands; no curve.
  return `M${cx},${cy} L${cx},${hy} L${px},${hy} L${px},${py}`
}

function isAncestryLinkDatum(value: unknown): value is AncestryLinkDatum {
  if (!value || typeof value !== 'object') return false
  const v = value as { is_ancestry?: unknown; target?: unknown; source?: unknown }
  return v.is_ancestry === true && Array.isArray(v.target) && !!v.source
}

function isCoupleBarDatum(value: unknown): value is CoupleBarDatum {
  if (!value || typeof value !== 'object') return false
  const v = value as {
    is_ancestry?: unknown
    spouse?: unknown
    target?: unknown
    source?: unknown
  }
  // Distinguishing features:
  //   - is_ancestry: true (same as parent→children link)
  //   - `spouse` key present on the datum (only on the bar, not on parent→child)
  //   - target is a non-null object but NOT an array (single TreeNode)
  return (
    v.is_ancestry === true &&
    'spouse' in v &&
    !!v.target &&
    typeof v.target === 'object' &&
    !Array.isArray(v.target) &&
    !!v.source
  )
}

/**
 * Decide whether a given path is a non-spouse co-parent ancestry link and,
 * if so, return the SVG `d=` we want it to display. Returns null if the
 * path should be left alone (single-parent link, married pair, or some
 * non-ancestry link such as a spouse or progeny connector).
 */
function computeCoparentPathD(
  path: SVGPathElement,
  peopleById: Map<string, PersonRow>,
): string | null {
  const datum = (path as PathWithData).__data__
  if (!isAncestryLinkDatum(datum)) return null
  const [p1, p2] = datum.target ?? []
  if (!p1 || !p2) return null

  const p1Id = p1.data?.id
  const p2Id = p2.data?.id
  if (typeof p1Id !== 'string' || typeof p2Id !== 'string') return null
  // Single-parent ancestry link — library already encodes it as p2 = p1
  // (see `handleAncestrySide`). Nothing to rewrite.
  if (p1Id === p2Id) return null
  if (arePartnersMarried(p1Id, p2Id, peopleById)) return null

  const child = datum.source
  if (!child) return null

  // The library only allocates one <path> per ancestry link. Emit a single
  // multi-subpath `d=` containing both stepped verticals — visually
  // identical to two paths and it survives the d3 data join.
  return `${singleParentPathD(p1, child)} ${singleParentPathD(p2, child)}`
}

/**
 * Decide whether a path is the horizontal couple-bar between two adjacent
 * parents AND those parents are not married. Returns `''` (degenerate
 * empty path) to suppress, or null to leave the path alone (married pair,
 * single-parent layout, non-bar link).
 *
 * Why this exists: family-chart paints the parent-bar as a separate link
 * from the parent→children path. The `computeCoparentPathD` rewrite above
 * only touched the parent→children link; this rewrite suppresses the bar
 * itself. Without it, two vertical lines correctly drop to the child but
 * a horizontal bar still spans the parents (the v0.0.5 QA finding).
 */
function computeCoupleBarSuppression(
  path: SVGPathElement,
  peopleById: Map<string, PersonRow>,
): string | null {
  const datum = (path as PathWithData).__data__
  if (!isCoupleBarDatum(datum)) return null

  const a = datum.source
  const b = datum.target
  if (!a || !b) return null

  const aId = a.data?.id
  const bId = b.data?.id
  if (typeof aId !== 'string' || typeof bId !== 'string') return null
  if (aId === bId) return null
  if (arePartnersMarried(aId, bId, peopleById)) return null

  // Degenerate "moveTo origin, no line" — SVG renders nothing, the path
  // node stays in the DOM (so d3's data join is unaffected) and re-application
  // is idempotent.
  return 'M0,0'
}

/**
 * Walk every `.link` path in the chart's links_view and, for ancestry links
 * connecting an unmarried parent pair, replace the joint stepped bar with
 * two independent stepped vertical paths (one per parent). Idempotent.
 */
function rewriteOnce(
  linksView: SVGGElement,
  peopleById: Map<string, PersonRow>,
): void {
  const paths = linksView.querySelectorAll<SVGPathElement>('path.link')
  paths.forEach((path) => {
    // 1. Parent → children link with two unmarried co-parents: split into
    //    two stepped verticals (the original v0.0.5 hotfix scope).
    const parentChildD = computeCoparentPathD(path, peopleById)
    if (parentChildD !== null) {
      if (path.getAttribute('d') !== parentChildD) {
        path.setAttribute('d', parentChildD)
      }
      path.dataset.coparent = 'true'
      return
    }
    // 2. Horizontal couple-bar between two unmarried adjacent parents:
    //    suppress with a degenerate `M0,0` path. Without this the bar
    //    still renders even though the verticals are correct.
    const barSuppression = computeCoupleBarSuppression(path, peopleById)
    if (barSuppression !== null) {
      if (path.getAttribute('d') !== barSuppression) {
        path.setAttribute('d', barSuppression)
      }
      path.dataset.coparent = 'true'
      return
    }
    // Neither case applies — leave the path alone. Clear our tag if
    // it lingered from a prior shape that has since changed.
    if (path.dataset.coparent === 'true') {
      delete path.dataset.coparent
    }
  })
}

/**
 * Install the after-update rewrite + a MutationObserver that re-applies it
 * across d3's ~800ms transition window. Returns a teardown function.
 *
 * Intended usage:
 *
 *   const cleanup = attachNonSpouseParentLinkRewriter(container, peopleByIdRef)
 *   chart.setAfterUpdate(() => cleanup.kick())
 *   // on unmount:
 *   cleanup.dispose()
 */
export function attachNonSpouseParentLinkRewriter(
  container: HTMLElement,
  peopleByIdRef: { current: Map<string, PersonRow> },
): { kick: () => void; dispose: () => void } {
  let observer: MutationObserver | null = null
  // Re-entrancy guard: when we write `d=`, the observer will fire again on
  // our own write. The idempotent check inside `rewriteOnce` makes that a
  // cheap no-op, but we still flip a flag to short-circuit even faster.
  let rewriting = false

  function findLinksView(): SVGGElement | null {
    const svgRoot = container.querySelector<SVGSVGElement>('svg.main_svg')
    if (!svgRoot) return null
    return svgRoot.querySelector<SVGGElement>('g.links_view')
  }

  function ensureObserver(linksView: SVGGElement): void {
    if (observer) return
    observer = new MutationObserver((mutations) => {
      if (rewriting) return
      // Cheap relevance filter — only react to `d=` changes on path.link.
      const touchesLinkD = mutations.some((m) => {
        if (m.type !== 'attributes' || m.attributeName !== 'd') return false
        const t = m.target as Element
        return t.nodeName === 'path' && t.classList.contains('link')
      })
      if (!touchesLinkD) return
      rewriting = true
      try {
        rewriteOnce(linksView, peopleByIdRef.current)
      } finally {
        rewriting = false
      }
    })
    observer.observe(linksView, {
      attributes: true,
      attributeFilter: ['d'],
      subtree: true,
    })
  }

  function kick(): void {
    const linksView = findLinksView()
    if (!linksView) return
    rewriting = true
    try {
      rewriteOnce(linksView, peopleByIdRef.current)
    } finally {
      rewriting = false
    }
    // The observer stays attached for the chart's lifetime. d3's
    // transitions tween the `d=` attribute over ~800ms; the observer
    // re-applies our override on every mutation so the bar never appears.
    ensureObserver(linksView)
  }

  function dispose(): void {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  return { kick, dispose }
}
