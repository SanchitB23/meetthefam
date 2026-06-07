// Issue #69 — unit tests for the super-root injection transform.
// Same shape as `family-chart-data.test.ts`: pure function in, pure
// array out — no DOM, no Supabase. Covers the three branches the
// wrapper exposes (no roots / one root / multi-root), the tighter
// "only true patriarchs/matriarchs" rooting (cross-level in-laws
// are NOT super-root's children — they're reached via spouse links),
// and the floating-partner spouse synthesis.

import { describe, expect, test } from 'vitest'

import {
  SUPER_ROOT_ID,
  transformToFamilyChartShapeShowAll,
} from '@/app/(app)/tree/[id]/_lib/family-chart-data-show-all'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'

function row(overrides: Partial<PersonRow>): PersonRow {
  return {
    id: 'p-?',
    tree_id: 't-1',
    full_name: 'Anon',
    nickname: null,
    gender: 'unknown',
    photo_url: null,
    bio: null,
    birth_year: null,
    birth_date: null,
    location: null,
    occupation: null,
    deceased: false,
    death_year: null,
    father_id: null,
    mother_id: null,
    spouse_id: null,
    tone: 'sage',
    ...overrides,
  }
}

describe('transformToFamilyChartShapeShowAll', () => {
  test('empty input → empty output, no super-root injected', () => {
    expect(transformToFamilyChartShapeShowAll([])).toEqual([])
  })

  // #224 — a SINGLE primary root (one founding patriarch / couple, the
  // common case) MUST still get a super-root. FamilyTree pins
  // `main_id = SUPER_ROOT_ID` for the chart's lifetime; without injection
  // that id is absent and family-chart falls back to `data_stash[0]`. The
  // `people` query has no ORDER BY, so data[0] is an arbitrary row — a
  // leaf data[0] collapses the render to ~2 nodes. (Previously this case
  // asserted "no super-root injected" — that encoded the bug.)
  test('single-trunk tree (one rootless patriarch) → super-root IS injected (#224)', () => {
    const rows: PersonRow[] = [
      row({ id: 'patriarch', gender: 'm' }),
      row({ id: 'kid', father_id: 'patriarch' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    // Super-root sits at index 0 so the pinned main_id resolves to it.
    expect(out[0].id).toBe(SUPER_ROOT_ID)
    // It anchors the lone real root.
    expect(out.find((d) => d.id === SUPER_ROOT_ID)!.rels.children).toEqual(['patriarch'])
    expect(out.find((d) => d.id === 'patriarch')!.rels.parents).toEqual([SUPER_ROOT_ID])
    // No real person is dropped.
    expect(out.filter((d) => d.id !== SUPER_ROOT_ID).map((d) => d.id).sort()).toEqual([
      'kid',
      'patriarch',
    ])
  })

  test('multiple Gen-1 couples → only the primary partner of each couple is a super-root child', () => {
    // For each true-root couple, only the first-declared partner becomes
    // super-root's child. The second is reached via the first's spouse-
    // link, eliminating the double-render that would otherwise emit one
    // duplicate card per Gen-1 partner.
    const rows: PersonRow[] = [
      // Couple A — both rootless, married to each other.
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      // Couple B — both rootless, married to each other.
      row({ id: 'b1', gender: 'm', spouse_id: 'b2' }),
      row({ id: 'b2', gender: 'f', spouse_id: 'b1' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)

    // Super-root sits at index 0.
    expect(out[0].id).toBe(SUPER_ROOT_ID)
    // Owns ONLY the primary partner of each couple.
    expect(out[0].rels.children).toEqual(['a1', 'b1'])
    // Has no parents itself.
    expect(out[0].rels.parents).toEqual([])
    // Primary partners have SUPER_ROOT_ID as their sole parent.
    expect(out.find((d) => d.id === 'a1')!.rels.parents).toEqual([SUPER_ROOT_ID])
    expect(out.find((d) => d.id === 'b1')!.rels.parents).toEqual([SUPER_ROOT_ID])
    // Secondary partners stay rootless (reached via spouse-link).
    expect(out.find((d) => d.id === 'a2')!.rels.parents).toEqual([])
    expect(out.find((d) => d.id === 'b2')!.rels.parents).toEqual([])
  })

  test('solo rootless person (no spouse) is still a super-root child', () => {
    const rows: PersonRow[] = [
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      // Solo rootless — no spouse, no children. True root.
      row({ id: 'solo', gender: 'f' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    const superRoot = out.find((d) => d.id === SUPER_ROOT_ID)!
    // `a1` is primary of couple A; `solo` is its own primary.
    expect(superRoot.rels.children).toEqual(['a1', 'solo'])
    expect(out.find((d) => d.id === 'solo')!.rels.parents).toEqual([SUPER_ROOT_ID])
  })

  test('cross-level in-law is NOT super-root child — stays rootless, reached via spouse link', () => {
    // Tightened logic for #69 v1.1: making cross-level in-laws (rootless
    // person married to a deeper-generation in-tree person) super-root
    // children was the original layout-pathology cause (cards duplicate
    // to bridge the level gap). They must remain rootless in `parents`.
    const rows: PersonRow[] = [
      // Couple A — Gen-1 patriarchs.
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      // Couple B — Gen-1 patriarchs.
      row({ id: 'b1', gender: 'm', spouse_id: 'b2' }),
      row({ id: 'b2', gender: 'f', spouse_id: 'b1' }),
      // Gen-2 son of A, married to a Gen-2 in-law (rootless).
      row({ id: 'a_son', father_id: 'a1', mother_id: 'a2', spouse_id: 'inlaw' }),
      row({ id: 'inlaw', gender: 'f', spouse_id: 'a_son' }), // rootless in-law
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    const inlaw = out.find((d) => d.id === 'inlaw')!
    // Cross-level in-law stays rootless — NOT rewired to super-root.
    expect(inlaw.rels.parents).toEqual([])
    // Super-root children = primary partner of each Gen-1 couple ONLY
    // (matriarchs reached via spouse-link); in-law not included.
    const superRoot = out.find((d) => d.id === SUPER_ROOT_ID)!
    expect(superRoot.rels.children).toEqual(['a1', 'b1'])
  })

  test('floating co-parent (rootless, no spouse, has children) — synthesise spouse link', () => {
    // Carlos-style case: rootless person whose only graph edges point
    // DOWN to their kids. We synthesise a bidirectional spouse link to
    // the child's other parent so family-chart can render them.
    const rows: PersonRow[] = [
      // Gen-1 couple — patriarch + matriarch.
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      // Gen-1 second couple — needed so super-root injection fires.
      row({ id: 'b1', gender: 'm', spouse_id: 'b2' }),
      row({ id: 'b2', gender: 'f', spouse_id: 'b1' }),
      // Daughter of Gen-1 couple A (in-tree, unmarried).
      row({ id: 'a_daughter', gender: 'f', father_id: 'a1', mother_id: 'a2' }),
      // Floating co-parent — rootless, unmarried, has a kid with a_daughter.
      row({ id: 'floater', gender: 'm' }),
      // Their child — references both as parents.
      row({ id: 'kid', father_id: 'floater', mother_id: 'a_daughter' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    const floater = out.find((d) => d.id === 'floater')!
    const daughter = out.find((d) => d.id === 'a_daughter')!

    // Synthesised spouse link is bidirectional.
    expect(floater.rels.spouses).toEqual(['a_daughter'])
    expect(daughter.rels.spouses).toEqual(['floater'])

    // Now `floater` has a spouse (`a_daughter`) who is NOT rootless —
    // so floater is NOT a true root → NOT super-root's child.
    const superRoot = out.find((d) => d.id === SUPER_ROOT_ID)!
    expect(superRoot.rels.children).not.toContain('floater')
    expect(floater.rels.parents).toEqual([])
  })

  test('synthesis does not clobber an existing marriage', () => {
    // If the floater's child has an other-parent who is already married,
    // synthesis must not rewrite that marriage. The floater remains
    // unreachable in that case (documented limitation).
    const rows: PersonRow[] = [
      // Gen-1 couples
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      row({ id: 'b1', gender: 'm', spouse_id: 'b2' }),
      row({ id: 'b2', gender: 'f', spouse_id: 'b1' }),
      // In-tree daughter married to in-tree husband.
      row({ id: 'a_daughter', gender: 'f', father_id: 'a1', mother_id: 'a2', spouse_id: 'a_husband' }),
      row({ id: 'a_husband', gender: 'm', father_id: 'b1', mother_id: 'b2', spouse_id: 'a_daughter' }),
      // Floater claims to be co-parent of the kid (e.g. step-parent scenario).
      row({ id: 'floater', gender: 'm' }),
      row({ id: 'kid', father_id: 'floater', mother_id: 'a_daughter' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    const daughter = out.find((d) => d.id === 'a_daughter')!
    const floater = out.find((d) => d.id === 'floater')!
    // Daughter's marriage to a_husband is preserved.
    expect(daughter.rels.spouses).toEqual(['a_husband'])
    // Floater stays sad-and-spouseless.
    expect(floater.rels.spouses).toEqual([])
  })

  test('non-root people keep their original parents (no rewire)', () => {
    const rows: PersonRow[] = [
      row({ id: 'gp1', gender: 'm', spouse_id: 'gp2' }),
      row({ id: 'gp2', gender: 'f', spouse_id: 'gp1' }),
      row({ id: 'gp3', gender: 'm', spouse_id: 'gp4' }), // forces a 2nd true root
      row({ id: 'gp4', gender: 'f', spouse_id: 'gp3' }),
      row({ id: 'parent', father_id: 'gp1', mother_id: 'gp2' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    const parent = out.find((d) => d.id === 'parent')!
    // `parent` is not a root (has gp1 + gp2), so super-root must NOT
    // appear in its parents list.
    expect(parent.rels.parents.sort()).toEqual(['gp1', 'gp2'])
  })

  test('two-parent child appears in only ONE parent rels.children (dedupe)', () => {
    // The base transform lists every child under BOTH parents. That
    // double-listing causes family-chart's d3.hierarchy progeny walk
    // (from main_id=super_root) to visit each kid twice and emit a
    // duplicate card. The dedupe pass keeps the kid under one parent
    // only — preferring the father (parents[0]) when both are equally
    // reachable from super-root.
    const rows: PersonRow[] = [
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      row({ id: 'b1', gender: 'm', spouse_id: 'b2' }), // forces a 2nd true root
      row({ id: 'b2', gender: 'f', spouse_id: 'b1' }),
      row({ id: 'kid', father_id: 'a1', mother_id: 'a2' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    expect(out.find((d) => d.id === 'a1')!.rels.children).toEqual(['kid'])
    expect(out.find((d) => d.id === 'a2')!.rels.children).toEqual([])
  })

  test('dedupe prefers the parent reachable from super-root (Sophia/Diego case)', () => {
    // Carlos is a "floating co-parent" — rootless with no DB spouse but
    // children with in-tree Eve. The synthesis pass gives Carlos
    // spouses=[eve], eve gets spouses=[carlos]. But Carlos's spouse is
    // non-rootless (Eve has parents), so Carlos won't be a super-root
    // child → Carlos is NEVER walked by d3.hierarchy from super-root.
    //
    // Sophia.rels.parents = [carlos, eve]. If the dedupe naively kept
    // Sophia under parents[0]=carlos, Sophia would be unreachable from
    // any walk. Must keep her under Eve (the reachable parent).
    const rows: PersonRow[] = [
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      row({ id: 'b1', gender: 'm', spouse_id: 'b2' }), // forces a 2nd true root
      row({ id: 'b2', gender: 'f', spouse_id: 'b1' }),
      row({ id: 'eve', gender: 'f', father_id: 'a1', mother_id: 'a2' }),
      row({ id: 'carlos', gender: 'm' }), // rootless floater
      row({ id: 'sophia', gender: 'f', father_id: 'carlos', mother_id: 'eve' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    expect(out.find((d) => d.id === 'eve')!.rels.children).toEqual(['sophia'])
    expect(out.find((d) => d.id === 'carlos')!.rels.children).toEqual([])
  })

  test('single-parent child remains under their only parent (no dedupe)', () => {
    const rows: PersonRow[] = [
      row({ id: 'a1', gender: 'm', spouse_id: 'a2' }),
      row({ id: 'a2', gender: 'f', spouse_id: 'a1' }),
      row({ id: 'b1', gender: 'm', spouse_id: 'b2' }), // forces a 2nd true root
      row({ id: 'b2', gender: 'f', spouse_id: 'b1' }),
      // Single-parent child (e.g. donor-assisted same-sex parent case).
      row({ id: 'kid', mother_id: 'a2' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    expect(out.find((d) => d.id === 'a2')!.rels.children).toEqual(['kid'])
  })

  test('SUPER_ROOT_ID is the documented sentinel string', () => {
    expect(SUPER_ROOT_ID).toBe('__super_root__')
  })
})
