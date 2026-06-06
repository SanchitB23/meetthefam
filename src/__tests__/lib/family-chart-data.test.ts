// Phase 4 sub-task 6 — unit tests for the pure people-row → family-chart
// data transform. No DB; no Supabase; no DOM. Pure function in, pure
// array out — perfect for Vitest's default Node environment.

import { describe, expect, test } from 'vitest'

import {
  arePartnersMarried,
  transformToFamilyChartShape,
} from '@/app/(app)/tree/[id]/_lib/family-chart-data'
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

describe('transformToFamilyChartShape', () => {
  test('children are derived from father_id / mother_id, not stored', () => {
    const rows: PersonRow[] = [
      row({ id: 'dad', full_name: 'Dad', gender: 'm' }),
      row({ id: 'mom', full_name: 'Mom', gender: 'f' }),
      row({ id: 'kid', full_name: 'Kid', father_id: 'dad', mother_id: 'mom' }),
    ]
    const out = transformToFamilyChartShape(rows)

    const dad = out.find((d) => d.id === 'dad')!
    const mom = out.find((d) => d.id === 'mom')!
    const kid = out.find((d) => d.id === 'kid')!

    expect(dad.rels.children).toEqual(['kid'])
    expect(mom.rels.children).toEqual(['kid'])
    expect(kid.rels.children).toEqual([])
    expect(kid.rels.parents.sort()).toEqual(['dad', 'mom'])
  })

  test('null father / mother / spouse ids do not appear in rels arrays', () => {
    const rows: PersonRow[] = [
      row({
        id: 'solo',
        father_id: null,
        mother_id: null,
        spouse_id: null,
      }),
    ]
    const [solo] = transformToFamilyChartShape(rows)
    expect(solo.rels.parents).toEqual([])
    expect(solo.rels.spouses).toEqual([])
    expect(solo.rels.children).toEqual([])
  })

  test('only one parent set → only that parent in rels.parents', () => {
    const rows: PersonRow[] = [
      row({ id: 'mom', gender: 'f' }),
      row({ id: 'kid', mother_id: 'mom' }),
    ]
    const out = transformToFamilyChartShape(rows)
    const kid = out.find((d) => d.id === 'kid')!
    expect(kid.rels.parents).toEqual(['mom'])
  })

  test('spouse_id produces a one-element spouses array (defensive)', () => {
    const rows: PersonRow[] = [
      row({ id: 'a', spouse_id: 'b' }),
      row({ id: 'b', spouse_id: 'a' }),
    ]
    const out = transformToFamilyChartShape(rows)
    const a = out.find((d) => d.id === 'a')!
    const b = out.find((d) => d.id === 'b')!
    expect(a.rels.spouses).toEqual(['b'])
    expect(b.rels.spouses).toEqual(['a'])
  })

  test('one-sided spouse_id still renders (kinder failure mode)', () => {
    // Hand-edit broke symmetry: A points at B, B does not point back.
    const rows: PersonRow[] = [
      row({ id: 'a', spouse_id: 'b' }),
      row({ id: 'b', spouse_id: null }),
    ]
    const out = transformToFamilyChartShape(rows)
    expect(out.find((d) => d.id === 'a')!.rels.spouses).toEqual(['b'])
    expect(out.find((d) => d.id === 'b')!.rels.spouses).toEqual([])
  })

  test('gender mapping: f → F; m / other / unknown → M', () => {
    const rows: PersonRow[] = [
      row({ id: 'f', gender: 'f' }),
      row({ id: 'm', gender: 'm' }),
      row({ id: 'o', gender: 'other' }),
      row({ id: 'u', gender: 'unknown' }),
    ]
    const out = transformToFamilyChartShape(rows)
    expect(out.find((d) => d.id === 'f')!.data.gender).toBe('F')
    expect(out.find((d) => d.id === 'm')!.data.gender).toBe('M')
    expect(out.find((d) => d.id === 'o')!.data.gender).toBe('M')
    expect(out.find((d) => d.id === 'u')!.data.gender).toBe('M')
  })

  test('truthful gender survives at data.gender_raw', () => {
    const rows: PersonRow[] = [
      row({ id: 'o', gender: 'other' }),
      row({ id: 'u', gender: 'unknown' }),
    ]
    const out = transformToFamilyChartShape(rows)
    expect(out.find((d) => d.id === 'o')!.data.gender_raw).toBe('other')
    expect(out.find((d) => d.id === 'u')!.data.gender_raw).toBe('unknown')
  })

  test('4-generation round-trip — children walk preserves the whole chain', () => {
    // Generations:
    //   g1: great-grandpa, great-grandma
    //   g2: grandpa (child of g1)
    //   g3: parent (child of g2)
    //   g4: kid (child of g3)
    const rows: PersonRow[] = [
      row({ id: 'g1a', gender: 'm' }),
      row({ id: 'g1b', gender: 'f' }),
      row({ id: 'g2', gender: 'm', father_id: 'g1a', mother_id: 'g1b' }),
      row({ id: 'g3', gender: 'f', father_id: 'g2' }),
      row({ id: 'g4', father_id: null, mother_id: 'g3' }),
    ]
    const out = transformToFamilyChartShape(rows)
    const byId = new Map(out.map((d) => [d.id, d]))

    expect(byId.get('g1a')!.rels.children).toEqual(['g2'])
    expect(byId.get('g1b')!.rels.children).toEqual(['g2'])
    expect(byId.get('g2')!.rels.children).toEqual(['g3'])
    expect(byId.get('g3')!.rels.children).toEqual(['g4'])
    expect(byId.get('g4')!.rels.children).toEqual([])

    expect(byId.get('g2')!.rels.parents.sort()).toEqual(['g1a', 'g1b'])
    expect(byId.get('g3')!.rels.parents).toEqual(['g2'])
    expect(byId.get('g4')!.rels.parents).toEqual(['g3'])
  })

  test('data payload carries the fields the PersonNode renderer reads', () => {
    const rows: PersonRow[] = [
      row({
        id: 'p',
        full_name: 'Jane Smith',
        nickname: 'Janie',
        photo_url: 'https://example.com/p.jpg',
        birth_year: 1972,
        death_year: 2024,
        deceased: true,
        location: 'Brooklyn',
        occupation: 'Teacher',
        bio: 'A short bio.',
        tone: 'rose',
        gender: 'f',
      }),
    ]
    const [p] = transformToFamilyChartShape(rows)
    expect(p.data.full_name).toBe('Jane Smith')
    expect(p.data.nickname).toBe('Janie')
    expect(p.data.first_name).toBe('Jane')
    expect(p.data.last_name).toBe('Smith')
    expect(p.data.photo_url).toBe('https://example.com/p.jpg')
    expect(p.data.birth_year).toBe(1972)
    expect(p.data.death_year).toBe(2024)
    expect(p.data.deceased).toBe(true)
    expect(p.data.location).toBe('Brooklyn')
    expect(p.data.occupation).toBe('Teacher')
    expect(p.data.bio).toBe('A short bio.')
    expect(p.data.tone).toBe('rose')
  })

  test('single-word full_name → first only, last is empty string', () => {
    const [p] = transformToFamilyChartShape([
      row({ id: 'p', full_name: 'Madonna' }),
    ])
    expect(p.data.first_name).toBe('Madonna')
    expect(p.data.last_name).toBe('')
  })

  test('multi-word full_name → first + joined rest as last', () => {
    const [p] = transformToFamilyChartShape([
      row({ id: 'p', full_name: 'Maria de la Cruz' }),
    ])
    expect(p.data.first_name).toBe('Maria')
    expect(p.data.last_name).toBe('de la Cruz')
  })
})

