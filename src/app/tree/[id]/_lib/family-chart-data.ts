// Phase 4 sub-task 1 — pure transform from our `people` row shape into the
// shape `family-chart` (donatso/family-chart, v0.9.0) expects on
// `f3.createChart(container, data)`.
//
// Library contract (verified against
//   node_modules/family-chart/dist/types/types/data.d.ts):
//
//   interface Datum {
//     id: string
//     data: { gender: 'M' | 'F'; [k: string]: any }
//     rels: { parents: string[]; spouses: string[]; children: string[] }
//   }
//
// Notes for future-me:
//
//  1. `rels.children` is DERIVED here from `father_id` / `mother_id` and
//     never persisted — that's the schema decision recorded in
//     `docs/architecture/data-model.md`. Each pass over `rows` is O(n²) in
//     the worst case for the children walk, which is fine for our 50–200
//     people per tree target; if we ever blow past that we'd swap to a
//     `parentId → children[]` Map built once.
//
//  2. Gender mapping. Our schema uses
//     `'m' | 'f' | 'other' | 'unknown'`; family-chart's typed surface only
//     accepts `'M' | 'F'`. The library uses gender for *layout* (spouse
//     positioning). We map `'other'` and `'unknown'` to `'M'` so the layout
//     algorithm is happy. The actual stored gender stays available under
//     `data.gender_raw` so the eventual custom node renderer (sub-task 2)
//     can show the truthful value / Phase 8 can swap avatar shape by it.
//
//  3. Defensive `spouses[]`. Phase 3's `set_spouse_atomic` RPC keeps
//     `spouse_id` bidirectionally symmetric, so in practice both sides will
//     reference each other. We still splice based purely on this row's
//     `spouse_id` (no reverse lookup) — if symmetry is ever broken by a
//     hand-edit, family-chart will still render the link visible from
//     whichever side has it, which is the kinder failure mode than
//     swallowing it.

import type { PersonRow } from './types'

export type FamilyChartDatum = {
  id: string
  data: {
    gender: 'M' | 'F'
    full_name: string
    first_name: string
    last_name: string
    nickname: string | null
    photo_url: string | null
    birth_year: number | null
    death_year: number | null
    deceased: boolean
    location: string | null
    occupation: string | null
    bio: string | null
    tone: PersonRow['tone']
    // Truthful raw gender for the eventual custom renderer.
    gender_raw: PersonRow['gender']
  }
  rels: {
    parents: string[]
    spouses: string[]
    children: string[]
  }
}

function mapGender(g: PersonRow['gender']): 'M' | 'F' {
  if (g === 'f') return 'F'
  // 'm', 'other', 'unknown' → 'M' for layout-only purposes. See note (2).
  return 'M'
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  const [first, ...rest] = parts
  return { first, last: rest.join(' ') }
}

export function transformToFamilyChartShape(rows: PersonRow[]): FamilyChartDatum[] {
  return rows.map((p) => {
    const parents: string[] = []
    if (p.father_id) parents.push(p.father_id)
    if (p.mother_id) parents.push(p.mother_id)

    const spouses: string[] = p.spouse_id ? [p.spouse_id] : []

    const children: string[] = rows
      .filter((c) => c.father_id === p.id || c.mother_id === p.id)
      .map((c) => c.id)

    const { first, last } = splitName(p.full_name)

    return {
      id: p.id,
      data: {
        gender: mapGender(p.gender),
        full_name: p.full_name,
        first_name: first,
        last_name: last,
        nickname: p.nickname,
        photo_url: p.photo_url,
        birth_year: p.birth_year,
        death_year: p.death_year,
        deceased: p.deceased,
        location: p.location,
        occupation: p.occupation,
        bio: p.bio,
        tone: p.tone,
        gender_raw: p.gender,
      },
      rels: {
        parents,
        spouses,
        children,
      },
    }
  })
}
