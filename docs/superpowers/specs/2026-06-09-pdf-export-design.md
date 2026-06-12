# PDF export + footer/watermark — design

> Spec for GitHub issue **#219** (`feat: PDF export + footer/watermark (layers on PNG export)`).
> Milestone: **v1.2 — Export & archival** · Epic: **#60** · Depends on: PNG export (**#218**, shipped).
> Date: 2026-06-09.

## 1. Purpose

Add a **PDF** export option alongside the existing PNG export. PDF is the
**lossless, archival-quality** artifact (for printing / keeping); PNG remains the
**lightweight, shareable** artifact. The PDF reuses the shipped PNG raster
pipeline: capture the tree to an image, embed it losslessly in a single-page PDF
via `jspdf`, and stamp a trust/marketing footer.

Non-goals (per issue **Out of scope**): paginated/tiled full-tree PDF (pending the
full-tree spike), templates, server-side rendering.

## 2. What already exists (the seam was built for this in #217/#218)

- **Event contract** (`_lib/export-events.ts`) already carries
  `ExportFormat = 'png' | 'pdf'` and `treeName` — **no contract change needed**.
- **Filename** (`_lib/export-filename.ts`) already emits
  `<TreeName>-tree-YYYY-MM-DD.<ext>`; `.pdf` works for free. The `YYYY-MM-DD`
  (UTC) date helper is reused for the footer.
- **`_lib/capture-tree.ts`** produces a high-res PNG `Blob` (native-scale
  enlarge-container, `pixelRatio` from `planExportRaster`, Safari fixes:
  inline images, inline link strokes, 2-pass `toBlob`) and currently
  **downloads it directly**.
- **`_lib/useExportTrigger.ts`** owns the FamilyTree side: flips pending state,
  round-trips `mtf-export-pending`, runs capture inside `withOverflowVisible`,
  supports soft-cancel, always calls `restore()` in `finally` — **format-agnostic**.
- **`_components/ExportProgressDialog.tsx`** — modal + Cancel during capture.
- **`_components/ExportTreeButton.tsx`** — single icon that currently **hardcodes
  `format: 'png'`** (no chooser yet).
- **`jspdf@^4.2.1`** is already a dependency. No install needed. (Verify the
  jspdf v4 API surface via Context7 before coding — `addImage`, `text`,
  `output('blob')`, constructor options.)

## 3. Key insight: one format per export run

The user picks **PNG _or_ PDF** from the dropdown — a single export run never
needs both outputs. So sharing one capture between formats is **code
unification, not a one-capture-serves-both optimization**. This keeps the seam
clean and means the PNG and PDF paths can capture independently without cost
concerns.

## 4. Chosen approach (Approach 1 + 2 combined, PNG behind a flag)

- **PDF** always uses a new `toCanvas`-based capture (net-new; no legacy to
  protect): canvas → PNG data URL → `treeToPdf`.
- **PNG** also gets the `toCanvas` path (Approach 2), **gated behind a feature
  flag**:
  - flag **on** (default): PNG via `toCanvas` → `canvas.toBlob` → download.
  - flag **off**: PNG falls back to the **current, untouched** `toBlob` 2-pass
    path. This is the known-good pipeline and the easy-revert escape hatch if
    Approach 2 regresses PNG (most likely a Safari surprise).

Rejected alternatives:
- *Approach 1 only* (keep PNG on `toBlob`, PDF converts the blob → data URL) —
  works, but doesn't unify the capture code; superseded by the combined plan.
- *Separate `captureTreePdf`* (parallel re-raster) — duplicate logic, drift risk.

## 5. Module map

| File | Status | Responsibility |
|---|---|---|
| `_lib/rasterize-tree.ts` | **new** | `rasterizeTreeCanvas(target, opts) → HTMLCanvasElement`. Shared raster core: DOM prep (`inlineImages`, `inlineLinkStrokes`), 2-pass warm-up via `toCanvas` (discard first, use second), background resolve. Used by PDF always, and by PNG when the flag is on. |
| `_lib/capture-tree.ts` | **modified** | Orchestrates per `format`. PDF → `rasterizeTreeCanvas` → `canvas.toDataURL('image/png')` + `canvas.width/height` → `treeToPdf` → download. PNG → flag-on: `rasterizeTreeCanvas` → `canvasToBlob` → download; flag-off: existing `toBlob` 2-pass path **kept verbatim** → download. Existing `signal.aborted` checks + DOM-restore `finally` preserved for both. |
| `_lib/pdf-page-plan.ts` | **new** | Pure geometry (mirrors `export-raster-plan.ts`). Input: image px `width`/`height`. Output (mm): `{ pageFormat, orientation, imgX, imgY, imgW, imgH, footer: { x, y } }`. Unit-tested. |
| `_lib/tree-to-pdf.ts` | **new** | `async treeToPdf(dataUrl, dims, treeName, date) → Blob`. Dynamic-`import('jspdf')`, `planPdfPage(dims)`, `new jsPDF({ orientation, unit:'mm', format })`, `addImage(dataUrl,'PNG',…)` (lossless), footer `text(…)`, `return pdf.output('blob')`. |
| `_lib/export-config.ts` | **new** | `EXPORT_PNG_VIA_CANVAS` boolean, env-derived (see §8). |
| `_components/ExportTreeButton.tsx` | **modified** | `DropdownMenu` with "Download as PNG" / "Download as PDF"; each dispatches `dispatchExportTree({ format, treeName })`. Pending/spinner + disabled-while-exporting preserved. |

