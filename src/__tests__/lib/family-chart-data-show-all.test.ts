// Issue #69 — unit tests for the super-root injection transform.
// Same shape as `family-chart-data.test.ts`: pure function in, pure
// array out — no DOM, no Supabase. Verifies the three branches the
// wrapper exposes (no roots / one root / multi-root) and that real
// root edges get rewired to the synthetic parent.

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

  test('one root → no super-root injected (base transform unchanged)', () => {
    const rows: PersonRow[] = [
      row({ id: 'patriarch', gender: 'm' }),
      row({ id: 'kid', father_id: 'patriarch' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    expect(out.map((d) => d.id)).toEqual(['patriarch', 'kid'])
    expect(out.find((d) => d.id === SUPER_ROOT_ID)).toBeUndefined()
    // The single real root keeps its empty parents array — not rewired.
    expect(out.find((d) => d.id === 'patriarch')!.rels.parents).toEqual([])
  })

  test('multiple roots → super-root prepended at data[0]', () => {
    const rows: PersonRow[] = [
      row({ id: 'root-a', gender: 'm' }),
      row({ id: 'root-b', gender: 'f' }),
      row({ id: 'kid', father_id: 'root-a', mother_id: 'root-b' }),
      // A second disconnected root, no edges to root-a / root-b.
      row({ id: 'orphan-root', gender: 'f' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)

    // Super-root sits at index 0 (the "above-the-tree" slot family-chart
    // assigns to data[0]).
    expect(out[0].id).toBe(SUPER_ROOT_ID)
    // It owns every real root as a child, preserving declaration order.
    expect(out[0].rels.children).toEqual(['root-a', 'root-b', 'orphan-root'])
    // And it has no parents itself.
    expect(out[0].rels.parents).toEqual([])
  })

  test('every real root has __super_root__ as its sole parent', () => {
    const rows: PersonRow[] = [
      row({ id: 'a', gender: 'm' }),
      row({ id: 'b', gender: 'f' }),
      row({ id: 'c' }),
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    const real = out.filter((d) => d.id !== SUPER_ROOT_ID)
    for (const d of real) {
      expect(d.rels.parents).toEqual([SUPER_ROOT_ID])
    }
  })

  test('non-root people keep their original parents (no rewire)', () => {
    const rows: PersonRow[] = [
      row({ id: 'gp1', gender: 'm' }),
      row({ id: 'gp2', gender: 'f' }),
      row({ id: 'parent', father_id: 'gp1', mother_id: 'gp2' }),
      row({ id: 'sibling-root', gender: 'f' }), // forces a second root
    ]
    const out = transformToFamilyChartShapeShowAll(rows)
    const parent = out.find((d) => d.id === 'parent')!
    // `parent` is not a root (has gp1 + gp2), so super-root must NOT
    // appear in its parents list — only the real grandparents do.
    expect(parent.rels.parents.sort()).toEqual(['gp1', 'gp2'])
  })

  test('SUPER_ROOT_ID is the documented sentinel string', () => {
    // Pinned because globals.css + super-root-link-suppressor + the
    // empty-card-html guard in FamilyTree.tsx all key off this exact id.
    expect(SUPER_ROOT_ID).toBe('__super_root__')
  })
})
