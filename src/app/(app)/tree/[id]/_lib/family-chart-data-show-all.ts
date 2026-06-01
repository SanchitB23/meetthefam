// Issue #69 (v1.1) — option (d') synthetic super-root + floating-partner
// synthesis, always on. Wraps `transformToFamilyChartShape` and adjusts
// the graph so family-chart's progeny walk from a pinned super-root
// main_id reaches every person in the tree without exploding the
// duplicate-card count.
//
// PROBLEM
//   family-chart 0.9.0 (`node_modules/family-chart/dist/family-chart.js:604`
//   `calculateTree`) lays out the canvas by walking two d3 hierarchies
//   rooted at `main_id` — ancestors via `rels.parents`, descendants via
//   `rels.children`. Anything not reachable from `main_id` through one of
//   those edges is silently absent from the rendered tree.
//
//   Pinning `main_id` to a synthetic super-root and giving every
//   rootless person `parents: [super_root]` works in principle, but in
//   practice creates a layout pathology at our seed size (#69 v1.1):
//
//     * Gen-2 / Gen-3 in-laws (e.g. Olivia, Carlos, Nora, Lily, …) are
//       rootless in the data (no parents in tree) AND married to deeper-
//       generation in-tree people (Walter, Daniel, Adam, …). Making them
//       super-root's children puts them at layout-level-1 while their
//       spouse is at level-2/3, so each marriage spans multiple layout
//       levels.
//     * family-chart's only tool for cross-level marriages is to duplicate
//       one of the partners so a same-level marriage edge can be drawn.
//       With 9 such cross-level in-laws in our seed, the duplicate cascade
//       blows the rendered card count from 55 to ~200 and crushes the
//       layout into a single horizontal strip.
//
// SOLUTION
//   1. Only the "eldest patriarchs / matriarchs" become super-root's
//      children: rootless people whose spouse (if any) is ALSO rootless,
//      AND truly free-floating rootless solo people (no spouse, no
//      children). Other in-laws stay rootless in `rels.parents` but get
//      rendered via their spouse's spouse link — a sideways edge with no
//      level crossing, no duplicates.
//
//   2. "Floating co-parents" (rootless, no spouse, has children — e.g.
//      Carlos, Eve's unmarried partner) are synthesised a one-sided
//      spouse link to the in-tree other-parent of one of their children,
//      iff that other-parent has no spouse already. The synthesis is
//      data-only — it never touches the DB.
//
// COUPLING
//   FamilyTree.tsx pins `main_id` to SUPER_ROOT_ID for the chart's
//   lifetime; "re-center" pans the d3-zoom camera via panCameraTo.
//   globals.css hides the super-root foreignObject via the `:has()` rule.
//   super-root-link-suppressor.ts zeros connector lines that touch the
//   super-root during d3's transition window.
//
// See docs/superpowers/specs/2026-06-01-issue-69-show-all-people-design.md
// for the canonical decision record.

import { transformToFamilyChartShape, type FamilyChartDatum } from './family-chart-data'
import type { PersonRow } from './types'

export const SUPER_ROOT_ID = '__super_root__'

/**
 * Transform our `people` rows into family-chart's `Datum[]` shape and
 * inject the synthetic super-root + any floating-partner spouse
 * synthesis needed for everyone to render under `main_id = SUPER_ROOT_ID`.
 *
 * 0/1 patriarch-matriarch case (e.g. an empty or single-trunk tree) is
 * a no-op — the standard single-root walk already covers everyone.
 */
