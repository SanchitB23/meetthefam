// Issue #69 (v1.1) — suppress SVG connector lines that target the
// synthetic __super_root__ layout-anchor injected by
// `transformToFamilyChartShapeShowAll`.
//
// PROBLEM
//   family-chart 0.9.0 draws an ancestry path (`<path class="link">`) from
//   every real root up to its parent — which, in the show-all world, is
//   our invisible `__super_root__`. The line itself is geometrically
//   sound but visually nonsensical (a connector to nothing). Worse,
//   during re-center the library tweens `d=` over ~800ms via d3
//   transitions, so even if we clear the path once in `setAfterUpdate`
//   the line FLASHES back into view as the tween progresses.
//
// APPROACH (mirrors non-spouse-parent-links.ts)
//   1. Walk `g.links_view path.link`, identify each ancestry link's
//      `__data__` (containing `target: [parentNode, ...]`,
//      `is_ancestry: true`).
//   2. For paths whose target id === SUPER_ROOT_ID, force `d='M0,0'`
//      (degenerate empty path — renders nothing, idempotent on re-write).
//   3. Install a `MutationObserver` on `links_view`'s `d=` attributes so
//      every transition tick re-applies our suppression, beating d3 to
//      the next paint.
//
// WHY THIS IS A REASONABLE PATH
//   * family-chart exposes no link-path-creator hook (see
//     `node_modules/family-chart/dist/types/core/chart.d.ts`); the only
//     post-update integration point is `setAfterUpdate`.
//   * We use d3's data binding the library already maintains — we
//     identify the relevant links by their bound datum, not by
//     coordinate-matching, so the suppression survives every layout pass.
//   * No fork of family-chart. If the library ever exposes a real
//     path-creator hook, this file deletes cleanly.
//
// LIFECYCLE — identical to `attachNonSpouseParentLinkRewriter`:
//
//   const suppressor = attachSuperRootLinkSuppressor(container)
//   chart.setAfterUpdate(() => suppressor.kick())
//   // on unmount:
//   suppressor.dispose()

import { SUPER_ROOT_ID } from './family-chart-data-show-all'

type PathWithData = SVGPathElement & {
  __data__?: unknown
}

// Minimal shape we read off the d3-bound `__data__` on each ancestry
// path. family-chart writes `target` as an array (`[p1, p2]`) for two-
// parent ancestry links and as `[p1, p1]` for single-parent ones. We
// only check the first entry — the super-root either is or isn't the
// referenced parent.
type AncestryLinkDatum = {
  is_ancestry?: boolean
  target?: unknown
}

function isAncestryLinkDatum(value: unknown): value is AncestryLinkDatum {
  if (!value || typeof value !== 'object') return false
  const v = value as { is_ancestry?: unknown; target?: unknown }
  return v.is_ancestry === true && Array.isArray(v.target)
}

function getTargetId(datum: AncestryLinkDatum): string | null {
  const target = datum.target as unknown[] | undefined
  const first = target?.[0] as { data?: { id?: unknown } } | undefined
  const id = first?.data?.id
  return typeof id === 'string' ? id : null
}

/**
 * Walk every `.link` path in the chart's links_view and zero any whose
 * ancestry target is the synthetic super-root. Idempotent — re-running
 * against an already-suppressed path is a no-op.
 */
function suppressOnce(linksView: SVGGElement): void {
  const paths = linksView.querySelectorAll<SVGPathElement>('path.link')
  paths.forEach((path) => {
    const datum = (path as PathWithData).__data__
    if (!isAncestryLinkDatum(datum)) return
    if (getTargetId(datum) !== SUPER_ROOT_ID) return
    if (path.getAttribute('d') !== 'M0,0') {
      path.setAttribute('d', 'M0,0')
    }
  })
}

/**
 * Install the after-update suppression + a MutationObserver that
 * re-applies it across d3's ~800ms transition window. Returns a
 * `{ kick, dispose }` pair — kick from `setAfterUpdate`, dispose on
 * unmount. Matches the shape of `attachNonSpouseParentLinkRewriter`
 * so both suppressors compose cleanly in `FamilyTree.tsx`.
 */
export function attachSuperRootLinkSuppressor(
  container: HTMLElement,
): { kick: () => void; dispose: () => void } {
  let observer: MutationObserver | null = null
  // Re-entrancy guard: when we write `d=`, the observer fires on our own
  // write. The idempotent check inside `suppressOnce` makes that a cheap
  // no-op, but we still flip a flag to short-circuit even faster.
  let suppressing = false

  function findLinksView(): SVGGElement | null {
    const svgRoot = container.querySelector<SVGSVGElement>('svg.main_svg')
    if (!svgRoot) return null
    return svgRoot.querySelector<SVGGElement>('g.links_view')
  }

  function ensureObserver(linksView: SVGGElement): void {
    if (observer) return
    observer = new MutationObserver((mutations) => {
      if (suppressing) return
      // Cheap relevance filter — only react to `d=` changes on path.link.
      const touchesLinkD = mutations.some((m) => {
        if (m.type !== 'attributes' || m.attributeName !== 'd') return false
        const t = m.target as Element
        return t.nodeName === 'path' && t.classList.contains('link')
      })
      if (!touchesLinkD) return
      suppressing = true
      try {
        suppressOnce(linksView)
      } finally {
        suppressing = false
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
    suppressing = true
    try {
      suppressOnce(linksView)
    } finally {
      suppressing = false
    }
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
