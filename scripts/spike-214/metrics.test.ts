import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics } from './metrics.ts'
import type { PositionedLayout } from './types.ts'

const layout: PositionedLayout = {
  engine: 'dagre',
  nodes: [
    { id: 'a', kind: 'person', x: 0, y: 0 },
    { id: 'b', kind: 'person', x: 100, y: 0 },
    { id: 'union:a+b', kind: 'union', x: 50, y: 50 },
  ],
  edges: [],
  width: 100,
  height: 50,
}

test('counts unique people, ignores union nodes', () => {
  const m = computeMetrics(layout, 2)
  assert.equal(m.personCards, 2)
  assert.equal(m.uniquePeople, 2)
  assert.equal(m.duplicates, 0)
})

test('flags duplicates when a person id appears twice', () => {
  const dup: PositionedLayout = {
    ...layout,
    nodes: [...layout.nodes, { id: 'a', kind: 'person', x: 200, y: 0 }],
  }
  const m = computeMetrics(dup, 2)
  assert.equal(m.personCards, 3)
  assert.equal(m.uniquePeople, 2)
  assert.equal(m.duplicates, 1)
})

test('reports aspect ratio width/height', () => {
  const m = computeMetrics(layout, 2)
  assert.equal(m.aspect, 2)
})
