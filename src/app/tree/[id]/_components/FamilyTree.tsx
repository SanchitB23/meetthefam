'use client'

// Phase 4 sub-task 1 — smoke render.
// Phase 4 sub-task 2 — custom PersonNode HTML card (setCardInnerHtmlCreator).
// Phase 4 sub-task 3 — tap-to-detail: override library default
//   click-to-recenter with `setOnCardClick`, surface a <PersonDetailSheet>
//   driven by local state. Re-center moves to the sub-task 4 action menu.
//
// No URL-hash sync, no FAB context-awareness yet (sub-task 5).

import { useEffect, useMemo, useRef, useState } from 'react'
import f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import type { TreeDatum } from 'family-chart'

import {
  transformToFamilyChartShape,
  type FamilyChartDatum,
} from '../_lib/family-chart-data'
import { personNodeHtml } from '../_lib/person-node-html'
import type { PersonRow } from '../_lib/types'
import { PersonDetailSheet } from './PersonDetailSheet'

type Props = {
  treeId: string
  people: PersonRow[]
}

export function FamilyTree({ treeId, people }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null)

  // Stable id → row lookup for the detail sheet's relations summary and the
  // click handler's resolution. Memoized on the `people` array reference;
  // the Server Component hands back a new array on each revalidate.
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  // The click handler reads `peopleById` to resolve the tapped node's
  // PersonRow. Keep the latest Map in a ref so the chart's onCardClick
  // (registered once inside the effect) always sees fresh data — without
  // tearing the chart down on every revalidate.
  const peopleByIdRef = useRef(peopleById)
  useEffect(() => {
    peopleByIdRef.current = peopleById
  }, [peopleById])

  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return

    const data: FamilyChartDatum[] = transformToFamilyChartShape(people)

    const chart = f3.createChart(cont, data)
      .setTransitionTime(800)
      // Spacing tuned for the 158×110 PersonNode (per ADR 0008).
      .setCardXSpacing(220)
      .setCardYSpacing(130)
      .setOrientationVertical()
      .setAncestryDepth(20)
      .setProgenyDepth(20)
      .setSingleParentEmptyCard(false)

    chart
      .setCardHtml()
      .setCardDim({ w: 158, h: 110 })
      .setCardInnerHtmlCreator(personNodeHtml)
      // Override the library's click-to-recenter. The detail sheet is the
      // sub-task-3 entry point; re-centering becomes a menu item in
      // sub-task 4 so the user can choose what a tap means.
      .setOnCardClick((_e: Event, d: TreeDatum) => {
        const id = d.data.id
        if (peopleByIdRef.current.has(id)) {
          setDetailPersonId(id)
        }
      })

    chart.updateTree({ initial: true })

    return () => {
      cont.innerHTML = ''
    }
  }, [people])

  const detailPerson = detailPersonId ? peopleById.get(detailPersonId) ?? null : null

  return (
    <>
      <div
        ref={containerRef}
        className="f3 w-full h-[calc(100vh-9rem)] rounded-lg border border-border bg-card overflow-hidden"
        style={{
          ['--background-color' as string]: 'var(--card)',
          ['--text-color' as string]: 'var(--foreground)',
        }}
      />
      <PersonDetailSheet
        person={detailPerson}
        peopleById={peopleById}
        treeId={treeId}
        onOpenChange={(next) => setDetailPersonId(next?.id ?? null)}
      />
    </>
  )
}
