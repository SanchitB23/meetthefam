# Export Run-State Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution recommended — edits are style-sensitive and depend on diff context held in this session). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three PR #235 review findings (stacked modals, orphanable resolver, format churn) + drop dead plumbing, on branch `fix/60-export-run-state`.

**Architecture:** Restore the 5 touched code files to their merge-base versions (repo style), then re-apply the PR's substantive behavior plus the review fixes as targeted edits. TDD where behavior changes (new failing test for dialog gating first). One code commit, one docs commit, push, PR comment.

**Tech Stack:** Next.js 16 / React 19, Vitest + Testing Library (jsdom), sonner toasts.

**Spec:** `docs/superpowers/specs/2026-06-12-export-run-state-review-fixes-design.md` (committed as `8ae7242`)

**Working directory for ALL tasks:** `/Users/sqb6461/Workspace/SelfProjects/meetthefam-worktrees/pr-229-review` (branch `fix/60-export-run-state`, currently at `8ae7242`)

---

## Context

PR #235 (`fix: serialize tree export runs`, Cursor-authored) introduced an export-run state machine into `useExportTrigger`. Review found: (1) `exporting = phase !== 'idle'` opens the progress dialog during the `confirming` phase, stacking it with the degrade dialog — a regression of behavior the pre-PR code explicitly protected; (2) `cancel()` during `confirming` can orphan `FamilyTree`'s `degradeResolverRef`, leaking an unresolved promise; (3) every touched file was reformatted to double-quotes + semicolons, bloating the diff ~3× and polluting blame on `FamilyTree.tsx`. The PR also added `DegradeReason`/`reason`/`degradeReason` fields nothing consumes.

The merge-base is `9012ef3` (`git merge-base origin/feat/60-tree-export HEAD`). Restoring files from it and re-applying intent gives a minimal, style-clean diff.

---

### Task 0: Setup + baseline

**Files:** none modified.

- [ ] **Step 0.1:** Confirm branch + clean tree:

```bash
cd /Users/sqb6461/Workspace/SelfProjects/meetthefam-worktrees/pr-229-review
git status --porcelain && git log --oneline -2
```
Expected: empty status; `8ae7242` (spec), `b396d67` (Cursor fix).

- [ ] **Step 0.2:** Ensure deps (own install per worktree, never symlink node_modules):

```bash
ls node_modules/.bin/vitest >/dev/null 2>&1 || pnpm install --prefer-offline
```

- [ ] **Step 0.3:** Baseline — current suites green before touching anything:

