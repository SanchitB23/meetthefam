# Export cancel: hold the run lock until drain completes — design

**Date:** 2026-06-12
**Issue:** #60 (epic) — found in PR #229 review, residue of the #235 run-serialization fix
**Status:** Approved (Approach A)

## Problem

After cancelling an export, starting a new one can interleave two runs' DOM
mutations against the same family-chart instance:

1. **Run A** is accepted: `prepareForCapture()` saves the container's current
   inline size as `prev` (normal viewport size), enlarges the container to the
   tree's native extent, and starts the raster. `html-to-image`'s `toCanvas`
   has **no abort support** — once started it runs to completion (seconds;
   longer on big trees).
2. **User clicks Cancel.** Today `cancel()` sets `signal.aborted = true`,
   **clears `activeRunRef`**, and emits `pending: false` — the header button
   re-enables. But Run A is only *soft*-cancelled: its raster is still running
   and its `finally` (which calls `restore()`) has not executed.
3. **User clicks Export again.** The accept-guard
   (`if (activeRunRef.current) return`) passes — the ref is null — so
   **Run B is accepted while Run A is still draining**. Two failures follow:
   - **Run B's snapshot is poisoned.** Its `prepareForCapture()` saves
     "previous size" = A's *enlarged* box, because A hasn't restored yet. Even
     a perfect Run B then restores the container to A's enlarged size — the
     tree is stuck oversized until reload.
   - **Run A's restore stomps Run B's capture.** When A's raster resolves,
     A's `finally` calls `preparation.restore()` unconditionally — shrinking
     the container and firing `updateTree({ initial: true })` while B is
     mid-raster. B's export comes out clipped/garbled.

## Root cause

Cancellation was modeled as *"the run is over"* when it actually means *"the
run's result is unwanted."* The run is only over when its `finally` executes.
\#235 correctly introduced the single-run lock (`activeRunRef`), but `cancel()`
releases that lock **before the critical section ends** — the in-flight raster
and the pending `restore()` are still outstanding side effects of the
cancelled run. The unconditional restore and the `prev`-size snapshot are both
correct *only under* the one-run-at-a-time invariant, so releasing the lock
early breaks both.

### History

- `cf357b5` / `86fbb07` (2026-06-07/08, #218): cancel + `prepareForCapture`/
  `restore` landed with **no run gating at all** — overlapping runs possible
  since then.
- `b396d67` / `b25089a` (2026-06-12, #235): added `activeRunRef` serialization,
  fixing the general overlap (double-fire) but leaving the post-cancel window.

## Decision — Approach A: hold the lock until drain completes

`cancel()` discards the result and hides the dialog; it does **not** end the
run. The run's `finally` is the single point that releases the lock.

### Alternatives considered

- **B — ownership-guarded restore + instant re-accept.** New run starts
  immediately; old run skips restore if it lost ownership. Rejected: B's
  poisoned `prev` snapshot needs a separate persistent "true original size"
  ref, two rasters run concurrently (double peak memory on canvases up to
  16k px wide), and A's discarded raster burns CPU under B. More states and
  subtler code for a marginally faster button re-enable.
- **C — A plus an explicit `draining` phase** with "Finishing cancellation…"
  button copy. Deferred: purely additive polish; can layer on later if the
  lingering spinner confuses anyone in QA.

## Behavioral contract

- A run owns the chart DOM from acceptance until its `finally` finishes —
  **including after cancel**.
- Cancel closes the progress dialog immediately (status → `idle`).
- The header export button stays disabled (pending stays `true`, spinner
  shows) until the cancelled raster drains.
- An `mtf-export-tree` event arriving during the drain is dropped by the
  existing accept-guard, exactly as during a live run.
- No new user-facing states or copy.

## Code changes

All in `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts`:

- `cancel()` shrinks to: `signal.aborted = true` + `setStatus({ phase:
  'idle' })`. It **no longer** clears `activeRunRef` and **no longer** emits
  `pending: false`.
- The run's `finally` becomes the unconditional single point of release:
  restore preparation, clear `activeRunRef`, emit `pending: false`,
  `setStatus(idle)`. The `runId === activeRunRef.current?.runId` ownership
  check stays as a defensive guard but is now always true for the draining
  run (only the owner reaches its own `finally` while holding the lock).
- Rewrite the `cancel` docstring and the #235 state-machine comment to state
  the new invariant: *lock is held until `finally`; cancel discards the
  result, it does not end the run.*

## Error handling

Unchanged. A throw after cancel is swallowed by the existing
`if (!signal.aborted)` toast guard, and `finally` still releases everything.
Every exit from the run — success, error, cancel, degrade-decline — flows
through the same `finally`; there is no path that leaks the lock or the
container size.

## Testing

In `src/__tests__/lib/useExportTrigger.test.ts`:

- **Update one test**: "cancel resets pending" becomes "pending stays
  `true` after cancel and flips `false` once the in-flight capture resolves."
  The test already holds the capture open via a manual `resolveCapture()`, so
  this is an assertion reorder, not new machinery. (The
  "cancel during the settle delay" test needs **no** changes — its observable
  `pending` sequence is `[true, false]` under both old and new behavior; the
  `false` just moves from `cancel()` to `finally`.)
- **New regression test for the race**: start run A → cancel → dispatch a
  second export while A's capture is unresolved → assert run B is **not**
  accepted (`captureTree` called once) and A's `restore()` fires exactly
  once; then resolve A and assert pending goes `false` and a third export
  **is** accepted.

## Out of scope

- True raster abort (html-to-image has no cancellation API).
- The `draining` UI phase / copy (Alternative C) — revisit only if QA flags
  the lingering spinner.
- iOS Safari canvas-cap handling — tracked separately as the last PR #229
  blocker.
