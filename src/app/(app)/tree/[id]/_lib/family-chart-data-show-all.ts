// Issue #69 (v1.1) — option (d) synthetic super-root, always on.
//
// Wraps `transformToFamilyChartShape` and injects a synthetic `__super_root__`
// node as the universal parent of every otherwise-rootless person in the
// tree. The injection makes the layout walk reach all root subtrees from
// ANY `main_id` — eliminating the "out of thin air" experience where
// re-centering on a new person would suddenly reveal previously hidden
// distant relatives.
//
// PROBLEM
//   family-chart 0.9.0 (`node_modules/family-chart/dist/family-chart.js:604`
//   `calculateTree`) lays out the canvas by walking two d3 hierarchies
//   rooted at `main_id` — ancestors via `rels.parents`, descendants via
//   `rels.children`. Anything not reachable from `main_id` through one of
//   those edges is silently absent from the rendered tree.
//
// SOLUTION
//   Inject one synthetic `__super_root__` datum whose `rels.children` is
//   the list of every real root id. Every real root gets `__super_root__`
//   as its sole parent. family-chart's walk follows ALL children of every
//   ancestor it encounters, so reaching `__super_root__` from any `main_id`
//   exposes every other root subtree as a sibling chain — making the full
//   graph visible regardless of focus.
//
// COUPLING
//   FamilyTree.tsx's seed-focus computation coerces to `people[0]?.id` so
//   the chart's data[0] fallback never lands on the invisible super-root;
//   see the spec §"Initial `main_id` fallback hardening".
//   globals.css hides the super-root foreignObject via the `:has()` rule
//   on `data-person-id="__super_root__"`.
//   super-root-link-suppressor.ts zeros connector lines that target the
//   super-root during d3's transition window.
//
// LIMITATIONS (accepted for v1.1)
//   - Layout churn — `updateMainId + updateTree` still repositions all
//     cards around the new main_id. Option (d) removes hiding but NOT
//     position churn. Option (e) — replace the layout engine — is the
//     v1.2+ candidate if users still want a fixed-position map.
//   - Reserved layout slot — `__super_root__` occupies one card row in
//     the layout grid even when invisible. globals.css applies a scoped
//     negative-margin to compensate; see globals.css.
//
// See docs/superpowers/specs/2026-06-01-issue-69-show-all-people-design.md
// for the canonical decision record.

import { transformToFamilyChartShape, type FamilyChartDatum } from './family-chart-data'
import type { PersonRow } from './types'

export const SUPER_ROOT_ID = '__super_root__'

/**
 * Transform our `people` rows into family-chart's `Datum[]` shape, with
 * a synthetic `__super_root__` node prepended as the universal parent
 * of every real root.
 *
 * If the tree has 0 or 1 real roots, no super-root is injected and the
 * function delegates to `transformToFamilyChartShape` unchanged — the
 * single-root walk already covers every reachable person in that case.
 */
export function transformToFamilyChartShapeShowAll(rows: PersonRow[]): FamilyChartDatum[] {
  const base = transformToFamilyChartShape(rows)

  // Roots = nodes with no parents in this tree.
  const rootIds = base.filter((d) => d.rels.parents.length === 0).map((d) => d.id)

  // 0 or 1 root: standard walk already covers everyone — no super-root needed.
  if (rootIds.length <= 1) return base

  // Give every root a single synthetic parent.
  const grafted: FamilyChartDatum[] = base.map((d) =>
    d.rels.parents.length === 0
      ? { ...d, rels: { ...d.rels, parents: [SUPER_ROOT_ID] } }
      : d,
  )

  // Synthetic layout-anchor node — invisible, just provides connectivity.
  // `gender: 'M'` and `tone: 'sage'` are arbitrary valid values; the node
  // never actually renders. The empty bio / location / years are fine
  // because `personNodeHtml` returns a zero-size sentinel for this id.
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
      children: rootIds,
    },
  }

  // Super-root is prepended so it sits at family-chart's data[0]. The
  // library uses `data[0]` as the default main_id ONLY when `updateMainId`
  // is never called; FamilyTree.tsx always coerces to a real `people[0]?.id`
  // before the first `updateTree`, so this prepend is purely layout-positional
  // (it places super-root in the "above-the-tree" slot the library assigns
  // to data[0]).
  return [superRoot, ...grafted]
}