```bash
pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts src/__tests__/components/ExportProgressDialog.test.tsx
```
Expected: PASS (the PR's own tests).

---

### Task 1: Restore base versions (style reset)

**Files (Modify — full overwrite from merge-base):**
- `src/app/(app)/tree/[id]/_components/FamilyTree.tsx`
- `src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx`
- `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts`
- `src/__tests__/lib/useExportTrigger.test.ts`
- `src/__tests__/components/ExportProgressDialog.test.tsx`

- [ ] **Step 1.1:** Overwrite each with its merge-base version:

```bash
MB=$(git merge-base origin/feat/60-tree-export HEAD)
for f in \
  'src/app/(app)/tree/[id]/_components/FamilyTree.tsx' \
  'src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx' \
  'src/app/(app)/tree/[id]/_lib/useExportTrigger.ts' \
  'src/__tests__/lib/useExportTrigger.test.ts' \
  'src/__tests__/components/ExportProgressDialog.test.tsx'; do
  git show "$MB:$f" > "$f"
done
git diff --stat
```
Expected: 5 files changed; tree now has base behavior in repo style. (No commit — intermediate state.)

---

### Task 2: Tests first — ExportProgressDialog

**Files:**
- Test: `src/__tests__/components/ExportProgressDialog.test.tsx`

- [ ] **Step 2.1:** Add a best-effort copy test. Insert after the `'shows the preparing message when open'` test:

```tsx
  it('shows reduced-quality copy for best-effort exports', () => {
    render(<ExportProgressDialog open bestEffort />)
    expect(screen.getByText('Preparing best-effort export…')).toBeInTheDocument()
    expect(screen.getByText('This tree may export at reduced quality.')).toBeInTheDocument()
  })
```

(Note: copy keeps the repo's `…` ellipsis character, NOT `...` — the Cursor commit changed it gratuitously.)

- [ ] **Step 2.2:** Run — expect FAIL (TS: no `bestEffort` prop):

```bash
pnpm vitest run src/__tests__/components/ExportProgressDialog.test.tsx
```

---

### Task 3: Tests first — useExportTrigger

**Files:**
- Test: `src/__tests__/lib/useExportTrigger.test.ts` (base version, now restored)

All edits below are against the restored base file; code is in repo style.

- [ ] **Step 3.1:** Imports — add `afterEach`:

```ts
// old
import { beforeEach, describe, expect, it, vi } from 'vitest'
// new
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

- [ ] **Step 3.2:** Add a hoisted sonner mock ABOVE the existing capture-tree mock (before the `// Stub the real rasteriser` comment):

```ts
const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { error: toastError },
}))
```

- [ ] **Step 3.3:** Replace per-describe setup with file-level setup. Insert before `describe('useExportTrigger', () => {`:

```ts
beforeEach(() => {
  captureTreeMock.mockReset()
  captureTreeMock.mockResolvedValue(undefined)
  isMobileLikeMock.mockReturnValue(false)
  toastError.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})
```

Then delete the line `  beforeEach(() => captureTreeMock.mockClear())` inside the first describe, and delete this block inside the `#225` describe:

```ts
  beforeEach(() => {
    captureTreeMock.mockClear()
    isMobileLikeMock.mockReturnValue(false)
  })
```

- [ ] **Step 3.4:** Add run-serialization test after `'passes the format + treeName from the event through to captureTree'`:

```ts
  it('ignores a second export event while a run is active', async () => {
    let resolveCapture!: () => void
    captureTreeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCapture = resolve
        }),
    )
    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))
    const { unmount } = renderHook(() => useExportTrigger(ref, { readOnly: false }))

    dispatchExportTree({ format: 'png', treeName: 'First' })
    dispatchExportTree({ format: 'pdf', treeName: 'Second' })

    await waitFor(() => expect(captureTreeMock).toHaveBeenCalledTimes(1))
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement), 'png', 'First', expect.anything(), 3,
    )
    resolveCapture()
    await waitFor(() => expect(pending).toEqual([true, false]))

    unmount()
    off()
  })
```

- [ ] **Step 3.5:** Add failure-feedback test after `'restore() is called even when captureTree throws'`:

```ts
  it('shows a toast and resets pending when captureTree throws', async () => {
    const restore = vi.fn()
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 3, restore }))
    captureTreeMock.mockRejectedValueOnce(new Error('raster failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    const { ref } = makeContainer()
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    )

    dispatchExportTree({ format: 'png', treeName: 'ErrorCase' })

    await waitFor(() => expect(restore).toHaveBeenCalled(), { timeout: 2000 })
    expect(consoleSpy).toHaveBeenCalledWith('[export] Tree capture failed:', expect.any(Error))
    expect(toastError).toHaveBeenCalledWith(
      'Export failed. Please try again, or use a desktop browser for large trees.',
    )
    expect(pending[pending.length - 1]).toBe(false)

    unmount()
    off()
  })
```

- [ ] **Step 3.6:** In the existing cancel test (`'cancel resets pending and exporting; signal passed to captureTree reflects aborted state'`), replace the timing-based mock with a deterministic deferred one. Replace:

```ts
    const receivedSignals: Array<{ aborted: boolean } | undefined> = []
    captureTreeMock.mockImplementation(async (_el, _fmt, _name, signal) => {
      receivedSignals.push(signal as { aborted: boolean } | undefined)
      // Yield so the cancel call has a chance to flip signal.aborted
      // before captureTree's post-raster abort check would run.
      await new Promise((r) => setTimeout(r, 0))
    })
```
with:
```ts
    const receivedSignals: Array<{ aborted: boolean } | undefined> = []
    let resolveCapture!: () => void
    captureTreeMock.mockImplementation(async (_el, _fmt, _name, signal) => {
      receivedSignals.push(signal as { aborted: boolean } | undefined)
      await new Promise<void>((resolve) => {
        resolveCapture = resolve
      })
    })
```
and add `resolveCapture()` immediately before the final `unmount()` of that test.

- [ ] **Step 3.7:** Add cancel-during-settle + best-effort tests at the end of the first describe (before its closing `})`):

```ts
  it('cancel during the settle delay aborts the run and still restores preparation', async () => {
    const restore = vi.fn()
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 3, restore }))
    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))
    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    )

    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })
    await waitFor(() => expect(prepareForCapture).toHaveBeenCalled())

    result.current.cancel()

    await waitFor(() => expect(restore).toHaveBeenCalled(), { timeout: 2000 })
    expect(captureTreeMock).not.toHaveBeenCalled()
    expect(pending[pending.length - 1]).toBe(false)
    expect(toastError).not.toHaveBeenCalled()

    unmount()
    off()
  })

  it('continues as best-effort when preparation reports a degraded fallback', async () => {
    let resolveCapture!: () => void
    captureTreeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCapture = resolve
        }),
    )
    const restore = vi.fn()
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 1, restore, degraded: true }))
    const { ref } = makeContainer()
    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: false }),
        confirmDegrade: vi.fn(async () => true),
        prepareForCapture,
      }),
    )

    dispatchExportTree({ format: 'png', treeName: 'Fallback' })

    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled(), { timeout: 2000 })
    expect(result.current.exportingBestEffort).toBe(true)
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement), 'png', 'Fallback', expect.anything(), 1,
    )

    resolveCapture()
    await waitFor(() => expect(result.current.exporting).toBe(false))
    expect(restore).toHaveBeenCalled()
    unmount()
  })
```

- [ ] **Step 3.8:** In the `#225` describe — update the declining-gate test (pending now covers the confirm). Replace its name and final assertions:

```ts
// old name
it('asks for confirmation when preflight reports degraded; declining aborts with no pending events', async () => {
// new name
it('asks for confirmation when preflight reports degraded; declining aborts after one pending cycle', async () => {
```
```ts
// old assertions
    expect(captureTreeMock).not.toHaveBeenCalled()
    expect(pending).toEqual([]) // gate runs BEFORE pending — no dialog flash
// new assertions
    expect(captureTreeMock).not.toHaveBeenCalled()
    expect(pending).toEqual([true, false]) // pending covers the confirm dialog too
```

Same change in `'gates on mobile even when preflight is clean'`: `expect(pending).toEqual([])` → `expect(pending).toEqual([true, false])`.

- [ ] **Step 3.9:** Add the three remaining gate tests at the end of the `#225` describe (before its closing `})`):

```ts
  it('uses the same degraded gate for PNG exports', async () => {
    const { ref } = makeContainer()
    const confirmDegrade = vi.fn(async () => true)
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true }),
        confirmDegrade,
      }),
    )
    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled())
    expect(confirmDegrade).toHaveBeenCalledTimes(1)
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement), 'png', 'Smith Family', expect.anything(), 3,
    )
    unmount()
  })

  it('keeps the first degraded confirmation resolver when a second event is dispatched', async () => {
    let resolveConfirm!: (ok: boolean) => void
    const confirmDegrade = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveConfirm = resolve
        }),
    )
    const { ref } = makeContainer()
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true }),
        confirmDegrade,
      }),
    )

    dispatchExportTree({ format: 'pdf', treeName: 'First' })
    await waitFor(() => expect(confirmDegrade).toHaveBeenCalledTimes(1))
    dispatchExportTree({ format: 'png', treeName: 'Second' })
    await new Promise((r) => setTimeout(r, 20))
    expect(confirmDegrade).toHaveBeenCalledTimes(1)

    resolveConfirm(true)
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalledTimes(1))
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement), 'pdf', 'First', expect.anything(), 3,
    )
    unmount()
  })

  it('keeps the progress dialog closed while the degrade confirmation is open', async () => {
    let resolveConfirm!: (ok: boolean) => void
    const confirmDegrade = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveConfirm = resolve
        }),
    )
    let resolveCapture!: () => void
    captureTreeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCapture = resolve
        }),
    )
    const { ref } = makeContainer()
    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true }),
        confirmDegrade,
      }),
    )

    dispatchExportTree({ format: 'pdf', treeName: 'Smith Family' })
    await waitFor(() => expect(confirmDegrade).toHaveBeenCalled())
    // #235 review fix 1 — the degrade dialog must be the ONLY thing on screen.
    expect(result.current.exporting).toBe(false)

    resolveConfirm(true)
    await waitFor(() => expect(result.current.exporting).toBe(true))
    resolveCapture()
    await waitFor(() => expect(result.current.exporting).toBe(false))
    unmount()
  })
```

- [ ] **Step 3.10:** Run — expect FAIL (base hook lacks the state machine, `exportingBestEffort`, toast):

```bash
pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts
```

---

### Task 4: Implement — ExportProgressDialog.tsx

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx` (restored base)

- [ ] **Step 4.1:** Props + signature:

```tsx
// old
type Props = {
  open: boolean
  /** Called when the user clicks Cancel. Soft-cancel: skips the download. */
  onCancel?: () => void
}

export function ExportProgressDialog({ open, onCancel }: Props) {
// new
type Props = {
  open: boolean
  /** True when capture fell back to a reduced-quality export path. */
  bestEffort?: boolean
  /** Called when the user clicks Cancel. Soft-cancel: skips the download. */
  onCancel?: () => void
}

export function ExportProgressDialog({ open, bestEffort = false, onCancel }: Props) {
```

- [ ] **Step 4.2:** Copy:

```tsx
// old
          <DialogTitle className="font-serif text-xl">Preparing export…</DialogTitle>
          <DialogDescription>
            Capturing your family tree. This can take a few seconds.
          </DialogDescription>
// new
          <DialogTitle className="font-serif text-xl">
            {bestEffort ? 'Preparing best-effort export…' : 'Preparing export…'}
          </DialogTitle>
          <DialogDescription>
            {bestEffort
              ? 'This tree may export at reduced quality.'
              : 'Capturing your family tree. This can take a few seconds.'}
          </DialogDescription>
```

- [ ] **Step 4.3:** Run — expect PASS:

```bash
pnpm vitest run src/__tests__/components/ExportProgressDialog.test.tsx
```

---

### Task 5: Implement — useExportTrigger.ts

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts` (restored base)

- [ ] **Step 5.1:** Import sonner:

```ts
// old
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  emitExportPending,
  onExportTree,
} from './export-events'
// new
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import {
  emitExportPending,
  onExportTree,
} from './export-events'
```

- [ ] **Step 5.2:** Extend `CapturePreparation` (no `degradeReason` — dead plumbing stays dead):

```ts
// old
export type CapturePreparation = {
  /** pixelRatio computed by planExportRaster for this tree's native extent. */
  pixelRatio: number
  /** Restores the container to its pre-capture state. Always call in finally. */
  restore: () => void
}
// new
export type CapturePreparation = {
  /** pixelRatio computed by planExportRaster for this tree's native extent. */
  pixelRatio: number
  /** Restores the container to its pre-capture state. Always call in finally. */
  restore: () => void
  /** True when capture uses a fallback that may reduce output quality. */
  degraded?: boolean
}
```

- [ ] **Step 5.3:** Add the run state machine types after the `ExportPreflight` type block:

```ts
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
```

- [ ] **Step 5.4:** Replace the hook body. Old (entire function from signature through `cancel` and the handler — see restored base) becomes:

```ts
export function useExportTrigger(
  containerRef: RefObject<HTMLElement | null>,
  { readOnly, prepareForCapture, fitFn, preflight, confirmDegrade }: Options,
): { exporting: boolean; exportingBestEffort: boolean; cancel: () => void } {
  const [status, setStatus] = useState<ExportStatus>({ phase: 'idle' })
  // activeRunRef holds the accepted run's id + CaptureSignal. cancel() flips
  // the signal and clears the ref; the run's `finally` only resets UI when it
  // still owns the ref, so an older async branch can never close a newer run.
  const activeRunRef = useRef<ActiveRun | null>(null)
  const nextRunIdRef = useRef(0)

  // Stable cancel callback: flip the current signal and reset UI immediately.
  // The in-flight raster may still produce a blob, but captureTree checks the
  // flag before calling triggerDownload, so no download fires.
  const cancel = useCallback(() => {
    const active = activeRunRef.current
    if (!active) return
    active.signal.aborted = true
    activeRunRef.current = null
    setStatus({ phase: 'idle' })
    emitExportPending({ pending: false })
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
        // Only the active run may clear UI. If cancel() already cleared the
        // run, this older async branch must not emit another pending reset.
        if (activeRunRef.current?.runId === runId) {
          activeRunRef.current = null
          emitExportPending({ pending: false })
          setStatus({ phase: 'idle' })
        }
      }
    })
```

(The trailing exhaustive-deps comment block and `}, [containerRef, readOnly])` stay as in base.)

- [ ] **Step 5.5:** Replace the return:

```ts
// old
  }, [containerRef, readOnly])

  return { exporting, cancel }
}
// new
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
```

Also update the `#225 preflight` doc comment on the `preflight` option (it still says "Runs before any pending state"):

```ts
// old
   * #225 preflight: measure + plan WITHOUT resizing the container. Runs before
   * any pending state so the degrade dialog isn't stacked behind the progress
   * dialog. When it reports degraded — or the device is mobile-like — the
   * export pauses on `confirmDegrade`.
// new
   * #225 preflight: measure + plan WITHOUT resizing the container. Runs inside
   * the accepted run (button disabled via pending) but before the progress
   * dialog shows. When it reports degraded — or the device is mobile-like —
   * the export pauses on `confirmDegrade`.
```

- [ ] **Step 5.6:** Run — expect PASS:

```bash
pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts
```

---

### Task 6: Implement — FamilyTree.tsx (4 hunks on restored base)

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/FamilyTree.tsx`

- [ ] **Step 6.1:** Measurement-fallback flag in `prepareForCapture`:

```ts
// old
    // Measure native extent.
    const nativeExtent = cont ? measureNativeExtent(cont) : null
// new
    // Measure native extent.
    const nativeExtent = cont ? measureNativeExtent(cont) : null
    const usedMeasurementFallback = nativeExtent === null
```

```ts
// old
    return { pixelRatio: plan.pixelRatio, restore }
  }, [containerRef])
// new
    // #235 review fix — surface the measurement fallback so the hook can show
    // best-effort progress copy instead of silently degrading.
    return { pixelRatio: plan.pixelRatio, restore, degraded: usedMeasurementFallback }
  }, [containerRef])
