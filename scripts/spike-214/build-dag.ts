import type { PersonNode, UnionDag, DagNode, DagEdge } from './types.ts'

const unionId = (a: string, b: string) =>
  `union:${[a, b].sort().join('+')}`

export function buildUnionDag(people: PersonNode[]): UnionDag {
  const ids = new Set(people.map((p) => p.id))
  const nodes = new Map<string, DagNode>()
  const edgeKeys = new Set<string>()
  const edges: DagEdge[] = []

  const addPerson = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'person' })
  }
  const addUnion = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'union' })
  }
  const addEdge = (from: string, to: string) => {
    const k = `${from}->${to}`
    if (edgeKeys.has(k)) return
    edgeKeys.add(k)
    edges.push({ from, to })
  }

  // Every person is a node.
  for (const p of people) addPerson(p.id)

  // Spouse unions: both spouse rows resolve to the same union id.
  for (const p of people) {
    if (p.spouseId && ids.has(p.spouseId)) {
      const uid = unionId(p.id, p.spouseId)
      addUnion(uid)
      addEdge(p.id, uid)
      addEdge(p.spouseId, uid)
    }
  }

  // Parent → child wiring.
  for (const p of people) {
    const f = p.fatherId && ids.has(p.fatherId) ? p.fatherId : null
    const m = p.motherId && ids.has(p.motherId) ? p.motherId : null
    if (f && m) {
      // Reuse the parents' marriage union if it exists; else synthesise one.
      const uid = unionId(f, m)
      addUnion(uid)
      addEdge(f, uid)
      addEdge(m, uid)
      addEdge(uid, p.id)
    } else if (f) {
      addEdge(f, p.id)
    } else if (m) {
      addEdge(m, p.id)
    }
  }

  return { nodes: [...nodes.values()], edges }
}
