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
//     The run KEEPS the single-run lock until its raster drains — cancel
//     discards the result, it does not end the run (#229 review).
//   - `restore()` is ALWAYS called in `finally` (also on cancel + error).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import {
  emitExportPending,
  onExportTree,
} from './export-events'
import { withOverflowVisible } from './with-overflow-visible'
import { captureTree, type CaptureSignal } from './capture-tree'
import { isMobileLike } from './isMobileLike'

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
  /** True when capture uses a fallback that may reduce output quality. */
  degraded?: boolean
}

/** Result of the #225 preflight measurement (no DOM mutation). */
export type ExportPreflight = {
  /** True when the export cannot keep cards at native size (or measuring failed). */
  degraded: boolean
}

/**
 * Export-run state machine (#235). Exactly one run may be active at a time;
 * 'confirming' keeps the header button disabled (via pending) WITHOUT opening
 * the progress dialog — the degrade dialog is the only thing on screen.
 */
type ExportStatus =
  | { phase: 'idle' }
  | { phase: 'confirming'; runId: number }
  | { phase: 'preparing'; runId: number; bestEffort?: boolean }
  | { phase: 'capturing'; runId: number; bestEffort?: boolean }

type ActiveRun = {
  runId: number
  signal: CaptureSignal
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
  /**
   * #225 preflight: measure + plan WITHOUT resizing the container. Runs inside
   * the accepted run (button disabled via pending) but before the progress
   * dialog shows. When it reports degraded — or the device is mobile-like —
   * the export pauses on `confirmDegrade`.
   */
  preflight?: () => ExportPreflight
  /**
   * Ask the user to confirm a degraded/mobile export. Resolve false to abort.
   * Must be provided together with `preflight` — if either is absent the
   * gate is skipped entirely. Callers must stabilize both with useCallback.
   */
  confirmDegrade?: () => Promise<boolean>
}

export function useExportTrigger(
  containerRef: RefObject<HTMLElement | null>,
  { readOnly, prepareForCapture, fitFn, preflight, confirmDegrade }: Options,
): { exporting: boolean; exportingBestEffort: boolean; cancel: () => void } {
  const [status, setStatus] = useState<ExportStatus>({ phase: 'idle' })
  // activeRunRef holds the accepted run's id + CaptureSignal. The lock is
  // held from acceptance until the run's `finally` — INCLUDING after cancel
  // (#229 review): the raster can't be aborted and the pending restore()
  // belongs to this run, so releasing early would let a new run's container
  // mutations interleave with this one's. `finally` is the single point that
  // clears the ref, restores the container, and resets pending.
  const activeRunRef = useRef<ActiveRun | null>(null)
  const nextRunIdRef = useRef(0)

  // Stable cancel callback: flip the current signal and close the progress
  // dialog. The in-flight raster may still produce a blob, but captureTree
  // checks the flag before calling triggerDownload, so no download fires.
  // Pending stays true (header button disabled) until the raster drains and
  // the run's `finally` releases the lock.
  const cancel = useCallback(() => {
    const active = activeRunRef.current
    if (!active) return
    active.signal.aborted = true
    setStatus({ phase: 'idle' })
  }, [])

  useEffect(() => {
    if (readOnly) return
    return onExportTree(async ({ format, treeName }) => {
      const el = containerRef.current
      if (!el) return

      // Accept exactly one run at a time (#235). Guards the live family-chart
      // DOM from overlapping resizes/rasters and stops a second event from
      // overwriting the degrade-confirm resolver. The duplicate is dropped
      // silently — the header button is already disabled via pending.
      if (activeRunRef.current) return

      const runId = ++nextRunIdRef.current
      const signal: CaptureSignal = { aborted: false }
      activeRunRef.current = { runId, signal }
      setStatus({ phase: 'preparing', runId })
      emitExportPending({ pending: true })

      // #218: track the preparation so restore() can be called in finally.
      let preparation: CapturePreparation | null = null

      try {
        // #225 degrade gate — runs inside the accepted run so the header
        // button stays disabled, but `exporting` excludes 'confirming' so
        // the warn dialog is the only thing on screen (#235 review fix).
        if (preflight && confirmDegrade) {
          const flight = preflight()
          if (flight.degraded || isMobileLike()) {
            setStatus({ phase: 'confirming', runId })
            const proceed = await confirmDegrade()
            if (signal.aborted) return
            if (!proceed) {
              signal.aborted = true
              return
            }
            setStatus({ phase: 'preparing', runId })
          }
        }

        if (prepareForCapture) {
          // Native-scale path: resize container, fit chart at ≈1×, get pixelRatio.
          preparation = prepareForCapture()
          if (preparation.degraded) {
            // Capture-time measurement fell back — continue, but say so.
            setStatus({ phase: 'preparing', runId, bestEffort: true })
          }
          await delay(FIT_SETTLE_MS)
        } else if (fitFn) {
          // Legacy fallback: fit to the current viewport size.
          fitFn()
          await delay(FIT_SETTLE_MS)
        }

        // If cancelled during the fit/settle delay, bail before starting the raster.
        if (signal.aborted) return

        const pixelRatio = preparation?.pixelRatio ?? 3
        setStatus({
          phase: 'capturing',
          runId,
          bestEffort: preparation?.degraded === true,
        })

        await withOverflowVisible(el, () =>
          captureTree(el, format, treeName, signal, pixelRatio),
        )
      } catch (err) {
        if (!signal.aborted) {
          // captureTree or prepareForCapture failed. Log and fall through to
          // finally so restore() always runs and the UI is reset.
          console.error('[export] Tree capture failed:', err)
          toast.error(
            'Export failed. Please try again, or use a desktop browser for large trees.',
          )
        }
      } finally {
        // Always restore the container, even on cancel or error.
        if (preparation) {
          preparation.restore()
        }
        // Single release point for the run lock (#229 review): cancel() does
        // NOT clear activeRunRef, so this branch is reached with ownership on
        // every exit path — success, error, cancel drain, degrade-decline.
        // The runId check stays as a defensive guard only.
        if (activeRunRef.current?.runId === runId) {
          activeRunRef.current = null
          emitExportPending({ pending: false })
          setStatus({ phase: 'idle' })
        }
      }
    })
    // containerRef identity is stable (useRef); listed so exhaustive-deps
    // doesn't flag it. readOnly is the real re-run guard.
    // prepareForCapture, fitFn, preflight, and confirmDegrade are excluded
    // intentionally: they are useCallback refs from FamilyTree whose identity
    // is stable for the life of the chart; re-registering the event listener
    // on every render would be wasteful and incorrect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, readOnly])

  // #235 review fix: `exporting` (drives the progress dialog) excludes
  // 'confirming' — only the degrade dialog shows during confirmation. The
  // header button stays disabled for the whole run via the pending events.
  const exporting = status.phase === 'preparing' || status.phase === 'capturing'
  const exportingBestEffort =
    (status.phase === 'preparing' || status.phase === 'capturing') &&
    status.bestEffort === true

  return { exporting, exportingBestEffort, cancel }
}
