// Spike POC — issue #69, option (d): synthetic super-root injection.
//
// ADDITIVE FILE — does NOT modify the production-path family-chart-data.ts.
// Enable via: NEXT_PUBLIC_SHOW_ALL_PEOPLE=true in .env.local
//
// Problem being solved
// ────────────────────
// family-chart 0.9.0 renders only nodes reachable from main_id via an
// unbroken parent/child chain. With main_id = Catherine Smith:
//   visible: Catherine → George+Margaret (her parents)
//   hidden:  Henry Anderson, Eleanor Anderson, Andrew Anderson
//            (they are connected via Catherine's sibling Robert → spouse
//             Susan → parents Henry+Eleanor, but that is NOT a direct
//             parent/child path from Catherine).
//
// In the Smith Demo there are 5 root nodes (no father_id / mother_id):
//   George, Margaret, Henry, Eleanor, Nora
// Each root belongs to a different entry point of the family graph;
// only nodes reachable from the current main_id via their specific
// ancestry/progeny chain are visible.
//
// Solution
// ────────
// Inject a synthetic __super_root__ person whose rels.children = all
// real roots. Every root person gets __super_root__ as their single
// parent. Because family-chart's walk starts at main_id and follows
// ALL children of every ancestor it encounters, reaching __super_root__
// (the universal ancestor) exposes ALL root nodes as siblings, and their
// entire subtrees follow recursively — making everyone visible regardless
// of main_id.
//
// Example with main_id = Catherine:
//   Ancestry walk: Catherine → George+Margaret → __super_root__
//   At __super_root__: ALL children rendered → Henry+Eleanor appear
//   Henry+Eleanor's children: Susan, Andrew → visible ✓
//   Susan's children (via Robert): Daniel, Adam, Penny, Theo → visible ✓
//   Nora (Daniel's spouse, also a __super_root__ child) → visible ✓
//
// Limitations (accepted for this POC)
// ────────────────────────────────────
//   1. Layout churn — `updateMainId + updateTree` still repositions all
//      cards around the new main_id. This removes hiding but NOT churn.
//      Only option (e) — replace the layout engine — eliminates churn.
//   2. Blank row — __super_root__ occupies one card slot (158×110px) in
//      the layout. Visually hidden via CSS + empty card HTML, but the
//      space is still reserved. Produces ~110px blank at top of canvas.
//   3. Connector flash — links to __super_root__ are suppressed in
//      setAfterUpdate, but d3's 800ms transition tweens them back each
//      tick. Lines may briefly flash; a full implementation would add
//      a MutationObserver (same pattern as non-spouse-parent-links.ts).

import { transformToFamilyChartShape, type FamilyChartDatum } from './family-chart-data'
import type { PersonRow } from './types'

export const SUPER_ROOT_ID = '__super_root__'

/**
 * Wraps `transformToFamilyChartShape` and injects a synthetic super-root
 * node as the universal parent of all root nodes (people with no parents
 * in the tree). Returns the base transform unchanged if there are 0–1 roots
 * (the standard single-root walk already covers everyone in that case).
 */
export function transformToFamilyChartShapeShowAll(rows: PersonRow[]): FamilyChartDatum[] {
  const base = transformToFamilyChartShape(rows)

  // Root nodes: people with no parents recorded in this tree.
  const rootIds = base.filter((d) => d.rels.parents.length === 0).map((d) => d.id)

  // 0 or 1 root: standard walk already covers everyone — no super-root needed.
  if (rootIds.length <= 1) return base

  // Give every root node a single synthetic parent.
  const grafted: FamilyChartDatum[] = base.map((d) =>
    d.rels.parents.length === 0
      ? { ...d, rels: { ...d.rels, parents: [SUPER_ROOT_ID] } }
      : d,
  )

  // Synthetic layout-anchor node — invisible, just provides connectivity.
  // gender: 'M' satisfies the library's typed surface; layout-only.
  // tone: 'sage' is an arbitrary valid value (PersonRow['tone'] constraint).
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

  // Super-root is prepended so it's family-chart's data[0] — the library
  // uses the first element as the default main_id if none is set explicitly.
  // Prepending (rather than appending) keeps it in the "above the tree"
  // position that matches its layout role.
  return [superRoot, ...grafted]
}
