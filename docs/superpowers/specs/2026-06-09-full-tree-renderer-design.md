# Full-tree (archival) export — design

> **Issue:** [#225](https://github.com/SanchitB23/meetthefam/issues/225) — `feat: dedicated full-layout renderer for full-tree (archival) export`
> **Epic:** [#60](https://github.com/SanchitB23/meetthefam/issues/60) · **Milestone:** v1.2 — Export & archival
> **Spun out of:** [#215](https://github.com/SanchitB23/meetthefam/issues/215) spike — verdict **A-now / B-later** (`docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md` §10)
> **Date:** 2026-06-09
> **Depends on:** [#219](https://github.com/SanchitB23/meetthefam/issues/219) (PDF export + footer/watermark). Sequence: #218 (done) → #219 → **#225**.

## 1. Background & reframe

The #215 spike called for a "dedicated full-layout renderer" on the assumption that #218 would ship only a cheap *current-view* capture and that full-tree export needed a separate offscreen/server renderer. **That framing is overtaken by events:**

- **#218 already ships native-scale full-layout capture.** Its enlarge-container approach resizes the chart container to the tree's native extent so family-chart re-fits at scale ≈1×, then captures the wrapper div (`svg.main_svg.parentElement`) holding both cards and connector lines. `planExportRaster` already degrades `pixelRatio` to stay within browser canvas caps (16384px side / area). Mechanically, **this _is_ the full-layout renderer the B-path asked for** — reusing the live chart rather than a separate offscreen one. See `export-raster-plan.ts`, `useExportTrigger.ts`, `capture-tree.ts`, and `FamilyTree.tsx:180` (`prepareForCapture`).
- **The gating bugs are closed.** #224 (single-primary-root trees collapsing to ~2 nodes) is fixed; #216 (crossOrigin) and #217 (containerRef seam) are closed.

So #225 is **not** a rebuild. It is **validate-then-extend**: treat #218's capture as the renderer, measure the real ceiling, and add the archival outputs and degrade handling. A separate offscreen/server renderer is built **only if** validation proves the client path cannot reach a readable ~200-person tree — in which case a follow-up issue is filed rather than ballooning #225.

## 2. Goal & success bar

**Goal:** ship readable full-tree archival export — PNG + single-page large-format PDF + tiled multi-page PDF — with an honest degrade path, and record the deferred canvas/memory ceiling measurement.

**Readability bar (pass/fail):** each card's name + relationship text is **legible at 100% zoom on a normal desktop monitor** when viewing the exported file. Operationally, because the enlarge-container path renders cards at their **native CSS size**, this maps to: *the output keeps cards at ≥ native size* — i.e. `planExportRaster` returns `pixelRatio ≥ 1` and does **not** shrink the box. The **ceiling** is the people-count at which box-shrink (or `pixelRatio < 1`) first kicks in; past it we degrade.

## 3. Scope & non-goals

**In scope**
- Pre-flight measurement gating the export run.
- Full-tree PNG (reuse #218 verbatim).
- Single-page large-format PDF (one oversized page = the whole canvas).
- Tiled multi-page PDF (Approach A — slice one produced canvas into page-sized tiles).
- Warn/degrade dialog (over-ceiling or mobile).
- Real-browser ceiling validation (the deferred #215 measurement) + recorded results.

**Non-goals**
- **No server/headless path** — deferred to a follow-up only if validation fails the bar.
- **No tile-by-tile re-render (Approach B)** — explicitly rejected (N re-renders, fragile pan/transform math, seam risk). Approach A's canvas-cap bound is accepted; above it the warn dialog fires.
- **No export on the read-only `/share` route** — `useExportTrigger` is gated behind `readOnly`, so the share-page chart already ignores export events. Unchanged.
- **No family-chart internal changes.**

## 4. Architecture — the delta over #218

#225 keeps #218's enlarge-container native-scale path as the single full-tree renderer and adds four things:

1. **Pre-flight measurement** — run `measureNativeExtent` + `planExportRaster` *before* resizing/capturing, so we know up-front whether the tree clears the readability bar (`pixelRatio ≥ 1`, box not shrunk).
2. **Two PDF outputs** — single large-format page and tiled multi-page (both consume one produced canvas).
3. **Warn/degrade dialog** — fired by the pre-flight when over-ceiling or on a mobile-like device.
4. **Documented real-browser ceiling validation** — recreate a stress-seed fixture and record the 100→200 curve.

### 4.1 Export run flow

Today (#218): click → `prepareForCapture` → settle → `captureTree` → download. New flow inserts a decision gate and a format branch:

```
click format (png | pdf | pdf-tiled)
  → preflight: measureNativeExtent + planExportRaster   (NO DOM resize yet)
  → if plan.degraded OR isMobileLike():
        show ExportDegradeDialog → [Continue] | [Cancel / open on desktop]
        (Cancel → abort run, restore nothing changed)
  → prepareForCapture (resize container to box, fit chart at ≈1×)
  → settle (FIT_SETTLE_MS) → produce CANVAS  (shared; keeps Safari fixes)
  → branch by format:
        png        → canvas → png blob → download                (existing)
        pdf        → canvas → 1 oversized jsPDF page → download   (base from #219)
        pdf-tiled  → canvas → export-tiling slices → multipage jsPDF → download
  → restore() ALWAYS in finally
```

**Key refactor (lands in #219, reused here):** `capture-tree.ts` currently couples *produce-blob* with *download-PNG*. Split it so a shared step produces the canvas/blob (retaining the Safari hardening — inline images, inline link strokes, 2-pass `toBlob`) and format-specific builders consume it.

### 4.2 Module plan

| File | Status | Responsibility |
|---|---|---|
| `_lib/export-events.ts` | edit | `ExportFormat = 'png' \| 'pdf' \| 'pdf-tiled'` (`'pdf'` = single large page). |
| `_lib/export-raster-plan.ts` | edit | Add `degraded: boolean` to `RasterPlan` (true when box was shrunk or `pixelRatio` clamped < 1). Pure. |
| `_lib/capture-tree.ts` | refactor (#219) | Split *produce canvas* (shared, Safari fixes) from *download PNG*. |
| `_lib/export-pdf.ts` | new (base #219, extend #225) | `canvas → single-page PDF` (#219) and `canvas → tiled PDF` (#225), via `jspdf`. |
| `_lib/export-tiling.ts` | **new (#225)** | Pure geometry: `(canvasW, canvasH, pageAspect, overlapPx, marginPx) → Tile[] + crop-mark coords`. Fully unit-testable, no DOM. |
| `_lib/useExportTrigger.ts` | edit | Add preflight + warn-gate; branch produce→format builder. |
| `_lib/isMobileLike.ts` | **new (#225)** | Coarse-pointer + small-viewport matcher for the degrade trigger. |
| `_components/ExportTreeButton.tsx` | edit | Dropdown menu: PNG / PDF / PDF for print (tiled). |
| `_components/ExportDegradeDialog.tsx` | **new (#225)** | Warn + Continue / open-on-desktop. |
| `_components/FamilyTree.tsx` | edit | Wire preflight measurement + degrade-dialog state. |
| `scripts/seed-export-stress.ts` | **new — re-create (#225)** | Deterministic 25/50/100/150/200 trees w/ photos, for the validation pass. (The #215 version was disposable and has been removed.) |

`jspdf@4.2.1` and `html-to-image@1.11.13` are already dependencies — no new packages.

## 5. Tiling geometry (`export-tiling.ts`, Approach A)

Pure function, no DOM. Slices an already-produced canvas into printable pages.

- **Inputs:** `canvasW`, `canvasH` (device px), `pageSize`/`orientation` (default A4 landscape), `overlapPx` (interior-edge bleed for cut-and-tape alignment, default ~48px), `marginPx`.
- **Algorithm:** derive page pixel dims from the canvas DPI; `cols = ceil(canvasW / (pageContentW − overlap))`, `rows` likewise; emit `Tile[]` of `{ sx, sy, sw, sh, pageIndex, row, col }` source rects with overlap added on interior edges. Each tile maps 1:1 to a `jspdf` page: `ctx.drawImage(canvas, sx,sy,sw,sh, …)` onto **one reused sub-canvas** (bounded peak memory) → `addImage`.
- **Marks:** thin corner registration ticks + a faint `r{row}c{col}` page label in the footer margin so sheets can be ordered and trimmed.
- **Cover (minimal):** first page carries tree name + date + a one-line "page 1 of N · layout C×R" header. Not a designed cover.
- **Cap behaviour:** tiling slices the produced canvas, so it does **not** escape the canvas cap. Above the measured ceiling the warn dialog has already fired. (Escaping the cap = Approach B/server = explicit non-goal/follow-up.)

## 6. Ceiling validation (deferred #215 measurement)

The measurement the spike punted to this issue. Done in a **headed/real browser** — the spike's hard constraint, since headless Chromium collapses large family-chart trees (cards measured off hidden "fake" nodes via `getBoundingClientRect`).

- **Fixture:** recreate `scripts/seed-export-stress.ts` — deterministic trees at 25/50/100/150/200, **multi-root** topology (≥2 founding couples → exercises the #69 super-root path), plus one single-trunk variant as a #224-regression spot-check; ~70% with real photos in local Supabase Storage (genuine cross-origin URLs).
- **Instrumentation (dev-only):** per tree, log `measureNativeExtent`, `planExportRaster` (`boxW/boxH/pixelRatio/degraded`), produced canvas dims, blob bytes, wall-time.
- **Matrix:** desktop Chrome + Safari + Firefox (gating). Mobile Safari / Android Chrome as degrade-rule data (non-gating).
- **Output:** results table appended to this doc + a summary comment on #225, stating the people-count where `degraded` first flips true per browser (= the real ceiling) and whether ~200 stays legible. This decides whether a B/server follow-up is ever needed.
- **Disposable contract:** instrumentation is dev-only and removed before merge; the seed script may remain as a documented `scripts/` fixture.

## 7. Degrade & error handling

- **Degrade trigger:** `plan.degraded === true` **OR** `isMobileLike()` (coarse pointer + small viewport). Dialog copy: *"This tree is large — the full export may be reduced quality. Continue anyway, or open on a desktop browser for the best result."* → Continue (proceed) / Cancel (abort, nothing mutated).
- **Cancel mid-run:** existing `CaptureSignal.aborted` path preserved; checked before produce and before download. `restore()` always runs in `finally`.
- **Failure modes:** empty/oversized canvas → throw → caught in `useExportTrigger`, UI reset, no partial download. PDF-builder failure → same. Photo-decode failures already tolerated (`awaitPhotoDecode`).
- **Memory:** tiled path reuses a single sub-canvas across tiles (no N live canvases) to bound peak memory.

## 8. Testing

- **Unit (Vitest):** `export-tiling.ts` (grid math, interior-edge overlap, edge/degenerate 1×1 tiles); `planExportRaster` `degraded` flag (extend existing test); `export-pdf.ts` tiled page count + page dims (mock jsPDF); `isMobileLike` matcher.
- **Component:** `ExportTreeButton` dropdown (3 items dispatch the correct `format`); `ExportDegradeDialog` (Continue vs Cancel wiring); `useExportTrigger` preflight gate (degraded → dialog shown, capture deferred until Continue).
- **E2E (Playwright):** extend the happy-path export test — PNG still downloads; PDF single → 1-page file; tiled → N pages. Large-tree assertions run **headed** per the spike constraint.
- **Manual:** the §6 cross-browser validation pass (Chrome/Safari/Firefox).

## 9. Impact on the epic

- **#219** is a hard prerequisite — it lands the `capture-tree` produce/download split + base `export-pdf.ts` single-page builder + footer/watermark that #225 extends.
- **#60** "current-view vs full-tree" split: in practice #218 went straight to full-tree (there is no separate current-view mode in the UI), so #225 adds archival *output formats* + degrade handling rather than a new capture mode.
- **Possible follow-up:** server/headless full-layout export — filed only if §6 validation shows the client path cannot reach a readable ~200.
