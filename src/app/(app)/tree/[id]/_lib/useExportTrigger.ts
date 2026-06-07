'use client'
// src/app/(app)/tree/[id]/_lib/useExportTrigger.ts
// Owns the FamilyTree side of the export seam (#217): listens for
// `mtf-export-tree`, flips `exporting` state, round-trips `mtf-export-pending`
// so the header button can disable itself, and runs the capture wrapped in
// withOverflowVisible so the full tree extent is reachable.
// Gated behind `readOnly` so the share-page FamilyTree ignores stray events.
//
// #218 additions:
//   - `fitFn` option: called before capture to fit the whole tree into frame.
//     We wait FIT_SETTLE_MS after calling it so the family-chart animation
//     (setTransitionTime(800)) finishes before the screenshot fires.
//   - Cancel support: `cancel()` aborts the pending download (the raster may
//     still run in the background, but the result is silently discarded).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  emitExportPending,
  onExportTree,
} from './export-events'
import { withOverflowVisible } from './with-overflow-visible'
import { captureTree, type CaptureSignal } from './capture-tree'

/** How long (ms) to wait after calling fitFn before taking the screenshot.
 *  Matches chart.setTransitionTime(800) + 100ms buffer. */
const FIT_SETTLE_MS = 900

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type Options = {
  readOnly: boolean
  /** Called just before capture to fit the whole tree into frame. */
  fitFn?: () => void
}

export function useExportTrigger(
  containerRef: RefObject<HTMLElement | null>,
  { readOnly, fitFn }: Options,
): { exporting: boolean; cancel: () => void } {
  const [exporting, setExporting] = useState(false)
  // signalRef holds the CaptureSignal for the current export run.
  // A fresh { aborted: false } object is created per export; cancel() flips
  // .aborted to true so captureTree can check it before / after the raster.
  const signalRef = useRef<CaptureSignal>({ aborted: false })

  // Stable cancel callback: flip the current signal and reset UI immediately.
  // The in-flight raster may still produce a blob, but captureTree checks the
  // flag before calling triggerDownload, so no download fires.
  const cancel = useCallback(() => {
    signalRef.current.aborted = true
    setExporting(false)
    emitExportPending({ pending: false })
  }, [])

  useEffect(() => {
    if (readOnly) return
    return onExportTree(async ({ format, treeName }) => {
      const el = containerRef.current
      if (!el) return
      // Fresh signal for this export run.
      const signal: CaptureSignal = { aborted: false }
      signalRef.current = signal
      setExporting(true)
      emitExportPending({ pending: true })
      try {
        // Fit the whole tree into frame before taking the screenshot.
        if (fitFn) {
          fitFn()
          await delay(FIT_SETTLE_MS)
        }
        // If cancelled during the fit delay, bail before starting the raster.
        if (signal.aborted) return
        await withOverflowVisible(el, () =>
          captureTree(el, format, treeName, signal),
        )
      } finally {
        // Only reset pending/exporting if the user didn't already cancel
        // (cancel() resets them immediately so we don't double-reset).
        if (!signal.aborted) {
          emitExportPending({ pending: false })
          setExporting(false)
        }
      }
    })
    // containerRef identity is stable (useRef); listed so exhaustive-deps
    // doesn't flag it. readOnly is the real re-run guard.
    // fitFn is excluded intentionally: it's a useCallback from FamilyTree
    // whose identity is stable for the life of the chart; re-registering the
    // event listener on every render would be wasteful and incorrect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, readOnly])

  return { exporting, cancel }
}
