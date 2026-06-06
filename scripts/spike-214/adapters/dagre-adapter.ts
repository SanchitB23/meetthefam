// Named imports — @dagrejs/dagre@3 exports `graphlib` and `layout` as named ESM exports.
// The default export also carries both, but named imports match the published types exactly.
import { graphlib, layout } from '@dagrejs/dagre'
import type { UnionDag, PositionedLayout, PositionedNode, PositionedEdge } from '../types.ts'

export function layoutWithDagre(dag: UnionDag): PositionedLayout {
  const g = new graphlib.Graph({ directed: true })
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of dag.nodes) {
    if (n.kind === 'person') g.setNode(n.id, { width: 158, height: 110 })
    else g.setNode(n.id, { width: 8, height: 8 })
  }
  for (const e of dag.edges) g.setEdge(e.from, e.to)

  layout(g)

  const nodes: PositionedNode[] = dag.nodes.map((n) => {
    const d = g.node(n.id)
    return { id: n.id, kind: n.kind, x: d.x, y: d.y }
  })
  const edges: PositionedEdge[] = dag.edges.map((e) => {
    const d = g.edge(e.from, e.to)
    return { from: e.from, to: e.to, points: (d?.points ?? []).map((p) => ({ x: p.x, y: p.y })) }
  })
  const gl = g.graph()
  return { engine: 'dagre', nodes, edges, width: gl.width ?? 0, height: gl.height ?? 0 }
}
