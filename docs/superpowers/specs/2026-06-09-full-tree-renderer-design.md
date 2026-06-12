# Full-tree (archival) export — design

> **Issue:** [#225](https://github.com/SanchitB23/meetthefam/issues/225) — `feat: dedicated full-layout renderer for full-tree (archival) export`
> **Epic:** [#60](https://github.com/SanchitB23/meetthefam/issues/60) · **Milestone:** v1.2 — Export & archival
> **Spun out of:** [#215](https://github.com/SanchitB23/meetthefam/issues/215) spike — verdict **A-now / B-later** (`docs/superpowers/specs/2026-06-06-full-tree-export-viability-design.md` §10)
> **Date:** 2026-06-09 · **Amended:** 2026-06-10 (post-#219 merge + model review + A4-only smart-PDF decision)
> **Depends on:** [#219](https://github.com/SanchitB23/meetthefam/issues/219) — **merged** to `feat/60-tree-export` (PR #233). Sequence: #218 (done) → #219 (done) → **#225**.

## 1. Background & reframe

The #215 spike called for a "dedicated full-layout renderer" on the assumption that #218 would ship only a cheap *current-view* capture and that full-tree export needed a separate offscreen/server renderer. **That framing is overtaken by events:**

- **#218 already ships native-scale full-layout capture.** Its enlarge-container approach resizes the chart container to the tree's native extent so family-chart re-fits at scale ≈1×, then captures the wrapper div (`svg.main_svg.parentElement`) holding both cards and connector lines. `planExportRaster` already degrades `pixelRatio` to stay within browser canvas caps (16384px side / area). Mechanically, **this _is_ the full-layout renderer the B-path asked for** — reusing the live chart rather than a separate offscreen one. See `export-raster-plan.ts`, `useExportTrigger.ts`, and `FamilyTree.tsx:180` (`prepareForCapture`).
- **#219 (merged) split produce-from-download and shipped PDF.** The shared raster core is `rasterize-tree.ts` (`toCanvas`-based, returns an `HTMLCanvasElement`); `capture-tree.ts` is now a thin dispatcher with format-specific consumers; `tree-to-pdf.ts` + `pdf-page-plan.ts` build a single-page scale-to-fit PDF with footer; `ExportTreeButton` is already a PNG/PDF dropdown. `EXPORT_PNG_VIA_CANVAS` (env flag) keeps a verbatim legacy PNG path as a rollback hatch.
- **The gating bugs are closed.** #224 (single-primary-root trees collapsing to ~2 nodes) is fixed; #216 (crossOrigin) and #217 (containerRef seam) are closed.

So #225 is **not** a rebuild. It is **validate-then-extend**: treat the shipped capture pipeline as the renderer, measure the real ceiling, and make the PDF a readable archival artefact. The spike's "live-chart scraping is fragile" worry is *believed* resolved by the enlarge-container approach, but **that belief has not been proven at 200 people — §6's validation is a genuine gate, not confirmatory cleanup**. If validation fails the bar, the fallback is a follow-up issue for an offscreen/server renderer, not ballooning #225.

## 2. Goal & success bar

**Goal:** ship readable full-tree archival export — PNG (unchanged) + **one smart A4 PDF** that renders as a single page when the tree fits readably, and as a **tiled multi-page A4 document** (print-and-assemble) when it doesn't — with an honest degrade path, and record the deferred canvas/memory ceiling measurement.

**Readability bar (pass/fail):** each card's name + relationship text is **legible at 100% zoom on a normal desktop monitor** when viewing the exported file (and equivalently, at native print size on paper). Operationally, because the enlarge-container path renders cards at their **native CSS size**, this maps to: *the output keeps cards at ≥ native size* — i.e. `planExportRaster` does **not** shrink the box below the native extent. (The returned `pixelRatio` is always ≥ 1 by construction — see §7 — so box-shrink is the sole failure signal.) The **ceiling** is the people-count at which box-shrink first kicks in; past it we degrade.

## 3. Scope & non-goals

**In scope**
- Pre-flight measurement gating the export run.
- Full-tree PNG (shipped — #218/#219; unchanged).
- **Smart A4 PDF (replaces the shipped `'pdf'` behaviour):** A4 is the **only** supported page format. If the tree fits the A4 content box at the declared DPI without downscaling (cards stay at native size), output a single A4 page; otherwise output a tiled multi-page A4 document (tiled = one A4 sheet per tile, assembled by the user). The A4→A3 step-up shipped in #219 is removed.
- Warn/degrade dialog (over-ceiling, measurement failure, or mobile).
- Real-browser ceiling validation (the deferred #215 measurement) + recorded results.

**Non-goals**
- **No A3, no poster/oversized single page** — A4 is the only paper format; readability beyond one A4 comes from tiling, not bigger pages. (An earlier draft of this spec had a `'pdf-poster'` format; dropped 2026-06-10.)
- **No new `ExportFormat` values** — the union stays `'png' | 'pdf'`; the single-vs-tiled decision is internal to the PDF builder. The dropdown stays 2 items.
- **No server/headless path** — deferred to a follow-up only if validation fails the bar.
- **No tile-by-tile re-render (Approach B)** — explicitly rejected (N re-renders, fragile pan/transform math, seam risk). Approach A's canvas-cap bound is accepted; above it the warn dialog fires.
- **No export on the read-only `/share` route** — `useExportTrigger` is gated behind `readOnly`; unchanged.
- **No family-chart internal changes.**

## 4. Architecture — the delta over #218/#219

#225 keeps the shipped pipeline (enlarge-container native-scale prepare → `rasterize-tree.ts` canvas core → format consumers) and adds:

1. **Pre-flight measurement** — run `measureNativeExtent` + `planExportRaster` *before* resizing/capturing, so we know up-front whether the tree clears the readability bar. Preflight reads `getBBox()` so it must run while the chart is idle (not mid-transition).
2. **The smart A4 PDF** — single page vs tiled multi-page, decided by the builder from one produced canvas.
3. **Warn/degrade dialog** — fired by the pre-flight when over-ceiling, when measurement fails, or on a mobile-like device.
4. **Documented real-browser ceiling validation** — recreate a stress-seed fixture and record the 100→200 curve.

### 4.1 Export run flow

Shipped (#219): click format → `prepareForCapture` → settle → `captureTree` dispatches by format. New flow inserts a decision gate and the smart-PDF branch:

```
click format (png | pdf)
  → preflight: measureNativeExtent + planExportRaster   (NO DOM resize yet; chart idle)
  → if plan.degraded OR measurement failed OR isMobileLike():
        show ExportDegradeDialog → [Continue] | [Cancel / open on desktop]
        (Cancel → abort run, nothing mutated)
  → prepareForCapture (resize container to box, fit chart at ≈1×)
  → settle (FIT_SETTLE_MS) → rasterizeTreeCanvas → CANVAS  (shared; Safari fixes live here)
  → branch by format:
        png → canvasToBlob → download                                  (shipped)
        pdf → smart A4 builder:
                fits A4 content box at DPI, no downscale → single A4 page
                else → export-tiling slices → multipage A4 jsPDF
  → restore() ALWAYS in finally
```

### 4.2 Module plan (names match the shipped #219 code)

| File | Status | Responsibility |
|---|---|---|
| `_lib/export-events.ts` | unchanged | `ExportFormat = 'png' \| 'pdf'` stays as-is. |
| `_lib/export-raster-plan.ts` | edit | Add `degraded: boolean` to `RasterPlan` — **true iff the box was shrunk below native extent** (returned `pixelRatio` is already clamped ≥ 1, so it is not a signal). Also: the measurement-failure fallbacks must surface as degraded (§7). Pure. |
| `_lib/rasterize-tree.ts` | shipped (#219) | Shared canvas core (Safari fixes, 2-pass `toCanvas`). Unchanged. |
| `_lib/capture-tree.ts` | edit (light) | PDF branch passes the canvas to the smart builder. Legacy flag-off PNG path untouched. |
| `_lib/tree-to-pdf.ts` | edit | Becomes the smart builder: single-A4 path (shipped, minus A3) or tiled path; shared footer. |
| `_lib/pdf-page-plan.ts` | edit | Remove the A4→A3 step-up (`PDF_A3_LONG_EDGE_PX`); add the declared-DPI constant + the single-vs-tiled decision (`fitsSingleA4`). |
| `_lib/export-tiling.ts` | **new** | Pure geometry: `(canvasW, canvasH, page, overlap, margin, dpi) → Tile[] + crop-mark coords`. No DOM. |
| `_lib/useExportTrigger.ts` | edit | Add preflight + warn-gate before `prepareForCapture`. (#219 did not touch this file — clean ownership.) |
| `_lib/isMobileLike.ts` | **new** | Coarse-pointer + small-viewport matcher for the degrade trigger. |
| `_components/ExportTreeButton.tsx` | edit (label only) | Dropdown stays 2 items; PDF label may clarify ("Download as PDF (print)"). |
| `_components/ExportDegradeDialog.tsx` | **new** | Warn + Continue / open-on-desktop. |
| `_components/FamilyTree.tsx` | edit | Wire preflight measurement + degrade-dialog state. (#219 did not touch this file.) |
| `scripts/seed-export-stress.ts` | **new — re-create** | Deterministic 25/50/100/150/200 trees w/ photos, for the validation pass. (The #215 version was disposable and removed.) |

`jspdf@4.2.1` and `html-to-image@1.11.13` are already dependencies — no new packages. If the smart-PDF path wants a rollback hatch, reuse the `export-config.ts` env-flag pattern from #219.

## 5. PDF geometry — single-vs-tiled rule + tiling

**Declared print DPI:** canvas pixels convert to mm at a declared **150 DPI** (`mm = px / 150 * 25.4`), following `pdf-page-plan.ts`'s mm convention. The DPI constant lives in `pdf-page-plan.ts`; it determines the single-page fit test, tile count, and overlap widths.

**Single-vs-tiled rule (`fitsSingleA4`):** single page iff the tree's native extent, converted at the DPI, fits the A4 content box (page minus margins minus footer strip) **without downscaling** — i.e. cards print at native size, consistent with the §2 bar. Expressed as a tunable constant `SINGLE_PAGE_MIN_SCALE = 1.0` (the minimum allowed scale-to-fit factor before tiling kicks in). **Consequence (accepted):** most trees beyond roughly a dozen people will tile — the PDF is the *print* artefact; the PNG remains the quick shareable overview. If real-world feedback wants more single-page tolerance, lower the constant (e.g. `0.75`) without touching geometry.

**Tiling (`export-tiling.ts`):** pure function, no DOM.
- **Inputs:** `canvasW`, `canvasH` (device px), A4 orientation (chosen to minimise page count), `overlapPx` (interior-edge bleed for cut-and-tape alignment, default ~48px), `marginPx`, `dpi` (150).
- **Algorithm:** page content mm → px at the DPI; `cols = ceil(canvasW / (pageContentW − overlap))`, `rows` likewise; emit `Tile[]` of `{ sx, sy, sw, sh, pageIndex, row, col }` source rects with overlap on interior edges. Each tile maps 1:1 to a `jspdf` A4 page: `ctx.drawImage(canvas, sx,sy,sw,sh, …)` onto **one reused sub-canvas** (bounded peak memory) → `addImage`.
- **Marks:** thin corner registration ticks + a faint `r{row}c{col}` label in the footer margin so sheets can be ordered and trimmed.
- **Cover (minimal):** first page carries tree name + date + a one-line "page 1 of N · layout C×R" header. Not a designed cover.
- **Cap behaviour:** tiling slices the produced canvas, so it does **not** escape the canvas cap. Above the measured ceiling the warn dialog has already fired. (Escaping the cap = Approach B/server = explicit non-goal/follow-up.)

## 6. Ceiling validation (deferred #215 measurement) — a gate, not a formality

The measurement the spike punted to this issue, and the proof the §1 "validate-then-extend" bet rests on. Done in a **headed/real browser** — the spike's hard constraint, since headless Chromium collapses large family-chart trees (cards measured off hidden "fake" nodes via `getBoundingClientRect`).

- **Fixture:** recreate `scripts/seed-export-stress.ts` — deterministic trees at 25/50/100/150/200, **multi-root** topology (≥2 founding couples → exercises the #69 super-root path), plus one single-trunk variant as a #224-regression spot-check; ~70% with real photos in local Supabase Storage (genuine cross-origin URLs).
- **Known measurement limitation to verify (from model review):** `measureNativeExtent` unions `getBBox()` over the **SVG's** `path/line/…/foreignObject` children — but person cards are HTML `div.card_cont` **siblings** of the SVG, so the measured extent reflects connector lines only and is **systematically smaller than the true card extent**. At small scale the 80px margin hides this; at 200 people it could under-size the box → cards render below native size → silently fails the bar. Validation must compare `measureNativeExtent` output against the true rendered card-extent (union of `card_cont` rects); if the gap is material, fix the measurement (union the card rects, transformed by zoom k) as part of #225.
- **Instrumentation (dev-only):** per tree, log `measureNativeExtent`, `planExportRaster` (`boxW/boxH/pixelRatio/degraded`), produced canvas dims, blob bytes, tiled page count, wall-time (capture wall-time includes the `cacheBust: true` double font/photo fetch — record it; if material at scale, revisit cacheBust).
- **Matrix:** desktop Chrome + Safari + Firefox (gating). Mobile Safari / Android Chrome as degrade-rule data (non-gating).
- **Output:** results table appended to this doc + a summary comment on #225, stating the people-count where `degraded` first flips true per browser (= the real ceiling) and whether ~200 stays legible. **If 200 fails the bar on a gating browser, file the offscreen/server follow-up under #60 and scope #225's ship to the measured ceiling.**
- **Disposable contract:** instrumentation is dev-only and removed before merge; the seed script may remain as a documented `scripts/` fixture.

## 7. Degrade & error handling

- **Degrade trigger (three cases):**
  1. `plan.degraded === true` — box shrunk below native extent (the only in-plan signal; returned `pixelRatio` is clamped ≥ 1 before return, so `pixelRatio < 1` never appears in a plan).
  2. **Measurement failure** — `measureNativeExtent` returns `null` (caller falls back to 2400×1600) or `planExportRaster`'s defensive 800×600 fallback. Today these are silent; #225 surfaces them as degraded so a tree whose measurement fails cannot silently export into an undersized box.
  3. `isMobileLike()` — coarse pointer + small viewport.
- **Dialog copy:** *"This tree is large — the full export may be reduced quality. Continue anyway, or open on a desktop browser for the best result."* → Continue (proceed) / Cancel (abort, nothing mutated).
- **Cancel mid-run:** existing `CaptureSignal.aborted` path preserved (including #219's re-check after `inlineImages` network fetches); checked before produce and before download. `restore()` always runs in `finally`.
- **Failure modes:** empty canvas → throw → caught in `useExportTrigger`, UI reset, no partial download. PDF-builder failure → same. Photo-decode failures already tolerated (`awaitPhotoDecode`).
- **Memory:** tiled path reuses a single sub-canvas across tiles (no N live canvases) to bound peak memory.

## 8. Testing

- **Unit (Vitest):** `export-tiling.ts` (grid math, interior-edge overlap, edge/degenerate 1×1 tiles, DPI conversion, orientation choice); `fitsSingleA4` decision incl. the `SINGLE_PAGE_MIN_SCALE` boundary; `planExportRaster` `degraded` flag incl. fallback cases (extend existing test); `pdf-page-plan.ts` A3-removal regression (extend existing test); smart builder in `tree-to-pdf.ts` — single-page vs N-page output (mock jsPDF, pattern exists from #219); `isMobileLike` matcher.
- **Component:** `ExportTreeButton` (2 items dispatch the correct `format` — extend existing test); `ExportDegradeDialog` (Continue vs Cancel wiring); `useExportTrigger` preflight gate (degraded → dialog shown, capture deferred until Continue).
- **E2E (Playwright):** extend the export test — PNG unchanged; small tree → 1-page A4 PDF; large tree → N-page tiled PDF. Large-tree assertions run **headed** per the spike constraint.
- **Manual:** the §6 cross-browser validation pass (Chrome/Safari/Firefox).

## 9. Impact on the epic

- **#219 — merged** (PR #233). It landed the produce/download split (`rasterize-tree.ts`), the scale-to-fit PDF (`tree-to-pdf.ts` + `pdf-page-plan.ts`), footer, dropdown, and the env-flag rollback pattern. #225 extends those files and **changes one shipped behaviour**: the A4→A3 step-up is removed (A4-only). The earlier file-collision concern is moot (#219 left `useExportTrigger.ts` / `FamilyTree.tsx` untouched).
- **#60** "current-view vs full-tree" split: in practice #218 went straight to full-tree (there is no separate current-view mode in the UI), so #225 makes the PDF the readable archival artefact rather than adding a new capture mode.
- **Possible follow-up:** server/headless full-layout export — filed only if §6 validation shows the client path cannot reach a readable ~200.

## 10. Ceiling validation results (2026-06-11)

Method: local stack + `pnpm seed:export-stress` + `pnpm dev`, driven in a **headed** real-Chrome 149 (clean profile, Playwright-driven; headless explicitly avoided per §6). Export triggered via the real `mtf-export-tree` event; preflight numbers read from the dev-gated `[export:preflight]` instrumentation; PDFs inspected for page count / page size / content.

### Chrome 149 (macOS, desktop) — gating row, DONE

| tree | cards rendered | nativeW×H (px) | boxW×H | pixelRatio | degraded | PDF pages (orient.) | PDF size | wall-time |
|---|---|---|---|---|---|---|---|---|
| Export Stress 25 | 26/26 | 3728×525 | 3727×524 | 3.00 | false | 3 (landscape) | 54 MB | 4.0 s |
| Export Stress 50 | 51/51 | 5318×790 | 5317×790 | 3.00 | false | 4 (landscape) | 116 MB | 4.4 s |
| Export Stress 60 single-trunk | 61/61 | 6203×920 | 6202×919 | 2.64 | false | 4 (landscape) | 122 MB | 5.1 s |
| Export Stress 100 | 101/101 | 9008×790 | 9008×789 | 1.81 | false | 6 (landscape) | 72 MB | 5.1 s |
| Export Stress 150 | 151/151 | 13174×920 | 13174×920 | 1.24 | false | 9 (landscape) | 57 MB | 6.2 s |
| Export Stress 200 | 201/201 | 13745×1310 | 13744×1309 | 1.19 | false | **13 (portrait)** | 80 MB | 8.4 s |

Additional Chrome checks, all PASS:

- **measureNativeExtent cross-check at 200 (Task 10 fix verified live):** manual card-rect union `13744.87×1310.00` vs preflight `13744.88×1310.00` — agreement within 0.005 px.
- **PNG regression:** 100 → 16300×1424 px, 4.3 s; 200 → 16335×1529 px, 12.6 s. Both download fine (canvas at the 16384 side cap, as planned).
- **Orientation optimizer:** 200 correctly picks portrait (13 pages) over landscape (18 pages).
- **Tile artefact quality (page 1 of 13 rendered + inspected):** names crisply legible at print scale, synthetic photos render (no canvas taint / blank cards), corner registration ticks present, footer label exact: `Export Stress 200 · 2026-06-10 · page 1 of 13 · r1c1 · layout 13×1`.
- **Mobile degrade gate (CDP touch + 390×844):** dialog fires even with a clean preflight; **Cancel leaves zero residue** (no download, no dialogs, no pending state).
- **#224 regression spot-check:** the 60-person single-trunk tree renders all 61 cards and exports fully.

### Chrome verdict

**The degrade gate never fired up to 200 people** — every fixture stayed at `pixelRatio ≥ 1` with no box-shrink, i.e. **200 people clears the §2 readability bar in Chrome with headroom**. Extrapolating this topology (~69 native px of width per person), `degraded` first flips when nativeW exceeds 16384 px ≈ **~235 people**. The smart PDF always tiled for these fixtures (every tree is wider than one A4 at 150 DPI), matching the §5 "accepted consequence".

Observations (non-blocking):

- **PDF sizes are large (54–122 MB)** — lossless PNG embeds at high pixelRatio; by design for the archival artefact (the PNG export is the lightweight option at 1.4–1.5 MB). If feedback wants smaller files, a JPEG-embed quality option is a clean follow-up.
- Wall-times 4–13 s — acceptable for a click-initiated archival export with a cancellable progress dialog.

### Safari / Firefox (gating) + real-device mobile — PENDING (human)

To complete the matrix: repeat the table rows in Safari + Firefox (log in as `export-stress@example.com`, devtools console open, Export → PDF per tree, record `[export:preflight]` + page count + legibility), plus a real-device mobile spot-check of the degrade dialog. Stack + seed remain running locally. Final verdict + the #225 summary comment post once these rows land.
