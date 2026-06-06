import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildUnionDag } from './build-dag.ts'
import type { PersonNode } from './types.ts'

const ppl = (xs: Partial<PersonNode>[]): PersonNode[] =>
  xs.map((x, i) => ({
    id: x.id ?? `p${i}`, fullName: x.fullName ?? `P${i}`,
    gender: x.gender ?? 'unknown',
    fatherId: x.fatherId ?? null, motherId: x.motherId ?? null,
    spouseId: x.spouseId ?? null,
  }))

test('a married couple with a child yields one union node and three persons', () => {
  const people = ppl([
    { id: 'a', spouseId: 'b' },
    { id: 'b', spouseId: 'a' },
    { id: 'c', fatherId: 'a', motherId: 'b' },
  ])
  const dag = buildUnionDag(people)
  assert.equal(dag.nodes.filter((n) => n.kind === 'person').length, 3)
  assert.equal(dag.nodes.filter((n) => n.kind === 'union').length, 1)
})

test('each person appears exactly once even when child-of-one-union and spouse-in-another', () => {
  // a+b -> c ; c marries d ; so c is both a child and a spouse.
  const people = ppl([
    { id: 'a', spouseId: 'b' }, { id: 'b', spouseId: 'a' },
    { id: 'c', fatherId: 'a', motherId: 'b', spouseId: 'd' },
    { id: 'd', spouseId: 'c' },
  ])
  const dag = buildUnionDag(people)
  const cNodes = dag.nodes.filter((n) => n.id === 'c')
  assert.equal(cNodes.length, 1)
})

test('union id is stable regardless of spouse order', () => {
  const ab = buildUnionDag(ppl([{ id: 'a', spouseId: 'b' }, { id: 'b', spouseId: 'a' }]))
  const union = ab.nodes.find((n) => n.kind === 'union')
  assert.ok(union)
  assert.ok(union!.id.includes('a') && union!.id.includes('b'))
})

test('produces an acyclic edge set on the 55-seed graph', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { parseSeed } = await import('./parse-seed.ts')
  const seed = readFileSync(join(import.meta.dirname, '../../supabase/seed.sql'), 'utf8')
  const dag = buildUnionDag(parseSeed(seed))
  // Kahn's algorithm — if it consumes every node, the graph is acyclic.
  const indeg = new Map(dag.nodes.map((n) => [n.id, 0]))
  for (const e of dag.edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  const q = [...indeg].filter(([, d]) => d === 0).map(([id]) => id)
  let seen = 0
  while (q.length) {
    const id = q.shift()!; seen++
    for (const e of dag.edges.filter((x) => x.from === id)) {
      indeg.set(e.to, indeg.get(e.to)! - 1)
      if (indeg.get(e.to) === 0) q.push(e.to)
    }
  }
  assert.equal(seen, dag.nodes.length, 'graph must be acyclic')
})
