// Spike #214 — d3-dag 1.2.1 adapter (pure ESM, import only).
//
// API used (verified against installed 1.2.1 surface):
//   graphConnect()         — builds a Graph from [parentId, childId] pair arrays
//   sugiyama()             — Sugiyama layered layout operator (fluent, immutable)
//     .layering(layeringLongestPath())  — rank assignment: push roots to layer 0
//     .decross(decrossOpt() | decrossTwoLayer())  — crossing minimisation
//     .coord(coordSimplex())            — x-coordinate assignment (LP-based)
//     .nodeSize(callback)               — [w, h] per node (union: 8×8, person: 158×110)
//     .gap([xGap, yGap])                — minimum gap between node bounding boxes
//   layout(graph) → { width, height }  — mutates node.x / node.y in place
//   link.points                         — Array<[number, number]> tuples (not {x,y} objects)

import {
  graphConnect,
  sugiyama,
  layeringLongestPath,
  decrossOpt,
  decrossTwoLayer,
  coordSimplex,
} from 'd3-dag'
import type { GraphNode } from 'd3-dag'
import type { UnionDag, PositionedLayout, PositionedNode, PositionedEdge } from '../types.ts'

export function layoutWithD3Dag(dag: UnionDag): PositionedLayout {
  // Build graph from directed edge pairs.
  // graphConnect() deduplicates node ids automatically — a person who appears as
  // both a parent and a child is represented exactly once in the graph.
  const links: [string, string][] = dag.edges.map((e) => [e.from, e.to])
  const builder = graphConnect()
  const graph = builder(links)

  // nodeSize callback: node.data is the string id in graphConnect graphs.
  const nodeSize = (node: GraphNode<string, unknown>): readonly [number, number] =>
    node.data.startsWith('union:') ? [8, 8] : [158, 110]

  // decrossOpt is exponential — fine for ≤~100 nodes; switch to decrossTwoLayer above that.
  const decross = dag.edges.length > 400 ? decrossTwoLayer() : decrossOpt()

  const layoutFn = sugiyama()
    .layering(layeringLongestPath())
    .decross(decross)
    .coord(coordSimplex())
    .nodeSize(nodeSize)
    .gap([40, 60])

  const { width, height } = layoutFn(graph)

  // Read node positions.  After layout(), node.x and node.y are set in place.
  const nodes: PositionedNode[] = []
  for (const node of graph.nodes()) {
    const id = node.data
    nodes.push({
      id,
      kind: id.startsWith('union:') ? 'union' : 'person',
      x: node.x ?? 0,
      y: node.y ?? 0,
    })
  }

  // Read edge control points.  link.points is Array<[number, number]> (tuples, not {x,y}).
  const edges: PositionedEdge[] = []
  for (const link of graph.links()) {
    edges.push({
      from: link.source.data,
      to: link.target.data,
      points: (link.points ?? []).map(([x, y]: readonly [number, number]) => ({ x, y })),
    })
  }

  return { engine: 'd3-dag', nodes, edges, width, height }
}