describe('arePartnersMarried', () => {
  function mapOf(...rows: PersonRow[]): Map<string, PersonRow> {
    return new Map(rows.map((r) => [r.id, r]))
  }

  test('bidirectional spouse_id → married', () => {
    const m = mapOf(
      row({ id: 'a', spouse_id: 'b' }),
      row({ id: 'b', spouse_id: 'a' }),
    )
    expect(arePartnersMarried('a', 'b', m)).toBe(true)
    expect(arePartnersMarried('b', 'a', m)).toBe(true)
  })

  test('one-sided spouse_id → NOT married (matches the bug we are fixing)', () => {
    // Hand-edit broke symmetry: A points at B, B does not point back.
    // Treat this as co-parents/unmarried — do NOT draw the marriage bar.
    const m = mapOf(
      row({ id: 'a', spouse_id: 'b' }),
      row({ id: 'b', spouse_id: null }),
    )
    expect(arePartnersMarried('a', 'b', m)).toBe(false)
    expect(arePartnersMarried('b', 'a', m)).toBe(false)
  })

  test('both spouse_id null → NOT married (the seed case: Daniel + Nora)', () => {
    const m = mapOf(
      row({ id: 'daniel', spouse_id: null }),
      row({ id: 'nora', spouse_id: null }),
    )
    expect(arePartnersMarried('daniel', 'nora', m)).toBe(false)
  })

  test('spouse_id points elsewhere → NOT married', () => {
    const m = mapOf(
      row({ id: 'a', spouse_id: 'c' }),
      row({ id: 'b', spouse_id: 'c' }),
      row({ id: 'c', spouse_id: 'a' }),
    )
    expect(arePartnersMarried('a', 'b', m)).toBe(false)
  })

  test('same id on both sides → NOT married', () => {
    const m = mapOf(row({ id: 'solo', spouse_id: null }))
    expect(arePartnersMarried('solo', 'solo', m)).toBe(false)
  })

  test('missing rows → NOT married', () => {
    const m = mapOf(row({ id: 'a', spouse_id: 'ghost' }))
    expect(arePartnersMarried('a', 'ghost', m)).toBe(false)
    expect(arePartnersMarried('ghost', 'a', m)).toBe(false)
  })
})