```

- [ ] **Step 6.2:** Defensive resolver swap in `confirmDegrade`:

```ts
// old
  const confirmDegrade = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        degradeResolverRef.current = resolve
        setDegradeOpen(true)
      }),
    [],
  )
// new
  const confirmDegrade = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        // #235 review fix — defensively settle an orphaned prior confirm
        // (e.g. a run cancelled while its dialog was open) so no promise leaks.
        degradeResolverRef.current?.(false)
        degradeResolverRef.current = resolve
        setDegradeOpen(true)
      }),
    [],
  )
```

- [ ] **Step 6.3:** Destructure `exportingBestEffort`:

```ts
// old
  const { exporting, cancel: cancelExport } = useExportTrigger(containerRef, {
// new
  const { exporting, exportingBestEffort, cancel: cancelExport } = useExportTrigger(containerRef, {
```

- [ ] **Step 6.4:** Thread it to the dialog:

```tsx
// old
      {!readOnly && <ExportProgressDialog open={exporting} onCancel={cancelExport} />}
// new
      {!readOnly && (
        <ExportProgressDialog open={exporting} bestEffort={exportingBestEffort} onCancel={cancelExport} />
      )}
```

---

### Task 7: Full verification

- [ ] **Step 7.1:** All export suites:

```bash
pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts src/__tests__/components/ExportProgressDialog.test.tsx src/__tests__/lib/capture-tree-canvas.test.ts src/__tests__/lib/capture-tree.test.ts src/__tests__/lib/export-raster-plan.test.ts src/__tests__/lib/tree-to-pdf.test.ts src/__tests__/components/ExportTreeButton.test.tsx
```
Expected: PASS.

- [ ] **Step 7.2:** Types + lint:

```bash
pnpm exec next typegen && pnpm typecheck && pnpm lint
```
Expected: clean.

- [ ] **Step 7.3:** Style check — diff vs integration branch must contain no quote/semicolon-only hunks:

```bash
git diff origin/feat/60-tree-export -- 'src/**' | grep -cE '^\+.*;$' || true
git diff origin/feat/60-tree-export --stat
```
Expected: near-zero semicolon-terminated added lines (JSX attr lines aside); stat roughly ~500 total lines vs the previous ~1500.

---

### Task 8: Commit code + tests

- [ ] **Step 8.1:** **Ask the user before committing** (CLAUDE.md rule — show diff summary first). Then:

```bash
git add 'src/app/(app)/tree/[id]/_components/FamilyTree.tsx' \
        'src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx' \
        'src/app/(app)/tree/[id]/_lib/useExportTrigger.ts' \
        'src/__tests__/lib/useExportTrigger.test.ts' \
        'src/__tests__/components/ExportProgressDialog.test.tsx'
git commit -m "fix(#60): export review fixes — dialog gating, resolver guard, style restore

- exporting excludes 'confirming': degrade dialog is the only thing on
  screen during confirmation (button stays disabled via pending events)
- confirmDegrade defensively settles an orphaned prior resolver
- drop dead DegradeReason/reason/degradeReason plumbing
- restore repo style (single quotes, no semis) across touched files

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Amend the in-PR spec doc

**Files:**
- Modify: `docs/superpowers/specs/2026-06-12-export-run-state-fixes-design.md` (the doc PR #235 added)

- [ ] **Step 9.1:** §4 — replace the status sketch:

```ts
// old block (inside the ```ts fence)
type ExportPhase = 'idle' | 'confirming' | 'preparing' | 'capturing'

type ExportStatus =
  | { phase: 'idle'; error?: string }
  | { phase: 'confirming'; runId: number }
  | { phase: 'preparing'; runId: number; bestEffort?: boolean }
  | { phase: 'capturing'; runId: number; bestEffort?: boolean }
// new block
type ExportStatus =
  | { phase: 'idle' }
  | { phase: 'confirming'; runId: number }
  | { phase: 'preparing'; runId: number; bestEffort?: boolean }
  | { phase: 'capturing'; runId: number; bestEffort?: boolean }
```

- [ ] **Step 9.2:** §4 — append to the "Pending is emitted immediately…" paragraph:

```md
`exporting` (which drives `ExportProgressDialog`) excludes the `confirming` phase, so the degrade dialog is the only thing on screen during confirmation. `confirmDegrade` defensively settles any orphaned prior resolver with `false` before storing a new one.
```

- [ ] **Step 9.3:** §5 — replace the reason sketches:

```ts
// old
type DegradeReason = 'oversize' | 'measurement-failed' | 'mobile'

type ExportPreflight = {
  degraded: boolean
  reason?: DegradeReason
}
// new
type ExportPreflight = {
  degraded: boolean
}
```

Replace the mapping sentence:

```md
// old
`FamilyTree` maps `measureNativeExtent() === null` to `measurement-failed`, `planExportRaster(...).degraded` to `oversize`, and the hook adds `mobile` when `isMobileLike()` is true.
// new
`FamilyTree` reports degraded when `measureNativeExtent()` returns `null` or `planExportRaster(...)` plans a degraded raster; the hook additionally gates when `isMobileLike()` is true.
```

And in the `CapturePreparation` sketch, delete the line `  degradeReason?: 'measurement-failed'`.

- [ ] **Step 9.4:** §6 — fix copy to the shipped ellipsis character: `Preparing export...` → `Preparing export…`, `Preparing best-effort export...` → `Preparing best-effort export…`.

- [ ] **Step 9.5:** Commit (ask user first):

```bash
git add docs/superpowers/specs/2026-06-12-export-run-state-fixes-design.md
git commit -m "docs(#60): amend export run-state spec to match shipped behavior

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Push + PR comment

- [ ] **Step 10.1:** Push (includes the earlier spec commit `8ae7242`):

```bash
git push origin fix/60-export-run-state
```

- [ ] **Step 10.2:** Post the review-summary comment (fill `<sha-code>`/`<sha-docs>` from `git log --oneline -3`):

```bash
gh pr comment 235 --repo SanchitB23/meetthefam --body "## Review fixes applied

Code review found three issues; fixed in <sha-code> (+ spec amendment <sha-docs>, design in \`docs/superpowers/specs/2026-06-12-export-run-state-review-fixes-design.md\`):

1. **Stacked modals during \`confirming\`** — \`exporting\` included the \`confirming\` phase, so \`ExportProgressDialog\` opened together with \`ExportDegradeDialog\`. Fixed: \`exporting\` now derives from \`preparing\`/\`capturing\` only; the export button stays disabled for the whole run via the pending events. New test: *keeps the progress dialog closed while the degrade confirmation is open*.
2. **Orphanable degrade resolver** — \`cancel()\` during \`confirming\` could leave \`degradeOpen\` stale and the \`confirmDegrade\` promise unresolved forever. Fixed: \`confirmDegrade\` defensively settles any prior resolver with \`false\` before storing a new one.
3. **Format-only churn** — the diff reformatted every touched file to double-quotes + semicolons (~⅔ of the line count). Reverted to the repo's existing style; the PR now contains only substantive changes.

Also dropped the unconsumed \`DegradeReason\`/\`reason\`/\`degradeReason\` plumbing (the \`degraded\` booleans are the whole contract) and amended the in-PR spec doc to match shipped behavior."
```

- [ ] **Step 10.3:** Confirm PR checks go green: `gh pr checks 235 --repo SanchitB23/meetthefam --watch` (or report status).

---

## Verification (end-to-end)

1. Task 7 gates (vitest suites, typecheck, lint) all green.
2. `git diff origin/feat/60-tree-export --stat` ≈ ⅓ of the pre-fix size; spot-check `FamilyTree.tsx` hunks are substantive-only.
3. Manual (optional, dev server): force `isMobileLike` or use a large tree → Export → only the degrade dialog shows; Continue → progress dialog appears; Cancel → silent return to idle, chart restored.
4. PR #235 shows the new commits + summary comment; CI green.

## Self-review notes (done)

- Spec §2 (Fix 1) → Task 5 Steps 5.4/5.5 + Task 3 Step 3.9 (test). Spec §3 (Fix 2) → Task 6 Step 6.2. Spec §4 (style) → Tasks 1–6 method + Task 7 Step 7.3. Spec §5 (cleanup) → omissions in Steps 5.2/5.4 + Step 3.9 (no `reason` in tests). Spec §6 (doc amendment) → Task 9. Spec §7 (tests) → Task 3. Spec §8 (PR comment) → Task 10. No placeholders; type names (`ExportStatus`, `ActiveRun`, `CapturePreparation.degraded`, `exportingBestEffort`) consistent across tasks.
