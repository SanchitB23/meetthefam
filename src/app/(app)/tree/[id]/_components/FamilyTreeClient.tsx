'use client'

import dynamic from 'next/dynamic'
import type { PersonRow } from '../_lib/types'

// family-chart (+ its bundled d3) is the heaviest client chunk on this route.
// Loading it via next/dynamic with ssr:false keeps it out of the route's
// initial JS: the chart is already DOM-only (imperative f3.createChart in a
// useEffect), so deferring to post-hydration changes nothing the user sees —
// first paint is the skeleton either way. ssr:false REQUIRES a client
// boundary (this file); it is illegal in a Server Component (TreeContent).
// Perf #249.
const FamilyTreeLazy = dynamic(
  () => import('./FamilyTree').then((m) => m.FamilyTree),
  {
    ssr: false,
    loading: () => (
      <div
        className="max-w-4xl mx-auto rounded-lg border border-dashed border-border bg-card/40 h-[60vh] mtf-skeleton"
        aria-busy="true"
        aria-label="Loading family tree…"
      />
    ),
  },
)

type Props = {
  treeId: string
  people: PersonRow[]
  initialFocusId: string | null
}

export function FamilyTreeClient(props: Props) {
  return <FamilyTreeLazy {...props} />
}
