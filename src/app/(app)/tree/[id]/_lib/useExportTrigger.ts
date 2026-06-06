'use client'
// src/app/(app)/tree/[id]/_lib/useExportTrigger.ts
// Owns the FamilyTree side of the export seam (#217): listens for
// `mtf-export-tree`, flips `exporting` state, round-trips `mtf-export-pending`
// so the header button can disable itself, and runs the (stubbed) capture
// wrapped in withOverflowVisible so the full tree extent is reachable.
// Gated behind `readOnly` so the share-page FamilyTree ignores stray events.
import { useEffect, useState, type RefObject } from 'react'
import {
  emitExportPending,
  onExportTree,
} from './export-events'
import { withOverflowVisible } from './with-overflow-visible'
import { captureTree } from './capture-tree'

export function useExportTrigger(
  containerRef: RefObject<HTMLElement | null>,
  { readOnly }: { readOnly: boolean },
): { exporting: boolean } {
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (readOnly) return
    return onExportTree(async ({ format }) => {
      const el = containerRef.current
      if (!el) return
      setExporting(true)
      emitExportPending({ pending: true })
      try {
        await withOverflowVisible(el, () => captureTree(el, format))
      } finally {
        emitExportPending({ pending: false })
        setExporting(false)
      }
    })
    // containerRef identity is stable (useRef); listed so exhaustive-deps
    // doesn't flag it. readOnly is the real re-run guard.
  }, [containerRef, readOnly])

  return { exporting }
}