export function transformToFamilyChartShapeShowAll(rows: PersonRow[]): FamilyChartDatum[] {
  // Deep-ish clone of every datum's `rels` so we can mutate parents /
  // spouses / children freely without leaking back into the caller's
  // shape. `transformToFamilyChartShape` returns fresh arrays already;
  // we still recreate them defensively because two of our passes mutate.
  const base = transformToFamilyChartShape(rows).map((d) => ({
    ...d,
    rels: {
      parents: [...d.rels.parents],
      spouses: [...d.rels.spouses],
      children: [...d.rels.children],
    },
  }))
  const byId = new Map(base.map((d) => [d.id, d]))

  const isRootless = (d: FamilyChartDatum) => d.rels.parents.length === 0

  // Pass 1 — synthesise spouse links for "floating co-parents": rootless
  // people with no spouse but at least one child, whose child's other
  // parent has no spouse. Concrete case: Carlos Vargas (Eve Smith's
  // unmarried partner in the local seed). Without this, Carlos is
  // unreachable from any walk because his only graph edges point DOWN
  // to his kids and family-chart doesn't backtrack up to render the
  // other parent of a rendered child.
  for (const partner of base) {
    if (!isRootless(partner)) continue
    if (partner.rels.spouses.length > 0) continue
    if (partner.rels.children.length === 0) continue
    for (const childId of partner.rels.children) {
      const child = byId.get(childId)
      if (!child) continue
      const otherParentId = child.rels.parents.find((p) => p !== partner.id)
      if (!otherParentId) continue
      const otherParent = byId.get(otherParentId)
      if (!otherParent) continue
      if (otherParent.rels.spouses.length > 0) continue // don't clobber a real marriage
      // Synthesise bidirectional spouse link (in-memory only — never
      // written back to the DB).
      partner.rels.spouses.push(otherParent.id)
      otherParent.rels.spouses.push(partner.id)
      break // one synthesis per floating partner is enough
    }
  }

  // Pass 1.5 — dedupe `rels.children` across spouse couples.
  //
  // The base transform lists every child under BOTH their father and
  // their mother. That's fine when family-chart's main_id is at a leaf
  // (each ancestor appears once in the ancestry walk), but with our
  // pinned main_id = super-root the *progeny* walk runs in two parallel
  // branches: super_root → George → his kids, AND super_root → Margaret
  // → her kids. Same kids, both walks, two layout positions, a duplicate
  // card cascade across every Gen-2+ person.
  //
  // Fix: for every datum with TWO in-tree parents, keep it as a child
  // of only the FIRST parent listed (the father by base-transform
  // convention — see `family-chart-data.ts:107-109`). The second parent
  // is still rendered as the first parent's spouse via family-chart's
  // setupSpouses, and the marriage bar positions the kid centered under
  // both. No visible-layout regression vs. the dual-listing approach.
  //
  // Single-parent kids (e.g. Luca, whose father isn't in the tree) are
  // already in only one parent's list — this pass leaves them alone.
  for (const d of base) {
    if (d.rels.parents.length < 2) continue
    const dropFromId = d.rels.parents[1] // second parent
    const dropFrom = byId.get(dropFromId)
    if (!dropFrom) continue
    dropFrom.rels.children = dropFrom.rels.children.filter((cid) => cid !== d.id)
  }

  // Pass 2 — identify "true root patriarchs/matriarchs": rootless and
  // (no spouse OR every spouse also rootless). Cross-level in-laws (a
  // rootless person whose spouse has parents) are deliberately EXCLUDED
  // — they get rendered via their spouse's spouse link instead.
  function isTrueRoot(d: FamilyChartDatum): boolean {
    if (!isRootless(d)) return false
    if (d.rels.spouses.length === 0) return true
    return d.rels.spouses.every((spouseId) => {
      const spouse = byId.get(spouseId)
      return spouse ? isRootless(spouse) : false
    })
  }

  const trueRoots = base.filter(isTrueRoot)

  // 0 or 1 true root: single-trunk tree (or empty). No super-root
  // injection needed; the standard walk from `main_id = data[0]` (which
  // FamilyTree.tsx already overrides to SUPER_ROOT_ID then falls back
  // to the lone root) covers everyone reachable.
  if (trueRoots.length <= 1) return base

  // Pass 3 — rewire each true root's parents to [SUPER_ROOT_ID].
  const trueRootIds = new Set(trueRoots.map((d) => d.id))
  for (const d of base) {
    if (trueRootIds.has(d.id)) {
      d.rels.parents = [SUPER_ROOT_ID]
    }
  }

  // Synthetic layout-anchor node — invisible, just provides connectivity.
  // `gender: 'M'` and `tone: 'sage'` are arbitrary valid values; the node
  // never renders. `personNodeHtml` returns a zero-size sentinel for
  // this id; CSS hides the foreignObject via `:has()`.
  const superRoot: FamilyChartDatum = {
    id: SUPER_ROOT_ID,
    data: {
      gender: 'M',
      full_name: '',
      first_name: '',
      last_name: '',
      nickname: null,
      photo_url: null,
      birth_year: null,
      death_year: null,
      deceased: false,
      location: null,
      occupation: null,
      bio: null,
      tone: 'sage',
      gender_raw: 'unknown',
    },
    rels: {
      parents: [],
      spouses: [],
      children: trueRoots.map((d) => d.id),
    },
  }

  // Super-root prepended so it sits at family-chart's data[0] — the
  // "above-the-tree" layout slot. FamilyTree.tsx always pins
  // chart.updateMainId(SUPER_ROOT_ID) before the first updateTree, so
  // the data[0] default would have been super-root either way.
  return [superRoot, ...base]
}
