// Throwaway spike #214 harness types. Not production code.

export interface PersonNode {
  id: string
  fullName: string
  gender: 'm' | 'f' | 'other' | 'unknown'
  fatherId: string | null
  motherId: string | null
  spouseId: string | null
}

/** A DAG node is either a real person or a synthetic marriage "union". */
export interface DagNode {
  id: string
  kind: 'person' | 'union'
}

/** Directed edge, parent-rank → child-rank. */
export interface DagEdge {
  from: string
  to: string
}

export interface UnionDag {
  nodes: DagNode[]
  edges: DagEdge[]
}

export interface PositionedNode {
  id: string
  kind: 'person' | 'union'
  x: number
  y: number
}

export interface PositionedEdge {
  from: string
  to: string
  points: Array<{ x: number; y: number }>
}

export interface PositionedLayout {
  engine: 'dagre' | 'd3-dag'
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  width: number
  height: number
}
