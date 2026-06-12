// scripts/export-stress/__tests__/tree-shape.test.ts
import { describe, it, expect } from 'vitest'
import { buildTreeShape } from '../tree-shape'

describe('buildTreeShape', () => {
  it('produces exactly the requested number of people', () => {
    for (const n of [25, 50, 100, 150, 200]) {
      expect(buildTreeShape(n).length).toBe(n)
    }
  })

  it('is deterministic for a given count', () => {
    expect(buildTreeShape(50)).toEqual(buildTreeShape(50))
  })

  it('only references parent/spouse indices that exist and are earlier (parents)', () => {
    const people = buildTreeShape(100)
    people.forEach((p, i) => {
      if (p.fatherIdx !== null) {
        expect(p.fatherIdx).toBeGreaterThanOrEqual(0)
        expect(p.fatherIdx).toBeLessThan(i)
      }
      if (p.motherIdx !== null) {
        expect(p.motherIdx).toBeLessThan(i)
      }
      if (p.spouseIdx !== null) {
        expect(p.spouseIdx).toBeGreaterThanOrEqual(0)
        expect(p.spouseIdx).toBeLessThan(people.length)
        expect(people[p.spouseIdx].spouseIdx).toBe(i)
      }
    })
  })

  it('assigns ~70% of people a photo (between 60% and 80%)', () => {
    const people = buildTreeShape(200)
    const withPhoto = people.filter((p) => p.hasPhoto).length
    expect(withPhoto / 200).toBeGreaterThanOrEqual(0.6)
    expect(withPhoto / 200).toBeLessThanOrEqual(0.8)
  })

  it('spans multiple generations', () => {
    const people = buildTreeShape(100)
    const maxGen = Math.max(...people.map((p) => p.generation))
    expect(maxGen).toBeGreaterThanOrEqual(3)
  })
})

describe('buildTreeShape — multi-root (#225)', () => {
  it('creates rootCouples founding couples (no parents, generation 0)', () => {
    const people = buildTreeShape(100, 3)
    const founders = people.filter((p) => p.generation === 0)
    expect(founders).toHaveLength(6) // 3 couples
    for (const f of founders) {
      expect(f.fatherIdx).toBeNull()
      expect(f.motherIdx).toBeNull()
      expect(f.spouseIdx).not.toBeNull()
    }
  })

  it('still produces exactly count people', () => {
    expect(buildTreeShape(200, 3)).toHaveLength(200)
    expect(buildTreeShape(60, 1)).toHaveLength(60)
  })

  it('is deterministic per (count, rootCouples)', () => {
    expect(buildTreeShape(100, 3)).toEqual(buildTreeShape(100, 3))
    expect(buildTreeShape(100, 3)).not.toEqual(buildTreeShape(100, 1))
  })
})
