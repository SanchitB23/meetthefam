'use client'

// Phase 4 sub-task 1 — smoke render.
// Phase 4 sub-task 2 — custom PersonNode HTML card.
// Phase 4 sub-task 3 — tap → detail sheet (setOnCardClick override).
// Phase 4 sub-task 4 — long-press / "…" → action menu, "Re-center here"
//   moved off the tap path and into the menu.
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
import { usePressActions } from '../_lib/usePressActions'
import type { PersonRow } from '../_lib/types'
import { PersonActionMenu, type ActionAnchor } from './PersonActionMenu'
import { PersonDetailSheet } from './PersonDetailSheet'

type Props = {
  treeId: string
  people: PersonRow[]
}

type Chart = ReturnType<typeof f3.createChart>

export function FamilyTree({ treeId, people }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null)
  const [actionAnchor, setActionAnchor] = useState<ActionAnchor | null>(null)

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const peopleByIdRef = useRef(peopleById)
  useEffect(() => {
    peopleByIdRef.current = peopleById
  }, [peopleById])

  // 500 ms long-press gesture. On fire, opens the action menu anchored at
  // the pressed node's top-right corner (matches the three-dot trigger's
  // anchor for consistency between gesture + fallback paths).
  const { shouldSuppressNextClickRef } = usePressActions(containerRef, {
    onLongPress: (personId, e) => {
      const node = (e.target as HTMLElement | null)?.closest('.mtf-node') as HTMLElement | null
      const rect = node?.getBoundingClientRect()
      setActionAnchor({
        personId,
        x: rect ? rect.right - 4 : e.clientX,
        y: rect ? rect.top + 8 : e.clientY,
      })
    },
  })

  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return

    const data: FamilyChartDatum[] = transformToFamilyChartShape(people)

    const chart = f3.createChart(cont, data)
      .setTransitionTime(800)
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
      .setOnCardClick((e: Event, d: TreeDatum) => {
        // Long-press just fired → swallow this click so the detail sheet
        // doesn't pop on the pointerup that ended the gesture.
        if (shouldSuppressNextClickRef.current) {
          shouldSuppressNextClickRef.current = false
          return
        }
        const id = d.data.id
        if (!peopleByIdRef.current.has(id)) return

        // Three-dot tap → action menu anchored at the button. Anywhere
        // else on the card → detail sheet.
        const target = (e.target as HTMLElement | null) ?? null
        const trigger = target?.closest('[data-action-trigger]') as HTMLElement | null
        if (trigger) {
          const rect = trigger.getBoundingClientRect()
          setActionAnchor({
            personId: id,
            x: rect.right,
            y: rect.bottom,
          })
          return
        }
        setDetailPersonId(id)
      })

    chart.updateTree({ initial: true })
    chartRef.current = chart

    return () => {
      chartRef.current = null
      cont.innerHTML = ''
    }
  }, [people, shouldSuppressNextClickRef])

  const detailPerson = detailPersonId ? peopleById.get(detailPersonId) ?? null : null

  const handleRecenter = (personId: string) => {
    const chart = chartRef.current
    if (!chart) return
    chart.updateMainId(personId)
    chart.updateTree()
  }

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
      <PersonActionMenu
        anchor={actionAnchor}
        treeId={treeId}
        people={people}
        peopleById={peopleById}
        onClose={() => setActionAnchor(null)}
        onRecenter={handleRecenter}
      />
    </>
  )
}
