import type { PositionedLayout } from './types.ts'

export interface Metrics {
  engine: string
  personCards: number
  uniquePeople: number
  duplicates: number
  expectedPeople: number
  allRenderedOnce: boolean
  width: number
  height: number
  aspect: number
}

export function computeMetrics(layout: PositionedLayout, expectedPeople: number): Metrics {
  const personIds = layout.nodes.filter((n) => n.kind === 'person').map((n) => n.id)
  const unique = new Set(personIds)
  const duplicates = personIds.length - unique.size
  return {
    engine: layout.engine,
    personCards: personIds.length,
    uniquePeople: unique.size,
    duplicates,
    expectedPeople,
    allRenderedOnce: unique.size === expectedPeople && duplicates === 0,
    width: Math.round(layout.width),
    height: Math.round(layout.height),
    aspect: layout.height === 0 ? 0 : Number((layout.width / layout.height).toFixed(2)),
  }
}
