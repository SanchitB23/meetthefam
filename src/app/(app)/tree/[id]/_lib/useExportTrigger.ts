'use client'
// src/app/(app)/tree/[id]/_lib/useExportTrigger.ts
// Owns the FamilyTree side of the export seam (#217): listens for
// `mtf-export-tree`, flips `exporting` state, round-trips `mtf-export-pending`
// so the header button can disable itself, and runs the capture wrapped in
// withOverflowVisible so the full tree extent is reachable.
// Gated behind `readOnly` so the share-page FamilyTree ignores stray events.
//
// #218 additions:
//   - `prepareForCapture` option: called before capture to resize the
//     container to the tree's native extent, fit the chart into that large
//     box (so it renders at ≈1×), and return the computed pixelRatio +
//     a `restore()` callback that puts the container back to normal.
//   - `fitFn` is still accepted as a fallback for callers that don't need
//     the full native-scale logic (e.g. tests). When `prepareForCapture`
//     is not provided but `fitFn` is, the old behaviour is preserved.
//   - Cancel support: `cancel()` aborts the pending download (the raster may
//     still run in the background, but the result is silently discarded).
//   - `restore()` is ALWAYS called in `finally` (also on cancel + error).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  emitExportPending,
  onExportTree,
} from './export-events'
import { withOverflowVisible } from './with-overflow-visible'
import { captureTree, type CaptureSignal } from './capture-tree'

/** How long (ms) to wait after calling prepareForCapture/fitFn before taking
 *  the screenshot. Matches chart.setTransitionTime(800) + 100ms buffer. */
const FIT_SETTLE_MS = 900

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Return type of `prepareForCapture`. The caller MUST call `restore()` in
 * a `finally` block — it puts the container back to its original size and
 * re-fits the chart into the normal viewport.
 */
export type CapturePreparation = {
  /** pixelRatio computed by planExportRaster for this tree's native extent. */
  pixelRatio: number
  /** Restores the container to its pre-capture state. Always call in finally. */
  restore: () => void
}

type Options = {
  readOnly: boolean
  /**
   * Native-scale capture (#218). Called before capture; should:
   *   (a) save the current container size,
   *   (b) resize to boxW×boxH (from planExportRaster),
   *   (c) call updateTree({ initial: true }) so the chart fits into the big box,
   *   (d) return { pixelRatio, restore }.
   *
   * When provided, this REPLACES `fitFn`. After the settle delay and capture,
   * `restore()` is always called in a `finally` block.
   */
  prepareForCapture?: () => CapturePreparation
  /**
   * Fallback: called just before capture to fit the whole tree into the
   * current viewport frame. Used when `prepareForCapture` is not provided.
   * @deprecated Use `prepareForCapture` for native-scale export (#218).
   */
  fitFn?: () => void
}

export function useExportTrigger(
  containerRef: RefObject<HTMLElement | null>,
  { readOnly, prepareForCapture, fitFn }: Options,
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

      // #218: track the preparation so restore() can be called in finally.
      let preparation: CapturePreparation | null = null

      try {
        if (prepareForCapture) {
          // Native-scale path: resize container, fit chart at ≈1×, get pixelRatio.
          preparation = prepareForCapture()
          await delay(FIT_SETTLE_MS)
        } else if (fitFn) {
          // Legacy fallback: fit to the current viewport size.
          fitFn()
          await delay(FIT_SETTLE_MS)
        }

        // If cancelled during the fit/settle delay, bail before starting the raster.
        if (signal.aborted) return

        const pixelRatio = preparation?.pixelRatio ?? 3

        await withOverflowVisible(el, () =>
          captureTree(el, format, treeName, signal, pixelRatio),
        )
      } catch (err) {
        // captureTree or prepareForCapture failed. Log and fall through to
        // finally so restore() always runs and the UI is reset.
        console.error('[export] Tree capture failed:', err)
      } finally {
        // Always restore the container, even on cancel or error.
        if (preparation) {
          preparation.restore()
        }
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
    // prepareForCapture and fitFn are excluded intentionally: they are
    // useCallback refs from FamilyTree whose identity is stable for the
    // life of the chart; re-registering the event listener on every render
    // would be wasteful and incorrect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, readOnly])

  return { exporting, cancel }
}
