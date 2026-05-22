// POC for issue #69 — option (d): synthetic super-root injection.
//
// Goal: render every person in the tree regardless of which person is the
// current layout root (main_id). This is a SPIKE-ONLY file — it does not
// touch the production `transformToFamilyChartShape` or any PersonRow.
//
// How it works:
//   1. Run the normal transform to get all FamilyChartDatum objects.
//   2. Find "root" datums — those whose rels.parents is empty after the base
//      transform. In the Smith Demo these are:
//        George Smith, Margaret Smith, Henry Anderson, Eleanor Anderson, Nora Smith
//        (5 nodes: the two Gen-1 couples + the in-law spouse with no parents in tree).
//   3. If 0–1 roots exist, return the datums unchanged (single-root tree, no-op).
//   4. Inject a synthetic `__super_root__` datum whose rels.children = all root IDs.
//   5. Mutate each root datum to add `__super_root__` to rels.parents.
//
// Why this makes everyone visible:
//   family-chart renders ALL children of every ancestor encountered in the
//   upward walk from main_id. By making __super_root__ the universal parent
//   of all Gen-1 nodes, any focus person's ancestry chain eventually reaches
//   __super_root__, which forces family-chart to render ALL its children
//   (George+Margaret, Henry+Eleanor, Nora, ...) — plus all their descendants.
//   Result: all 13 Smith Demo people are visible regardless of focus.
//
// Known POC limitations (documented in issue #69 comment):
//   - The super-root card still occupies layout space (158×110 px) even when
//     hidden; CSS opacity:0 hides it but doesn't collapse the blank row.
//   - Node positions still shift on updateMainId()+updateTree() re-centers.
//     For a truly static "pan over a map" layout, option (e) (layout engine
//     replacement) would be needed.
//   - Connector lines from root people to super-root are suppressed in the
//     after-update hook but may briefly flash during d3's 800ms transition.

import { transformToFamilyChartShape, type FamilyChartDatum } from './family-chart-data'
import type { PersonRow } from './types'

export const SUPER_ROOT_ID = '__super_root__'

/**
 * Augmented variant of `transformToFamilyChartShape` that injects a hidden
 * synthetic super-root node so all people remain visible regardless of the
 * current layout root (main_id).
 *
 * Returns the base datums unchanged when there are 0 or 1 root nodes.
 */
export function transformToFamilyChartShapeShowAll(rows: PersonRow[]): FamilyChartDatum[] {
  const datums = transformToFamilyChartShape(rows)

  // Find root datums — nodes with no parents in this tree.
  const rootIds = datums.filter((d) => d.rels.parents.length === 0).map((d) => d.id)

  // Single-root (or empty) tree: a super-root would be a no-op.
  if (rootIds.length <= 1) return datums

  // Shallow-clone datums so we don't mutate the base transform's objects.
  const augmented = datums.map((d) => {
    if (!rootIds.includes(d.id)) return d
    return {
      ...d,
      rels: {
        ...d.rels,
        parents: [SUPER_ROOT_ID],
      },
    }
  })

  // Build the synthetic super-root.
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
      // Tone / gender_raw are required by the FamilyChartDatum type.
      // They're never rendered (card returns empty HTML), but TS needs them.
      tone: 'sage',
      gender_raw: 'unknown',
    },
    rels: {
      parents: [],
      spouses: [],
      children: rootIds,
    },
  }

  // Place super-root first: family-chart defaults main_id to data[0].id when
  // no explicit focus is set, which gives us the "show everyone" initial view.
  return [superRoot, ...augmented]
}
