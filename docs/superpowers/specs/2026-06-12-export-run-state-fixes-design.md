# Export run state fixes - design

> **PR:** [#229](https://github.com/SanchitB23/meetthefam/pull/229) - `feat: export tree as image / PDF - epic #60`
> **Epic:** [#60](https://github.com/SanchitB23/meetthefam/issues/60) - **Milestone:** v1.2 - Export & archival
> **Date:** 2026-06-12
> **Follows:** PR review findings on export concurrency, degraded fallback behavior, and user-visible failure feedback.

## 1. Goal

Make the tree export flow robust under repeated user input and failed browser capture work, without changing the export formats or the shipped raster/PDF geometry.

The fixes cover both correctness and UX:

- Prevent overlapping export runs from mutating the same family-chart DOM at the same time.
- Prevent the degrade-confirm resolver from being overwritten by a second export event.
- Preserve best-effort fallback export when capture-time native measurement fails, with clear reduced-quality progress copy.
- Show user-visible failure feedback when capture or PDF construction fails.
- Add focused tests for the above lifecycle and failure paths.

## 2. Scope

**In scope**

- `useExportTrigger` orchestration and state model.
- `FamilyTree` preparation/preflight contract shape.
- `ExportProgressDialog` copy for normal vs best-effort export.
- Toast-based export failure feedback.
- Unit/component tests for duplicate events, confirmation, cancellation, degraded fallback, and failures.

**Out of scope**

- Changing PNG/PDF output geometry.
- Adding new export formats.
- Replacing `html-to-image`, `jspdf`, or the live family-chart capture approach.
- Browser smoke automation beyond the existing manual QA flow definitions.

## 3. Chosen approach

Use a small export-run state machine inside `useExportTrigger`.

Alternatives considered:

- **Minimal mutex patch:** smallest diff, but it would leave lifecycle behavior split across ad hoc refs and make error UI feel bolted on.
- **Move orchestration into `FamilyTree`:** gives direct access to DOM context, but makes an already large component own more async control flow.
- **State-machine hook:** centralizes run acceptance, cancellation, pending emission, and cleanup while preserving the existing component boundary. This is the chosen approach.

## 4. Export run lifecycle

`useExportTrigger` accepts one export event only while idle. Once a run is accepted, later `mtf-export-tree` events are ignored until the active run finishes or is cancelled.

The hook keeps a phase state and an active run ref:

```ts
type ExportPhase = 'idle' | 'confirming' | 'preparing' | 'capturing'

type ExportStatus =
  | { phase: 'idle'; error?: string }
  | { phase: 'confirming'; runId: number }
  | { phase: 'preparing'; runId: number; bestEffort?: boolean }
  | { phase: 'capturing'; runId: number; bestEffort?: boolean }
```

`activeRunRef` stores `{ runId, signal }`. `cancel()` flips only that run's signal and returns UI to idle. `finally` only resets state if the finishing async branch still matches the active run, so an older branch can never close a newer run.

Pending is emitted immediately when a run is accepted, before the degrade dialog opens. That disables `ExportTreeButton` throughout confirmation, preparation, and capture. Duplicate event handling is silent because the visible trigger is already disabled.

## 5. Degrade gate and measurement fallback

Preflight remains the main warning gate. It runs before DOM mutation and returns a reason when quality may degrade:

```ts
type DegradeReason = 'oversize' | 'measurement-failed' | 'mobile'

type ExportPreflight = {
  degraded: boolean
  reason?: DegradeReason
}
```

`FamilyTree` maps `measureNativeExtent() === null` to `measurement-failed`, `planExportRaster(...).degraded` to `oversize`, and the hook adds `mobile` when `isMobileLike()` is true.

If preflight reports degraded, the hook enters `confirming` and awaits `confirmDegrade`. Because the run is already active and pending, a second export cannot overwrite the resolver.

If preflight succeeds but `prepareForCapture()` later cannot measure the native extent, the export should still continue with the existing `2400x1600` fallback. That fallback must be surfaced to the hook:

```ts
type CapturePreparation = {
  pixelRatio: number
  restore: () => void
  degraded?: boolean
  degradeReason?: 'measurement-failed'
}
```

When `prepareForCapture()` returns `degraded: true`, the hook captures normally but marks the progress state as best-effort. It does not interrupt the user with a second dialog.

## 6. User-visible feedback

`ExportProgressDialog` should render different copy for normal and best-effort capture:

- Normal: `Preparing export... Capturing your family tree. This can take a few seconds.`
- Best effort: `Preparing best-effort export... This tree may export at reduced quality.`

On capture/PDF failure, the hook should:

- Keep `console.error('[export] Tree capture failed:', err)` for diagnostics.
- Restore the DOM in `finally`.
- Reset pending/export UI.
- Show a Sonner toast: `Export failed. Please try again, or use a desktop browser for large trees.`

Cancel remains silent: no download, no toast, UI returns to idle.

## 7. Testing

Add focused unit/component coverage:

- **Double dispatch:** dispatch two exports before the first finishes; only one capture starts and only one pending cycle emits.
- **Confirm resolver safety:** while the degrade dialog is open, dispatch another export; the second is ignored and the first resolver completes.
- **Cancel during settle/capture:** `signal.aborted` flips, pending resets, and `restore()` still runs.
- **Preparation fallback:** preflight succeeds, `prepareForCapture()` returns `degraded: true`; capture still runs and best-effort progress copy is selected.
- **Capture failure:** mocked `captureTree` rejection still calls `restore()`, resets pending, and fires the toast.
- **PNG gate parity:** at least one degrade-gate test uses `format: 'png'`, since the full-tree export warning applies to PNG and PDF.

No new browser smoke flow is required for this fix set; existing smoke docs cover export downloads and large-tree degraded behavior.

## 8. Success criteria

- Rapid repeated export events cannot produce overlapping DOM resizes, overlapping captures, duplicate downloads, or a hung confirmation promise.
- The export button is disabled for the whole active run, including the degrade dialog.
- Capture-time measurement fallback is explicit and visible as best-effort progress copy.
- Failed export work produces a user-visible toast and leaves the chart restored.
- Existing PNG/PDF output behavior remains unchanged.
