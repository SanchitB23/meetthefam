// Issue #69 (v1.1) — suppress SVG connector lines that target the
// synthetic __super_root__ layout-anchor injected by
// `transformToFamilyChartShapeShowAll`.
//
// PROBLEM
//   With option (d') the chart's `main_id` is permanently pinned to
//   `__super_root__`, so family-chart's progeny walk starts at the
//   invisible super-root and descends through every real root. The
//   library draws a connector path (`<path class="link">`) from super-
//   root DOWN to each of its children — visually nonsensical (a fan of
//   lines from a non-card). It also still draws an ancestry path from
//   any real root UP to super-root if that root happens to be on the
//   chain to another main_id (defensive: covers the case where someone
//   programmatically sets main_id off super-root in dev tools).
//
//   In both cases d3 tweens `d=` over ~800 ms during transitions, so a
//   one-shot suppression in `setAfterUpdate` flashes the line back as
//   the tween progresses.
//
// APPROACH (mirrors non-spouse-parent-links.ts)
//   1. Walk `g.links_view path.link`. For every datum where EITHER the
//      target is `__super_root__` (ancestry chain pointing UP at it) OR
//      the source is `__super_root__` (progeny chain fanning DOWN from
//      it), force `d='M0,0'` (degenerate empty path — renders nothing,
//      idempotent on re-write).
//   2. Install a `MutationObserver` on `links_view`'s `d=` attributes so
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

// Minimal shape we read off the d3-bound `__data__` on each link
// path. family-chart writes `target` as an array (`[p1, p2]`) for two-
// parent ancestry links and as `[p1, p1]` for single-parent ones; for
// progeny links the source is the parent and the target is the child
// (single node, may or may not be wrapped in an array depending on
// link kind). We only inspect ids; any super-root involvement triggers
// suppression.
type LinkDatum = {
  is_ancestry?: boolean
  source?: unknown
  target?: unknown
}

function isLinkDatum(value: unknown): value is LinkDatum {
  if (!value || typeof value !== 'object') return false
  return 'source' in value || 'target' in value
}

/**
 * Pull an id off a node-shape value, which family-chart writes in
 * various forms across its link kinds. Robust to both `{ data: { id }}`
 * (d3.hierarchy node) and `{ data: { data: { id } }}` (wrapped tree
 * datum) by falling through both shapes.
 */
function readNodeId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { data?: { id?: unknown; data?: { id?: unknown } } }
  const direct = v.data?.id
  if (typeof direct === 'string') return direct
  const nested = v.data?.data?.id
  if (typeof nested === 'string') return nested
  return null
}

function involvesSuperRoot(datum: LinkDatum): boolean {
  // Source check (single node or array wrapper)
  const src = datum.source as unknown
  if (readNodeId(src) === SUPER_ROOT_ID) return true
  if (Array.isArray(src) && src.some((s) => readNodeId(s) === SUPER_ROOT_ID)) {
    return true
  }
  // Target check (commonly an array `[p1, p2]` for ancestry; a single
  // node for progeny / couple-bar links)
  const tgt = datum.target as unknown
  if (readNodeId(tgt) === SUPER_ROOT_ID) return true
  if (Array.isArray(tgt) && tgt.some((t) => readNodeId(t) === SUPER_ROOT_ID)) {
    return true
  }
  return false
}

/**
 * Walk every `.link` path in the chart's links_view and zero any whose
 * source or target is the synthetic super-root. Idempotent — re-running
 * against an already-suppressed path is a no-op.
 */
function suppressOnce(linksView: SVGGElement): void {
  const paths = linksView.querySelectorAll<SVGPathElement>('path.link')
  paths.forEach((path) => {
    const datum = (path as PathWithData).__data__
    if (!isLinkDatum(datum)) return
    if (!involvesSuperRoot(datum)) return
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