## 6. PDF page geometry (`pdf-page-plan.ts`)

Given the embedded image's pixel dimensions, jspdf works in **mm**:

- **Orientation:** landscape (`'l'`) if `imgW > imgH`, else portrait (`'p'`).
- **Page size:** **A4** by default; **A3** when the native long edge exceeds
  `PDF_A3_LONG_EDGE_PX` (start at **8000px** ≈ a large multi-generation tree),
  giving big trees more physical print area. Tunable constant, exported.
- **Margins + footer strip:** ~**10mm** margins all round, plus a reserved
  **~8mm bottom strip** for the footer so it never overlaps the image.
- **Scale-to-fit:** fit the image into the printable box
  (`pageW − 2·margin` × `pageH − 2·margin − footerStrip`) preserving aspect
  ratio; center horizontally; top-align under the top margin.
- **Footer baseline:** `{ x: margin (left-aligned), y: pageH − margin }`.

A4 = 210×297mm, A3 = 297×420mm (jspdf named formats; orientation swaps the axes).

## 7. Footer / watermark

- **How:** jspdf-drawn **real text** (`pdf.text(...)`), not baked into the image —
  the capture pipeline stays untouched and the text is crisp + selectable.
- **Where:** **bottom margin strip**, left-aligned, small muted size — reads as a
  tasteful colophon, not a defacing overlay.
- **Content:** `Generated from meetthefam · YYYY-MM-DD`, where the date uses the
  same UTC `YYYY-MM-DD` formatting as `export-filename.ts` (extract/share the
  helper rather than duplicating).

## 8. Feature flag (`export-config.ts`)

Mirrors the `src/lib/site-url.ts` env-derived-const pattern.

```ts
// EXPORT_PNG_VIA_CANVAS: routes PNG export through the unified toCanvas path
// (Approach 2). Set NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS="false" in Vercel to
// revert PNG to the legacy 2-pass toBlob pipeline if Approach 2 regresses
// (e.g. a Safari surprise). Default (unset) = true.
export const EXPORT_PNG_VIA_CANVAS =
  process.env.NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS !== 'false'
```

- **Default (unset):** `true` → PNG via canvas (Approach 2).
- **Revert:** set `NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS="false"` in Vercel.
- **Caveat:** because capture is client-side, the flag is `NEXT_PUBLIC_` and thus
  **inlined at build time** — flipping it requires a **redeploy** to take effect.
  The intended win still holds: **no code change**, just a Vercel env edit +
  redeploy.
- PDF is **not** gated by this flag (it has no legacy path).

## 9. Filename

Reuse `exportFilename(treeName, 'pdf')` → `<TreeName>-tree-YYYY-MM-DD.pdf`.
Already supported; no change.

## 10. Cancel / progress / restore

No changes. The `ExportProgressDialog`, soft-cancel, `signal.aborted` checks, and
`restore()`-in-`finally` are format-agnostic and already wrap the whole capture.
PDF assembly (lossless embed, no re-encode) is fast and runs inside the same
guarded block.

## 11. Testing

- **Unit — `pdf-page-plan.test.ts`** (mirrors `export-raster-plan.test.ts`):
  orientation flips on aspect ratio, A4↔A3 threshold boundary, scale-to-fit math
  (width-bound vs height-bound), footer reservation (image never overlaps the
  footer strip).
- **Unit — `ExportTreeButton`**: each dropdown item dispatches `mtf-export-tree`
  with the correct `format`; pending state still disables the trigger.
- **Regression:** existing `useExportTrigger` / `capture-tree` / `export-events` /
  `export-filename` tests stay green (legacy PNG path untouched; seam unchanged).
- **Manual (issue requirement):** print-test the PDF on a **photo tree** —
  including **Safari** — confirming lossless photo quality, footer placement, and
  correct A4/A3 + orientation selection. Also smoke-test the flag-off PNG path.

## 12. Out of scope

Paginated/tiled full-tree PDF (pending full-tree spike), templates, server-side
rendering. (Verbatim from the issue.)
