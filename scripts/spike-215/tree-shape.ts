// scripts/spike-215/tree-shape.ts
// Deterministic synthetic family-tree shape generator for the export-viability
// spike (#215). Pure: no I/O. Indices are positional; the seed runner resolves
// them to UUIDs. Spouse links are reciprocal. Parents always precede children.

export type PersonSpec = {
  idx: number
  generation: number
  fullName: string
  gender: 'm' | 'f'
  fatherIdx: number | null
  motherIdx: number | null
  spouseIdx: number | null
  hasPhoto: boolean
}

// Mulberry32 — tiny deterministic PRNG so runs are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Asha', 'Ravi', 'Meera', 'Arjun', 'Priya', 'Vikram', 'Sita', 'Karan', 'Nisha', 'Dev', 'Tara', 'Rohan', 'Lila', 'Sam', 'Uma', 'Neel']
const LAST = ['Rao', 'Mehta', 'Khan', 'Patel', 'Bose', 'Nair', 'Singh', 'Iyer']

/**
 * Build `count` person specs. Generation 0 is a founding couple; each later
 * person is either a child of an existing couple or the in-marrying spouse of
 * an existing person. ~70% are flagged `hasPhoto`.
 */
export function buildTreeShape(count: number): PersonSpec[] {
  const rand = mulberry32(count * 2654435761)
  const people: PersonSpec[] = []

  const push = (
    gender: 'm' | 'f',
    generation: number,
    fatherIdx: number | null,
    motherIdx: number | null,
  ): PersonSpec => {
    const idx = people.length
    const p: PersonSpec = {
      idx,
      generation,
      gender,
      fatherIdx,
      motherIdx,
      spouseIdx: null,
      fullName: `${FIRST[idx % FIRST.length]} ${LAST[idx % LAST.length]}`,
      hasPhoto: rand() < 0.7,
    }
    people.push(p)
    return p
  }

  const marry = (a: PersonSpec, b: PersonSpec) => {
    a.spouseIdx = b.idx
    b.spouseIdx = a.idx
  }

  // Founding couple (generation 0).
  const f0 = push('m', 0, null, null)
  const m0 = push('f', 0, null, null)
  marry(f0, m0)

  // Couples that can still bear children, as [husbandIdx, wifeIdx, generation].
  const couples: Array<[number, number, number]> = [[f0.idx, m0.idx, 0]]

  while (people.length < count) {
    const [hIdx, wIdx, gen] = couples[Math.floor(rand() * couples.length)]
    if (people.length + 1 > count) break

    // Add a child of this couple.
    const childGender: 'm' | 'f' = rand() < 0.5 ? 'm' : 'f'
    const child = push(childGender, gen + 1, hIdx, wIdx)

    // ~70% of children marry an in-marrying spouse (if budget allows).
    if (rand() < 0.7 && people.length < count) {
      const spouseGender: 'm' | 'f' = childGender === 'm' ? 'f' : 'm'
      const spouse = push(spouseGender, gen + 1, null, null)
      marry(child, spouse)
      couples.push([
        childGender === 'm' ? child.idx : spouse.idx,
        childGender === 'm' ? spouse.idx : child.idx,
        gen + 1,
      ])
    }
  }

  return people.slice(0, count)
}
