'use client'

// Phase 4 sub-task 1 — smoke render.
//
// Thin client wrapper around `f3.createChart`. No custom node (sub-task 2),
// no detail sheet (sub-task 3), no action menu (sub-task 4), no hash sync
// or FAB (sub-task 5). The goal here is: prove that our `people` rows flow
// through the transform and render as a real horizontal focus-person tree
// with the library's default behaviour (default node + click-to-recenter +
// pan / zoom). Each later sub-task swaps one piece of "library default"
// for the project-specific behaviour.

import { useEffect, useRef } from 'react'
import f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'

import {
  transformToFamilyChartShape,
  type FamilyChartDatum,
} from '../_lib/family-chart-data'
import type { PersonRow } from '../_lib/types'

type Props = {
  people: PersonRow[]
}

export function FamilyTree({ people }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return

    // family-chart mutates the container's DOM. Under React 19 Strict Mode
    // the effect runs → cleans up → runs again; the cleanup below blanks
    // innerHTML so the second mount lands in a fresh container.
    const data: FamilyChartDatum[] = transformToFamilyChartShape(people)

    const chart = f3.createChart(cont, data)
      .setTransitionTime(800)
      .setCardXSpacing(250)
      .setCardYSpacing(150)
      .setOrientationVertical()
      // The library's default ancestry/progeny depths clip to ±1
      // generation around the focus person. For our 50–200 people-per-tree
      // target with full-tree exploration as the v1 UX, surface the whole
      // tree at once. The focus person still gets the visual emphasis
      // (outline ring + centered position); other branches sit further out
      // and are reachable via pan / re-center.
      .setAncestryDepth(20)
      .setProgenyDepth(20)
      // Off by default in the library; on by default in the chart instance.
      // Disable so the canvas doesn't render dashed "Unknown" placeholders
      // for missing parent slots — our add-person flow is the FAB
      // (Phase 3 / sub-task 5), not in-canvas slot filling.
      .setSingleParentEmptyCard(false)

    chart
      .setCardHtml()
      .setCardDisplay([['full_name'], ['birth_year']])

    chart.updateTree({ initial: true })

    return () => {
      cont.innerHTML = ''
    }
    // `people` reference is the only dependency. The Server Component
    // re-fetches on revalidatePath, which produces a new array. A full
    // teardown + rebuild on data change is fine for sub-task 1; sub-task 5
    // tightens this with memoization.
  }, [people])

  return (
    // `f3` is required by family-chart's CSS — it scopes the rules that size
    // the internal SVG (`.f3 svg.main_svg { width: 100%; height: 100% }`)
    // and set the container to `position: relative; display: flex`. Without
    // it the chart attaches at 0×0 and you see an empty container.
    //
    // We deliberately do NOT add `f3-cont` (which would force the library's
    // `height: 900px; max-height: 70vh` plus a dark background) — our own
    // Tailwind classes own width/height and the CSS-var overrides below
    // swap the library's dark theme for our heirloom palette.
    <div
      ref={containerRef}
      className="f3 w-full h-[calc(100vh-9rem)] rounded-lg border border-border bg-card overflow-hidden"
      style={{
        // Override the library's hard-coded dark theme. The `.f3 *` CSS
        // hooks reference these vars; overriding them at the container
        // scope keeps the rest of the app untouched.
        ['--background-color' as string]: 'var(--card)',
        ['--text-color' as string]: 'var(--foreground)',
      }}
    />
  )
}
