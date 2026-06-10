# Full-Tree Archival Export (#225) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tree PDF export a readable archival artefact — a smart A4 PDF that is a single page when the tree fits at print scale and a tiled multi-page document when it doesn't — gated by a preflight degrade check, plus the deferred real-browser ceiling validation.

**Architecture:** Validate-then-extend the shipped #218/#219 pipeline. The enlarge-container native-scale capture (`prepareForCapture` → `rasterizeTreeCanvas`) stays untouched as the single renderer. New: `planExportRaster` grows a `degraded` flag; a preflight step in `useExportTrigger` shows a warn dialog (degraded / measurement failure / mobile) before any DOM mutation; `tree-to-pdf.ts` becomes a smart builder branching on `fitsSingleA4` between the shipped single-page path (A4-only — the A3 step-up is removed) and a new tiled path that slices one produced canvas into A4 pages via pure geometry in `export-tiling.ts`.

**Tech Stack:** Next.js 16 / React client components, `html-to-image` (shipped raster core), `jspdf@4` (mm units, A4 only), Vitest (+ jsdom for component tests), tsx seed script against local Supabase.

**Spec:** `docs/superpowers/specs/2026-06-09-full-tree-renderer-design.md` (amended 2026-06-10). Read it first.

**Branch:** Work on the existing `feat/225-full-tree-renderer` (cut from `feat/60-tree-export`, the epic branch — PRs base there, not `qa`). The branch already carries the spec commits.

**Conventions that bind every task:** Conventional Commits with `(#225)` scope and the `Co-Authored-By: Claude <noreply@anthropic.com>` footer; stage files by name (never `git add -A`); ask the user before each `git commit` is **not** required for plan execution — the user has pre-approved commits for this plan's tasks, but **never push** until the final task; `pnpm typecheck && pnpm lint` must pass before each commit.

---

## File structure (locked decomposition)

| File | Status | One responsibility |
|---|---|---|
| `src/app/(app)/tree/[id]/_lib/export-raster-plan.ts` | modify | + `degraded` on `RasterPlan`; + card-aware `measureNativeExtent` |
| `src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts` | rewrite | A4-only single-page geometry; + `PDF_PRINT_DPI`, `pxToMm`, `fitsSingleA4`, exported `A4_MM` |
| `src/app/(app)/tree/[id]/_lib/export-tiling.ts` | create | Pure tile-grid geometry (no DOM, no jspdf) |
| `src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts` | rewrite | Smart builder: single A4 page ⟷ tiled multi-page; footer + registration ticks |
| `src/app/(app)/tree/[id]/_lib/capture-tree.ts` | modify | PDF branch passes the canvas (not a data URL) to the smart builder |
| `src/app/(app)/tree/[id]/_lib/isMobileLike.ts` | create | Coarse-pointer + small-viewport matcher |
| `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts` | modify | Preflight + degrade-confirm gate before capture |
| `src/app/(app)/tree/[id]/_components/ExportDegradeDialog.tsx` | create | Warn dialog: Continue / Cancel |
| `src/app/(app)/tree/[id]/_components/FamilyTree.tsx` | modify | Wire preflight, confirm-promise, dialog state |
| `src/app/(app)/tree/[id]/_components/ExportTreeButton.tsx` | modify | PDF item label → "Download as PDF (print)" |
| `scripts/export-stress/{tree-shape,synth-photo,seed-export-stress}.ts` | create (restore from spike branch) | Deterministic stress fixtures, multi-root |
| `package.json` | modify | Replace dangling `spike:*` scripts with `seed:export-stress` |
| Tests | modify/create | Mirrors of each `_lib` file under `src/__tests__/lib/`, components under `src/__tests__/components/` |

---

### Task 1: `degraded` flag on `RasterPlan`

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/export-raster-plan.ts` (interface `RasterPlan`, function `planExportRaster`)
- Test: `src/__tests__/lib/export-raster-plan.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing tests** — append to `src/__tests__/lib/export-raster-plan.test.ts`:

```ts
describe('planExportRaster — degraded flag (#225)', () => {
  it('is false when the box stays at native size and pixelRatio is untouched', () => {
    expect(planExportRaster({ nativeW: 800, nativeH: 600 }).degraded).toBe(false)
  })

  it('is false when only pixelRatio is reduced (box still native size)', () => {
    // 6000×1000 at PR 3 exceeds the side cap → PR drops, box stays native.
    const plan = planExportRaster({ nativeW: 6000, nativeH: 1000 })
    expect(plan.boxW).toBe(6000)
    expect(plan.degraded).toBe(false)
  })

  it('is true when the box must shrink below the native extent', () => {
    // 40000×30000 cannot fit even at pixelRatio 1 → box shrinks.
    const plan = planExportRaster({ nativeW: 40_000, nativeH: 30_000 })
    expect(plan.boxW).toBeLessThan(40_000)
    expect(plan.degraded).toBe(true)
  })

  it('is true for the defensive fallback (invalid native dimensions)', () => {
    expect(planExportRaster({ nativeW: 0, nativeH: 600 }).degraded).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/export-raster-plan.test.ts`
Expected: the 4 new tests FAIL (`degraded` is `undefined`); all pre-existing tests still pass.

- [ ] **Step 3: Implement** — in `export-raster-plan.ts`:

Add to the `RasterPlan` interface (after `pixelRatio`):

```ts
  /**
   * True when the export can no longer render cards at native size — the box
   * was shrunk below the native extent (or the inputs were invalid). The
   * preflight gate (#225) uses this to show the degrade warning. Note the
   * returned pixelRatio is always ≥ 1 by construction, so box-shrink is the
   * only in-plan degradation signal.
   */
  degraded: boolean
```

In `planExportRaster`: change the defensive-minimum return to
`return { boxW: 800, boxH: 600, pixelRatio: 1, degraded: true }`.
Add `let degraded = false` next to the `boxW/boxH/pixelRatio` lets. Inside the
step-4 block, where `if (scale < 1.0) { boxW = boxW * scale; boxH = boxH * scale }`,
add `degraded = true` inside that `if`. Include `degraded` in the final return object.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/lib/export-raster-plan.test.ts`
Expected: ALL pass (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/export-raster-plan.ts src/__tests__/lib/export-raster-plan.test.ts
git commit -m "feat(#225): degraded flag on RasterPlan — box-shrink + invalid-input signal"
```

---

### Task 2: A4-only page plan + `PDF_PRINT_DPI` + `fitsSingleA4`

**Files:**
- Rewrite: `src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts`
- Modify: `src/__tests__/lib/pdf-page-plan.test.ts`

This **removes shipped #219 behaviour** (the A4→A3 step-up) per spec §3 — deliberate, user-approved.

- [ ] **Step 1: Update the tests** — in `src/__tests__/lib/pdf-page-plan.test.ts`:

Replace the import block with:

```ts
import {
  planPdfPage,
  fitsSingleA4,
  pxToMm,
  PDF_PRINT_DPI,
  PDF_MARGIN_MM,
  PDF_FOOTER_STRIP_MM,
  SINGLE_PAGE_MIN_SCALE,
} from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'
```

Delete the entire `describe('planPdfPage — page size threshold', …)` block (A3 is gone).
In the `'width-bounds a very wide image'` test, replace the body (it relied on A3):

```ts
  it('width-bounds a very wide image to the A4 printable width (A4-only, no A3 step-up)', () => {
    // 10000×1000 → landscape. A4 landscape: pageW=297, availW = 297 - 2*10 = 277.
    const plan = planPdfPage({ width: 10_000, height: 1000 })
    expect(plan.orientation).toBe('l')
    expect(plan.pageFormat).toBe('a4')
    expect(plan.imgW).toBeCloseTo(277, 5)
    // height preserves aspect: 277 * (1000/10000) = 27.7.
    expect(plan.imgH).toBeCloseTo(27.7, 5)
    // centered horizontally: (297 - 277)/2 = 10.
    expect(plan.imgX).toBeCloseTo(10, 5)
    expect(plan.imgY).toBeCloseTo(PDF_MARGIN_MM, 5)
  })
```

Append new describe blocks:

```ts
describe('pxToMm (#225)', () => {
  it('converts px to mm at the declared print DPI', () => {
    // 150 px at 150 DPI = 1 inch = 25.4 mm.
    expect(pxToMm(PDF_PRINT_DPI)).toBeCloseTo(25.4, 5)
  })
})

describe('fitsSingleA4 (#225)', () => {
  // A4 landscape content box: availW = 277mm, availH = 210 - 20 - 8 = 182mm.
  // At 150 DPI: availW = 1635.8px, availH = 1074.8px.
  it('fits a small landscape tree (no downscale needed)', () => {
    expect(fitsSingleA4({ width: 1600, height: 1000 })).toBe(true)
  })

  it('rejects a tree wider than the A4 landscape content box', () => {
    expect(fitsSingleA4({ width: 1700, height: 1000 })).toBe(false)
  })

  // A4 portrait content box: availW = 190mm (1122px), availH = 269mm (1588.6px).
  it('fits a small portrait tree', () => {
    expect(fitsSingleA4({ width: 1000, height: 1500 })).toBe(true)
  })

  it('rejects a portrait tree taller than the content box', () => {
    expect(fitsSingleA4({ width: 1000, height: 1700 })).toBe(false)
  })

  it('SINGLE_PAGE_MIN_SCALE is the no-downscale bar', () => {
    expect(SINGLE_PAGE_MIN_SCALE).toBe(1.0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/pdf-page-plan.test.ts`
Expected: FAIL — `fitsSingleA4`/`pxToMm`/`SINGLE_PAGE_MIN_SCALE` not exported; the rewritten wide-image test fails (still picks `a3`).

- [ ] **Step 3: Rewrite `pdf-page-plan.ts`** — full new content:

```ts
// src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts
// Pure PDF page geometry (#219, A4-only since #225). Given the embedded
// image's pixel dimensions, decide orientation and scale-to-fit the image
// inside the A4 printable box, reserving a bottom strip for the footer.
// No DOM, no jspdf.
//
// #225 removed the A4→A3 step-up: A4 is the ONLY page format. Trees that
// don't fit a single A4 at print scale (see fitsSingleA4) are tiled across
// multiple A4 pages by tree-to-pdf.ts instead of stepping up paper sizes.
//
// jspdf works in mm here. A4 = 210x297 (portrait short x long).

/** Page margin on all sides (mm). */
export const PDF_MARGIN_MM = 10
/** Extra bottom space reserved for the footer line (mm). */
export const PDF_FOOTER_STRIP_MM = 8
/**
 * Declared print resolution. Canvas pixels convert to paper mm at this DPI
 * (mm = px / DPI * 25.4). Drives the single-vs-tiled decision and tile sizes.
 */
export const PDF_PRINT_DPI = 150
/**
 * Minimum allowed scale-to-fit factor before the smart PDF tiles instead of
 * fitting one page. 1.0 = cards never render below native size on paper
 * (the #225 readability bar). Lower (e.g. 0.75) to tolerate more single-page.
 */
export const SINGLE_PAGE_MIN_SCALE = 1.0

export const A4_MM = { short: 210, long: 297 } as const

export interface PdfImageDims {
  /** Embedded image width in NATIVE pixels (pre-pixelRatio scaling). */
  width: number
  /** Embedded image height in NATIVE pixels (pre-pixelRatio scaling). */
  height: number
}

export interface PdfPagePlan {
  pageFormat: 'a4'
  orientation: 'l' | 'p'
  /** Image placement (mm). */
  imgX: number
  imgY: number
  imgW: number
  imgH: number
  /** Footer text baseline (mm). */
  footer: { x: number; y: number }
}

/** Convert native pixels to paper mm at the declared print DPI. */
export function pxToMm(px: number, dpi: number = PDF_PRINT_DPI): number {
  return (px / dpi) * 25.4
}

/**
 * True when the tree's native extent fits the A4 content box at PDF_PRINT_DPI
 * without downscaling below SINGLE_PAGE_MIN_SCALE — i.e. a single page keeps
 * cards at ≥ native print size. Orientation follows the image aspect.
 */
export function fitsSingleA4(dims: PdfImageDims): boolean {
  const orientation: 'l' | 'p' = dims.width > dims.height ? 'l' : 'p'
  const pageW = orientation === 'l' ? A4_MM.long : A4_MM.short
  const pageH = orientation === 'l' ? A4_MM.short : A4_MM.long
  const availW = pageW - 2 * PDF_MARGIN_MM
  const availH = pageH - 2 * PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM
  const scale = Math.min(availW / pxToMm(dims.width), availH / pxToMm(dims.height))
  return scale >= SINGLE_PAGE_MIN_SCALE
}

export function planPdfPage(dims: PdfImageDims): PdfPagePlan {
  const orientation: 'l' | 'p' = dims.width > dims.height ? 'l' : 'p'

  const pageW = orientation === 'l' ? A4_MM.long : A4_MM.short
  const pageH = orientation === 'l' ? A4_MM.short : A4_MM.long

  const availW = pageW - 2 * PDF_MARGIN_MM
  const availH = pageH - 2 * PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM

  const imgAspect = dims.width / dims.height
  const availAspect = availW / availH

  let imgW: number
  let imgH: number
  if (availAspect > imgAspect) {
    // Box is relatively wider than the image → height-bound.
    imgH = availH
    imgW = availH * imgAspect
  } else {
    // Box is relatively taller than the image → width-bound.
    imgW = availW
    imgH = availW / imgAspect
  }

  const imgX = (pageW - imgW) / 2
  const imgY = PDF_MARGIN_MM
  const footer = { x: PDF_MARGIN_MM, y: pageH - PDF_MARGIN_MM }

  return { pageFormat: 'a4', orientation, imgX, imgY, imgW, imgH, footer }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/lib/pdf-page-plan.test.ts`
Expected: ALL pass. Also run `pnpm vitest run src/__tests__/lib/tree-to-pdf.test.ts` — still passes (it never referenced A3 dims > 8000px… it used 4000×2000 → A4; verify, fix the test's expectations only if it asserted `pageFormat` indirectly through `planPdfPage`, which it imports — re-running confirms).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/pdf-page-plan.ts src/__tests__/lib/pdf-page-plan.test.ts
git commit -m "feat(#225): A4-only page plan + print DPI + fitsSingleA4 (removes A3 step-up)"
```

---

### Task 3: Tile-grid geometry (`export-tiling.ts`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/export-tiling.ts`
- Create: `src/__tests__/lib/export-tiling.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/__tests__/lib/export-tiling.test.ts`:

```ts
// src/__tests__/lib/export-tiling.test.ts
// Pure tile-grid geometry for the tiled A4 PDF (#225). No DOM; node env fine.
import { describe, expect, it } from 'vitest'
import { planTiles, TILE_OVERLAP_PX } from '@/app/(app)/tree/[id]/_lib/export-tiling'
import {
  A4_MM,
  PDF_MARGIN_MM,
  PDF_FOOTER_STRIP_MM,
  PDF_PRINT_DPI,
} from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'

// Content box of one page in native px at the print DPI.
function contentPx(orientation: 'l' | 'p') {
  const pageW = orientation === 'l' ? A4_MM.long : A4_MM.short
  const pageH = orientation === 'l' ? A4_MM.short : A4_MM.long
  const w = ((pageW - 2 * PDF_MARGIN_MM) / 25.4) * PDF_PRINT_DPI
  const h = ((pageH - 2 * PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM) / 25.4) * PDF_PRINT_DPI
  return { w, h } // landscape ≈ { w: 1635.8, h: 1074.8 }
}

describe('planTiles — single tile', () => {
  it('returns a 1×1 grid when the tree fits one page (tie → landscape)', () => {
    const plan = planTiles({ nativeW: 1000, nativeH: 800, pixelRatio: 2 })
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(1)
    expect(plan.pageCount).toBe(1)
    expect(plan.orientation).toBe('l')
    // Source rect covers the whole canvas (canvas px = native × pixelRatio).
    expect(plan.tiles[0]).toMatchObject({ sx: 0, sy: 0, row: 0, col: 0, pageIndex: 0 })
    expect(plan.tiles[0].sw).toBeCloseTo(2000, 5)
    expect(plan.tiles[0].sh).toBeCloseTo(1600, 5)
  })
})

describe('planTiles — grid + orientation choice', () => {
  it('picks the orientation with fewer pages (wide tree → landscape 3×1)', () => {
    // Landscape: cols = ceil((4000-48)/(1635.8-48)) = 3, rows = 1 → 3 pages.
    // Portrait:  cols = ceil((4000-48)/(1122.0-48)) = 4, rows = 1 → 4 pages.
    const plan = planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: 1 })
    expect(plan.orientation).toBe('l')
    expect(plan.cols).toBe(3)
    expect(plan.rows).toBe(1)
    expect(plan.pageCount).toBe(3)
  })

  it('adjacent tiles overlap by TILE_OVERLAP_PX (in canvas px × pixelRatio)', () => {
    const pr = 2
    const plan = planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: pr })
    const [t0, t1] = plan.tiles
    // t1 starts overlap px (native) before t0 ends.
    expect(t0.sx + t0.sw - t1.sx).toBeCloseTo(TILE_OVERLAP_PX * pr, 3)
  })

  it('clamps the last tile to the canvas edge (partial tile)', () => {
    const { w } = contentPx('l')
    const plan = planTiles({ nativeW: 4000, nativeH: 900, pixelRatio: 1 })
    const last = plan.tiles[plan.tiles.length - 1]
    expect(last.sx + last.sw).toBeCloseTo(4000, 3)
    expect(last.sw).toBeLessThanOrEqual(w + 0.01)
  })

  it('emits row-major pageIndex over a 2-D grid', () => {
    // 4000×2400 → landscape: cols=3, rows = ceil((2400-48)/(1074.8-48)) = 3.
    const plan = planTiles({ nativeW: 4000, nativeH: 2400, pixelRatio: 1 })
    expect(plan.cols).toBe(3)
    expect(plan.rows).toBe(3)
    expect(plan.pageCount).toBe(9)
    expect(plan.tiles.map((t) => t.pageIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(plan.tiles[3]).toMatchObject({ row: 1, col: 0 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/export-tiling.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement** — `src/app/(app)/tree/[id]/_lib/export-tiling.ts`:

```ts
// src/app/(app)/tree/[id]/_lib/export-tiling.ts
// Pure tile-grid geometry for the tiled A4 PDF export (#225, Approach A:
// slice ONE produced canvas into page-sized tiles). No DOM, no jspdf —
// tree-to-pdf.ts consumes the plan to draw each tile onto an A4 page.
//
// Coordinate spaces: the grid is computed in NATIVE px (the tree at scale
// k=1, pre-pixelRatio); the emitted source rects are in CANVAS px (native ×
// pixelRatio) so callers can drawImage() from the captured canvas directly.
import {
  A4_MM,
  PDF_FOOTER_STRIP_MM,
  PDF_MARGIN_MM,
  PDF_PRINT_DPI,
} from './pdf-page-plan'

/**
 * Bleed shared by adjacent tiles (native px) so printed sheets can be
 * physically overlapped and taped without a content gap at the seam.
 */
export const TILE_OVERLAP_PX = 48

export interface TilePlanInput {
  /** Tree extent at scale k=1 (native px). */
  nativeW: number
  nativeH: number
  /** canvas px = native px × pixelRatio (from planExportRaster). */
  pixelRatio: number
  overlapPx?: number
  dpi?: number
}

export interface Tile {
  /** Source rect in CANVAS pixels — pass straight to ctx.drawImage. */
  sx: number
  sy: number
  sw: number
  sh: number
  row: number
  col: number
  pageIndex: number
}

export interface TilePlan {
  orientation: 'l' | 'p'
  cols: number
  rows: number
  pageCount: number
  /** Printable content box of each page (mm) — image placement target. */
  contentWmm: number
  contentHmm: number
  tiles: Tile[]
}

function mmToPx(mm: number, dpi: number): number {
  return (mm / 25.4) * dpi
}

function gridFor(
  nativeW: number,
  nativeH: number,
  contentWpx: number,
  contentHpx: number,
  overlap: number,
): { cols: number; rows: number } {
  const cols = nativeW <= contentWpx ? 1 : Math.ceil((nativeW - overlap) / (contentWpx - overlap))
  const rows = nativeH <= contentHpx ? 1 : Math.ceil((nativeH - overlap) / (contentHpx - overlap))
  return { cols, rows }
}

export function planTiles({
  nativeW,
  nativeH,
  pixelRatio,
  overlapPx = TILE_OVERLAP_PX,
  dpi = PDF_PRINT_DPI,
}: TilePlanInput): TilePlan {
  // Evaluate both orientations; fewest pages wins, tie → landscape.
  const candidates = (['l', 'p'] as const).map((orientation) => {
    const pageW = orientation === 'l' ? A4_MM.long : A4_MM.short
    const pageH = orientation === 'l' ? A4_MM.short : A4_MM.long
    const contentWmm = pageW - 2 * PDF_MARGIN_MM
    const contentHmm = pageH - 2 * PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM
    const contentWpx = mmToPx(contentWmm, dpi)
    const contentHpx = mmToPx(contentHmm, dpi)
    const { cols, rows } = gridFor(nativeW, nativeH, contentWpx, contentHpx, overlapPx)
    return { orientation, contentWmm, contentHmm, contentWpx, contentHpx, cols, rows }
  })
  const best = candidates.reduce((a, b) => (b.cols * b.rows < a.cols * a.rows ? b : a))

  const stepX = best.contentWpx - overlapPx
  const stepY = best.contentHpx - overlapPx
  const tiles: Tile[] = []
  for (let row = 0; row < best.rows; row++) {
    for (let col = 0; col < best.cols; col++) {
      const x = best.cols === 1 ? 0 : col * stepX
      const y = best.rows === 1 ? 0 : row * stepY
      const w = Math.min(best.contentWpx, nativeW - x)
      const h = Math.min(best.contentHpx, nativeH - y)
      tiles.push({
        sx: x * pixelRatio,
        sy: y * pixelRatio,
        sw: w * pixelRatio,
        sh: h * pixelRatio,
        row,
        col,
        pageIndex: tiles.length,
      })
    }
  }

  return {
    orientation: best.orientation,
    cols: best.cols,
    rows: best.rows,
    pageCount: tiles.length,
    contentWmm: best.contentWmm,
    contentHmm: best.contentHmm,
    tiles,
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/lib/export-tiling.test.ts`
Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/export-tiling.ts src/__tests__/lib/export-tiling.test.ts
git commit -m "feat(#225): pure A4 tile-grid geometry with overlap + orientation choice"
```

---

### Task 4: Smart PDF builder (`tree-to-pdf.ts`)

**Files:**
- Rewrite: `src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts`
- Rewrite: `src/__tests__/lib/tree-to-pdf.test.ts`

Signature change: `treeToPdf` now takes the **canvas** (the tiled path slices it; the single-page path derives its own data URL). The caller (Task 5) adapts.

- [ ] **Step 1: Rewrite the tests** — `src/__tests__/lib/tree-to-pdf.test.ts` full new content:

```ts
// src/__tests__/lib/tree-to-pdf.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock jspdf: capture constructor options + method calls. We use the REAL
// planPdfPage / planTiles so assertions verify integration.
const { jsPDFMock, doc } = vi.hoisted(() => {
  const doc = {
    addImage: vi.fn(),
    addPage: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    text: vi.fn(),
    output: vi.fn(() => new Blob(['%PDF'], { type: 'application/pdf' })),
  }
  return { jsPDFMock: vi.fn(function () { return doc }), doc }
})
vi.mock('jspdf', () => ({ jsPDF: jsPDFMock }))

import { treeToPdf } from '@/app/(app)/tree/[id]/_lib/tree-to-pdf'
import { planPdfPage, PDF_MARGIN_MM, pxToMm } from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'
import { planTiles } from '@/app/(app)/tree/[id]/_lib/export-tiling'

const DATA_URL = 'data:image/png;base64,AAAA'
const TILE_URL = 'data:image/png;base64,TILE'

/** Minimal stand-in for the captured canvas (jsdom has no real 2d canvas). */
function fakeTreeCanvas(width: number, height: number): HTMLCanvasElement {
  return { width, height, toDataURL: vi.fn(() => DATA_URL) } as unknown as HTMLCanvasElement
}

/** Stub document.createElement('canvas') for the tiled path's scratch canvas. */
function stubScratchCanvas() {
  const ctx = { clearRect: vi.fn(), drawImage: vi.fn() }
  const scratch = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => TILE_URL),
  }
  const real = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? (scratch as unknown as HTMLCanvasElement) : real(tag)) as
    typeof document.createElement)
  return { scratch, ctx }
}

function clearDoc() {
  jsPDFMock.mockClear()
  for (const fn of Object.values(doc)) (fn as ReturnType<typeof vi.fn>).mockClear()
}

describe('treeToPdf — single A4 page (tree fits at print scale)', () => {
  // 1600×1000 native fits A4 landscape (≤ 1635.8×1074.8 px at 150 DPI).
  const NATIVE = { width: 1600, height: 1000 }

  beforeEach(clearDoc)
  afterEach(() => vi.restoreAllMocks())

  it('constructs jsPDF with the planned orientation, mm, a4', async () => {
    const plan = planPdfPage(NATIVE)
    await treeToPdf(fakeTreeCanvas(3200, 2000), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    expect(jsPDFMock).toHaveBeenCalledWith({ orientation: plan.orientation, unit: 'mm', format: 'a4' })
    expect(doc.addPage).not.toHaveBeenCalled()
  })

  it('adds the full-canvas PNG at the planned coordinates', async () => {
    const plan = planPdfPage(NATIVE)
    const canvas = fakeTreeCanvas(3200, 2000)
    await treeToPdf(canvas, NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect(doc.addImage).toHaveBeenCalledWith(DATA_URL, 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH)
  })

  it('draws the footer with the UTC date at the planned baseline', async () => {
    const plan = planPdfPage(NATIVE)
    await treeToPdf(fakeTreeCanvas(3200, 2000), NATIVE, 'Smith Family', new Date('2026-06-10T23:30:00Z'))
    expect(doc.text).toHaveBeenCalledWith(
      'Generated from meetthefam · 2026-06-10', plan.footer.x, plan.footer.y,
    )
  })
})

describe('treeToPdf — tiled multi-page (tree exceeds single A4)', () => {
  // 4000×900 native at pixelRatio 2 → landscape 3×1 grid (see export-tiling tests).
  const NATIVE = { width: 4000, height: 900 }
  const PR = 2

  beforeEach(clearDoc)
  afterEach(() => vi.restoreAllMocks())

  it('creates one A4 page per tile in the planned orientation', async () => {
    const { ctx } = stubScratchCanvas()
    const plan = planTiles({ nativeW: NATIVE.width, nativeH: NATIVE.height, pixelRatio: PR })
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    expect(jsPDFMock).toHaveBeenCalledWith({ orientation: plan.orientation, unit: 'mm', format: 'a4' })
    expect(doc.addPage).toHaveBeenCalledTimes(plan.pageCount - 1) // 2
    expect(doc.addImage).toHaveBeenCalledTimes(plan.pageCount) // 3, one per tile
    expect(ctx.drawImage).toHaveBeenCalledTimes(plan.pageCount)
  })

  it('draws each tile slice from the canvas at the tile source rect', async () => {
    const { ctx } = stubScratchCanvas()
    const plan = planTiles({ nativeW: NATIVE.width, nativeH: NATIVE.height, pixelRatio: PR })
    const canvas = fakeTreeCanvas(8000, 1800)
    await treeToPdf(canvas, NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    const t0 = plan.tiles[0]
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, canvas, t0.sx, t0.sy, t0.sw, t0.sh, 0, 0, t0.sw, t0.sh)
  })

  it('places every tile image at the page margin, sized in mm at print DPI', async () => {
    stubScratchCanvas()
    const plan = planTiles({ nativeW: NATIVE.width, nativeH: NATIVE.height, pixelRatio: PR })
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    const t0 = plan.tiles[0]
    expect(doc.addImage).toHaveBeenNthCalledWith(
      1, TILE_URL, 'PNG', PDF_MARGIN_MM, PDF_MARGIN_MM,
      pxToMm(t0.sw / PR), pxToMm(t0.sh / PR),
    )
  })

  it('labels every page with name · date · page i of N · r/c · layout', async () => {
    stubScratchCanvas()
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    const labels = doc.text.mock.calls.map((c) => c[0] as string)
    expect(labels[0]).toBe('Smith Family · 2026-06-10 · page 1 of 3 · r1c1 · layout 3×1')
    expect(labels[2]).toBe('Smith Family · 2026-06-10 · page 3 of 3 · r1c3 · layout 3×1')
  })

  it('draws registration ticks on every page', async () => {
    stubScratchCanvas()
    await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'Smith Family', new Date('2026-06-10T00:00:00Z'))
    // 8 tick lines per page × 3 pages.
    expect(doc.line).toHaveBeenCalledTimes(24)
  })

  it('returns the pdf blob from output("blob")', async () => {
    stubScratchCanvas()
    const blob = await treeToPdf(fakeTreeCanvas(8000, 1800), NATIVE, 'X')
    expect(doc.output).toHaveBeenCalledWith('blob')
    expect(blob).toBeInstanceOf(Blob)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/tree-to-pdf.test.ts`
Expected: FAIL — `treeToPdf` still has the `(pngDataUrl, dims, …)` signature; tiled path absent.

- [ ] **Step 3: Rewrite `tree-to-pdf.ts`** — full new content:

```ts
// src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts
// Smart A4 PDF builder (#219 single-page; #225 smart single-vs-tiled).
// Dynamic-imports jspdf (code-split: only loaded when the user picks PDF).
//
// Branching (#225, spec §5): when the tree's native extent fits the A4
// content box at PDF_PRINT_DPI without downscaling (fitsSingleA4), emit the
// shipped single scale-to-fit page. Otherwise emit a tiled multi-page A4
// document — one A4 sheet per tile of the captured canvas, with overlap
// bleed, corner registration ticks, and an assembly label on every page —
// for print-and-assemble archival output.
import { isoDate } from './export-filename'
import {
  A4_MM,
  PDF_MARGIN_MM,
  fitsSingleA4,
  planPdfPage,
  pxToMm,
  type PdfImageDims,
} from './pdf-page-plan'
import { planTiles, type TilePlan } from './export-tiling'

/** Footer font size (pt) and muted grey RGB. */
const FOOTER_FONT_PT = 9
const FOOTER_RGB: [number, number, number] = [120, 120, 120]
/** Length of the corner registration ticks (mm). */
const TICK_MM = 4

type JsPdfDoc = InstanceType<(typeof import('jspdf'))['jsPDF']>

export async function treeToPdf(
  canvas: HTMLCanvasElement,
  native: PdfImageDims,
  treeName: string,
  date: Date = new Date(),
): Promise<Blob> {
  return fitsSingleA4(native)
    ? singlePagePdf(canvas, native, date)
    : tiledPdf(canvas, native, treeName, date)
}

/** Shipped #219 path: one A4 page, image scale-to-fit, footer. */
async function singlePagePdf(
  canvas: HTMLCanvasElement,
  native: PdfImageDims,
  date: Date,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const plan = planPdfPage(native)

  const doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: 'a4' })
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH)

  doc.setFontSize(FOOTER_FONT_PT)
  doc.setTextColor(...FOOTER_RGB)
  doc.text(`Generated from meetthefam · ${isoDate(date)}`, plan.footer.x, plan.footer.y)

  return doc.output('blob')
}

/** #225 tiled path: one A4 page per tile of the captured canvas. */
async function tiledPdf(
  canvas: HTMLCanvasElement,
  native: PdfImageDims,
  treeName: string,
  date: Date,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pixelRatio = canvas.width / native.width
  const plan = planTiles({ nativeW: native.width, nativeH: native.height, pixelRatio })

  const doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: 'a4' })
  const pageH = plan.orientation === 'l' ? A4_MM.short : A4_MM.long

  // ONE reused scratch canvas across tiles bounds peak memory (spec §7).
  const scratch = document.createElement('canvas')

  for (const tile of plan.tiles) {
    if (tile.pageIndex > 0) doc.addPage('a4', plan.orientation)

    scratch.width = Math.ceil(tile.sw)
    scratch.height = Math.ceil(tile.sh)
    const ctx = scratch.getContext('2d')
    if (!ctx) throw new Error('Tree export failed: no 2d context for tile slicing')
    ctx.clearRect(0, 0, scratch.width, scratch.height)
    ctx.drawImage(canvas, tile.sx, tile.sy, tile.sw, tile.sh, 0, 0, tile.sw, tile.sh)

    doc.addImage(
      scratch.toDataURL('image/png'),
      'PNG',
      PDF_MARGIN_MM,
      PDF_MARGIN_MM,
      pxToMm(tile.sw / pixelRatio),
      pxToMm(tile.sh / pixelRatio),
    )

    drawRegistrationTicks(doc, plan)

    doc.setFontSize(FOOTER_FONT_PT)
    doc.setTextColor(...FOOTER_RGB)
    const label =
      `${treeName} · ${isoDate(date)} · page ${tile.pageIndex + 1} of ${plan.pageCount}` +
      ` · r${tile.row + 1}c${tile.col + 1} · layout ${plan.cols}×${plan.rows}`
    doc.text(label, PDF_MARGIN_MM, pageH - PDF_MARGIN_MM)
  }

  return doc.output('blob')
}

/** Thin corner L-ticks at the content-box corners — trim/registration guides. */
function drawRegistrationTicks(doc: JsPdfDoc, plan: TilePlan): void {
  const x0 = PDF_MARGIN_MM
  const y0 = PDF_MARGIN_MM
  const x1 = PDF_MARGIN_MM + plan.contentWmm
  const y1 = PDF_MARGIN_MM + plan.contentHmm
  doc.setDrawColor(150)
  doc.line(x0, y0, x0 + TICK_MM, y0)
  doc.line(x0, y0, x0, y0 + TICK_MM)
  doc.line(x1, y0, x1 - TICK_MM, y0)
  doc.line(x1, y0, x1, y0 + TICK_MM)
  doc.line(x0, y1, x0 + TICK_MM, y1)
  doc.line(x0, y1, x0, y1 - TICK_MM)
  doc.line(x1, y1, x1 - TICK_MM, y1)
  doc.line(x1, y1, x1, y1 - TICK_MM)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/lib/tree-to-pdf.test.ts`
Expected: ALL pass. `pnpm typecheck` will FAIL right now (capture-tree.ts still calls the old signature) — that's Task 5; do **not** commit yet if typecheck fails… instead proceed to Task 5 and commit both together **only if** needed. Preferred: keep commits separate by making Task 5 immediately.

- [ ] **Step 5: Hold the commit** — Task 4 + Task 5 commit together (the signature change spans producer + consumer; committing half would break `pnpm typecheck`).

---

### Task 5: capture-tree PDF branch passes the canvas

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/capture-tree.ts` (function `captureTreePdf` only)
- Modify: `src/__tests__/lib/capture-tree-canvas.test.ts` (PDF describe block)

- [ ] **Step 1: Update the PDF test** — in `src/__tests__/lib/capture-tree-canvas.test.ts`, replace the first test inside `describe('captureTree — PDF path', …)` with:

```ts
  it('rasterises, hands the canvas + native dims to treeToPdf, downloads .pdf', async () => {
    vi.setSystemTime(new Date('2026-06-09T10:00:00Z'))
    const container = buildContainer() // build before mocking createElement
    const anchor = document.createElement('a')
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tag: string) => (tag === 'a' ? anchor : document.body)) as typeof document.createElement,
    )
    await captureTree(container, 'pdf', 'Smith Family', undefined, 2.5)
    expect(rasterizeTreeCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), 2.5, undefined)
    // #225: the smart builder receives the CANVAS (the tiled path slices it);
    // native dims = canvas px / pixelRatio. 1234/2.5=493.6, 567/2.5=226.8.
    expect(treeToPdf).toHaveBeenCalledWith(
      fakeCanvas,
      { width: 1234 / 2.5, height: 567 / 2.5 },
      'Smith Family',
    )
    expect(fakeCanvas.toDataURL).not.toHaveBeenCalled() // builder derives its own
    expect(canvasToBlob).not.toHaveBeenCalled()
    expect(anchor.download).toBe('Smith Family-tree-2026-06-09.pdf')
    expect(clickSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/capture-tree-canvas.test.ts`
Expected: the updated PDF test FAILS (capture-tree still passes a data URL).

- [ ] **Step 3: Implement** — in `capture-tree.ts`, replace the body of `captureTreePdf` with:

```ts
async function captureTreePdf(
  container: HTMLElement,
  treeName: string,
  signal: CaptureSignal | undefined,
  pixelRatio: number,
): Promise<void> {
  const canvas = await rasterizeTreeCanvas(container, pixelRatio, signal)
  if (!canvas || signal?.aborted) return
  // canvas.width/height are pixelRatio-scaled; the smart builder keys both the
  // single-vs-tiled decision and print sizing on the tree's NATIVE extent
  // (spec §5), so divide back down. The builder receives the canvas itself —
  // the tiled path slices it; the single-page path derives its own data URL.
  const native = { width: canvas.width / pixelRatio, height: canvas.height / pixelRatio }
  const blob = await treeToPdf(canvas, native, treeName)
  if (signal?.aborted) return
  triggerDownload(blob, exportFilename(treeName, 'pdf'))
}
```

- [ ] **Step 4: Verify everything**

Run: `pnpm vitest run src/__tests__/lib/capture-tree-canvas.test.ts src/__tests__/lib/tree-to-pdf.test.ts && pnpm typecheck`
Expected: ALL pass, typecheck clean.

- [ ] **Step 5: Commit (Tasks 4+5 together — one logical signature change)**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/tree-to-pdf.ts src/__tests__/lib/tree-to-pdf.test.ts \
        src/app/\(app\)/tree/\[id\]/_lib/capture-tree.ts src/__tests__/lib/capture-tree-canvas.test.ts
git commit -m "feat(#225): smart A4 PDF — single page when it fits at print scale, else tiled multi-page"
```

---

### Task 6: `isMobileLike`

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/isMobileLike.ts`
- Create: `src/__tests__/lib/isMobileLike.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/__tests__/lib/isMobileLike.test.ts`:

```ts
// src/__tests__/lib/isMobileLike.test.ts
/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isMobileLike } from '@/app/(app)/tree/[id]/_lib/isMobileLike'

function stubEnv(coarse: boolean, w: number, h: number) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: coarse })))
  vi.stubGlobal('innerWidth', w)
  vi.stubGlobal('innerHeight', h)
}

describe('isMobileLike', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('true for coarse pointer + small viewport (phone)', () => {
    stubEnv(true, 390, 844)
    expect(isMobileLike()).toBe(true)
  })

  it('false for fine pointer even on a small window (resized desktop)', () => {
    stubEnv(false, 390, 844)
    expect(isMobileLike()).toBe(false)
  })

  it('false for coarse pointer on a large viewport (tablet landscape ≥ 768)', () => {
    stubEnv(true, 1180, 820)
    expect(isMobileLike()).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/isMobileLike.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement** — `src/app/(app)/tree/[id]/_lib/isMobileLike.ts`:

```ts
// src/app/(app)/tree/[id]/_lib/isMobileLike.ts
// Degrade-rule device check (#225, spec §7 case 3): full-tree archival export
// is heavy (enlarge-container re-layout + big canvas); on phone-class devices
// we warn first. Coarse pointer alone isn't enough (touch laptops, tablets
// with desktop-class memory) — require a small viewport too.
export function isMobileLike(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const small = Math.min(window.innerWidth, window.innerHeight) < 768
  return coarse && small
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/lib/isMobileLike.test.ts`
Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/isMobileLike.ts src/__tests__/lib/isMobileLike.test.ts
git commit -m "feat(#225): isMobileLike — coarse-pointer + small-viewport degrade check"
```

---

### Task 7: Preflight + degrade gate in `useExportTrigger`

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts`
- Modify: `src/__tests__/lib/useExportTrigger.test.ts` (append a describe block + one mock)

- [ ] **Step 1: Write the failing tests** — in `src/__tests__/lib/useExportTrigger.test.ts`, add below the existing `capture-tree` mock:

```ts
vi.mock('@/app/(app)/tree/[id]/_lib/isMobileLike', () => ({
  isMobileLike: vi.fn(() => false),
}))
```

and import it for per-test control: `import { isMobileLike } from '@/app/(app)/tree/[id]/_lib/isMobileLike'` then `const isMobileLikeMock = vi.mocked(isMobileLike)`. Append:

```ts
describe('useExportTrigger — preflight degrade gate (#225)', () => {
  beforeEach(() => {
    captureTreeMock.mockClear()
    isMobileLikeMock.mockReturnValue(false)
  })

  it('skips the gate and captures when preflight is clean and not mobile', async () => {
    const { ref } = makeContainer()
    const confirmDegrade = vi.fn(async () => true)
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: false }),
        confirmDegrade,
      }),
    )
    dispatchExportTree({ format: 'pdf', treeName: 'Smith Family' })
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled())
    expect(confirmDegrade).not.toHaveBeenCalled()
    unmount()
  })

  it('asks for confirmation when preflight reports degraded; declining aborts with no pending events', async () => {
    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))
    const confirmDegrade = vi.fn(async () => false)
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true }),
        confirmDegrade,
      }),
    )
    dispatchExportTree({ format: 'pdf', treeName: 'Smith Family' })
    await waitFor(() => expect(confirmDegrade).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(captureTreeMock).not.toHaveBeenCalled()
    expect(pending).toEqual([]) // gate runs BEFORE pending — no dialog flash
    unmount()
    off()
  })

  it('proceeds with capture when the user confirms a degraded export', async () => {
    const { ref } = makeContainer()
    const confirmDegrade = vi.fn(async () => true)
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true }),
        confirmDegrade,
      }),
    )
    dispatchExportTree({ format: 'pdf', treeName: 'Smith Family' })
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled())
    expect(confirmDegrade).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('gates on mobile even when preflight is clean', async () => {
    isMobileLikeMock.mockReturnValue(true)
    const { ref } = makeContainer()
    const confirmDegrade = vi.fn(async () => false)
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: false }),
        confirmDegrade,
      }),
    )
    dispatchExportTree({ format: 'pdf', treeName: 'Smith Family' })
    await waitFor(() => expect(confirmDegrade).toHaveBeenCalled())
    expect(captureTreeMock).not.toHaveBeenCalled()
    unmount()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts`
Expected: new tests FAIL (`preflight`/`confirmDegrade` not in `Options`); existing tests pass.

- [ ] **Step 3: Implement** — in `useExportTrigger.ts`:

Add import: `import { isMobileLike } from './isMobileLike'`.
Add the exported type next to `CapturePreparation`:

```ts
/** Result of the #225 preflight measurement (no DOM mutation). */
export type ExportPreflight = {
  /** True when the export cannot keep cards at native size (or measuring failed). */
  degraded: boolean
}
```

Extend `Options`:

```ts
  /**
   * #225 preflight: measure + plan WITHOUT resizing the container. Runs before
   * any pending state so the degrade dialog isn't stacked behind the progress
   * dialog. When it reports degraded — or the device is mobile-like — the
   * export pauses on `confirmDegrade`.
   */
  preflight?: () => ExportPreflight
  /** Ask the user to confirm a degraded/mobile export. Resolve false to abort. */
  confirmDegrade?: () => Promise<boolean>
```

Destructure them in the hook signature, and at the very top of the `onExportTree`
handler (right after the `if (!el) return` guard, BEFORE `setExporting(true)`):

```ts
      // #225 degrade gate — before pending/exporting so the warn dialog is
      // the only thing on screen and a decline leaves no UI residue.
      if (preflight && confirmDegrade) {
        const flight = preflight()
        if (flight.degraded || isMobileLike()) {
          const proceed = await confirmDegrade()
          if (!proceed) return
        }
      }
```

Extend the existing exhaustive-deps comment to mention `preflight`/`confirmDegrade`
(same stable-identity rationale as `prepareForCapture`).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts && pnpm typecheck`
Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/useExportTrigger.ts src/__tests__/lib/useExportTrigger.test.ts
git commit -m "feat(#225): preflight degrade gate in useExportTrigger (degraded/mobile → confirm)"
```

---

### Task 8: `ExportDegradeDialog`

**Files:**
- Create: `src/app/(app)/tree/[id]/_components/ExportDegradeDialog.tsx`
- Create: `src/__tests__/components/ExportDegradeDialog.test.tsx`

- [ ] **Step 1: Write the failing test** — `src/__tests__/components/ExportDegradeDialog.test.tsx` (follow the existing `ExportProgressDialog.test.tsx` rendering pattern — read it first; if it mocks `@/components/ui/dialog`, mirror that mock here, otherwise render directly as below):

```ts
/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExportDegradeDialog } from '@/app/(app)/tree/[id]/_components/ExportDegradeDialog'

describe('ExportDegradeDialog', () => {
  it('renders nothing when closed', () => {
    render(<ExportDegradeDialog open={false} onContinue={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText(/large tree export/i)).toBeNull()
  })

  it('fires onContinue from the Continue button', async () => {
    const onContinue = vi.fn()
    render(<ExportDegradeDialog open onContinue={onContinue} onCancel={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel from the Cancel button', async () => {
    const onCancel = vi.fn()
    render(<ExportDegradeDialog open onContinue={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/components/ExportDegradeDialog.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement** — `src/app/(app)/tree/[id]/_components/ExportDegradeDialog.tsx`:

```tsx
'use client'
// Degrade-warning dialog for full-tree export (#225, spec §7). Shown by the
// preflight gate when the tree exceeds the canvas ceiling, measurement failed,
// or the device is mobile-like. Continue proceeds with a best-effort export;
// Cancel aborts with nothing mutated. Escape / overlay-click count as Cancel.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onContinue: () => void
  onCancel: () => void
}

export function ExportDegradeDialog({ open, onContinue, onCancel }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Large tree export</DialogTitle>
          <DialogDescription>
            This tree is large — the full export may be reduced quality. Continue
            anyway, or open on a desktop browser for the best result.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onContinue}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/components/ExportDegradeDialog.test.tsx`
Expected: ALL pass. (If the real Base UI Dialog doesn't render in jsdom, mirror the dialog mock used by `ExportProgressDialog.test.tsx` / `ExportTreeButton.test.tsx` — mock `@/components/ui/dialog` with pass-through divs gated on the `open` prop.)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/ExportDegradeDialog.tsx src/__tests__/components/ExportDegradeDialog.test.tsx
git commit -m "feat(#225): ExportDegradeDialog — continue/cancel warn before degraded export"
```

---

### Task 9: Wire preflight + dialog into `FamilyTree`; PDF item label

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/FamilyTree.tsx`
- Modify: `src/app/(app)/tree/[id]/_components/ExportTreeButton.tsx` (one label)

No new unit test — orchestration is covered by Task 7's hook tests and Task 8's component tests; the wiring is verified by typecheck + the Task 12 manual pass. (The existing `ExportTreeButton.test.tsx` regex `/download as pdf/i` still matches the new label — confirm by running it.)

- [ ] **Step 1: Wire FamilyTree** — in `FamilyTree.tsx`:

Add imports (extend the existing import lines):

```ts
import { ExportDegradeDialog } from './ExportDegradeDialog'
import { useExportTrigger, type CapturePreparation, type ExportPreflight } from '../_lib/useExportTrigger'
```

(`measureNativeExtent`/`planExportRaster` are already imported; `useState`/`useRef`/`useCallback` already imported.)

Below the existing `prepareForCapture` callback (around line 218), add:

```ts
  // #225 preflight: measure + plan WITHOUT touching the DOM. Measurement
  // failure counts as degraded (spec §7 case 2) — a tree we can't measure
  // must not silently export into an undersized box.
  const [degradeOpen, setDegradeOpen] = useState(false)
  const degradeResolverRef = useRef<((ok: boolean) => void) | null>(null)

  const preflight = useCallback((): ExportPreflight => {
    const cont = containerRef.current
    const nativeExtent = cont ? measureNativeExtent(cont) : null
    if (!nativeExtent) return { degraded: true }
    const plan = planExportRaster(nativeExtent)
    if (process.env.NODE_ENV === 'development') {
      // #225 §6 ceiling-validation instrumentation (dev-only by design).
      console.info('[export:preflight]', { ...nativeExtent, ...plan })
    }
    return { degraded: plan.degraded }
  }, [containerRef])

  const confirmDegrade = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        degradeResolverRef.current = resolve
        setDegradeOpen(true)
      }),
    [],
  )

  const resolveDegrade = useCallback((ok: boolean) => {
    setDegradeOpen(false)
    degradeResolverRef.current?.(ok)
    degradeResolverRef.current = null
  }, [])
```

Extend the `useExportTrigger` call (line ~222):

```ts
  const { exporting, cancel: cancelExport } = useExportTrigger(containerRef, {
    readOnly,
    prepareForCapture,
    preflight,
    confirmDegrade,
  })
```

Next to the existing `<ExportProgressDialog …/>` render (line ~580), add:

```tsx
      {!readOnly && (
        <ExportDegradeDialog
          open={degradeOpen}
          onContinue={() => resolveDegrade(true)}
          onCancel={() => resolveDegrade(false)}
        />
      )}
```

- [ ] **Step 2: PDF item label** — in `ExportTreeButton.tsx`, change the second menu item text from `Download as PDF` to `Download as PDF (print)`.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/__tests__/components/ExportTreeButton.test.tsx`
Expected: all clean (the `/download as pdf/i` regex still matches).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/FamilyTree.tsx src/app/\(app\)/tree/\[id\]/_components/ExportTreeButton.tsx
git commit -m "feat(#225): wire preflight + degrade dialog into FamilyTree; PDF item label"
```

---

### Task 10: Card-aware `measureNativeExtent`

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/export-raster-plan.ts` (function `measureNativeExtent` only)
- Modify: `src/__tests__/lib/export-raster-plan.test.ts` (append; switch this file's env to jsdom — add `/** @vitest-environment jsdom */` as the first line; the pure-math tests are unaffected)

The shipped version unions `getBBox()` over the **SVG's** children only — but person cards are HTML `div.card_cont` **siblings** of the SVG, so the measured extent misses card overhang (spec §6 known limitation). Replace with a uniform screen-space union over connector paths AND cards, divided by zoom k.

- [ ] **Step 1: Write the failing tests** — append to `export-raster-plan.test.ts`:

```ts
import { measureNativeExtent } from '@/app/(app)/tree/[id]/_lib/export-raster-plan'

function stubRect(el: Element, r: { left: number; top: number; right: number; bottom: number }) {
  el.getBoundingClientRect = () =>
    ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top, toJSON: () => ({}) }) as DOMRect
}

/** Chart DOM skeleton: wrapper > (svg.main_svg > g.view > path) + div.card_cont siblings. */
function buildChartDom(k: number) {
  const container = document.createElement('div')
  const wrapper = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('main_svg')
  const view = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  view.classList.add('view')
  view.setAttribute('transform', `translate(10, 20) scale(${k})`)
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  view.append(path)
  svg.append(view)
  const card1 = document.createElement('div')
  card1.classList.add('card_cont')
  const card2 = document.createElement('div')
  card2.classList.add('card_cont')
  wrapper.append(svg, card1, card2)
  container.append(wrapper)
  document.body.append(container)
  return { container, path, card1, card2 }
}

describe('measureNativeExtent — unions cards AND connector paths (#225)', () => {
  it('includes card overhang the SVG paths alone would miss', () => {
    const k = 0.5
    const { container, path, card1, card2 } = buildChartDom(k)
    // Screen-space rects: paths span 100..300; cards extend the union to 50..600.
    stubRect(path, { left: 100, top: 100, right: 300, bottom: 200 })
    stubRect(card1, { left: 50, top: 80, right: 250, bottom: 220 })
    stubRect(card2, { left: 400, top: 100, right: 600, bottom: 240 })

    const extent = measureNativeExtent(container)
    expect(extent).not.toBeNull()
    // Union: 50..600 wide (550 screen px), 80..240 tall (160 screen px).
    // Native = screen / k + 2*80 margin: 550/0.5+160=1260, 160/0.5+160=480.
    expect(extent!.nativeW).toBeCloseTo(1260, 3)
    expect(extent!.nativeH).toBeCloseTo(480, 3)
    container.remove()
  })

  it('returns null when the zoom transform is unreadable', () => {
    const { container } = buildChartDom(1)
    container.querySelector('g.view')!.removeAttribute('transform')
    expect(measureNativeExtent(container)).toBeNull()
    container.remove()
  })

  it('returns null when nothing measurable is rendered', () => {
    const container = document.createElement('div')
    document.body.append(container)
    expect(measureNativeExtent(container)).toBeNull()
    container.remove()
  })
})
```

Note: with no `transform`, `readCurrentZoomK` falls through to the `__zoom` fallback and returns null — the test holds. jsdom elements default `getBoundingClientRect` to all-zeros, so unstubbed elements are skipped by the `width <= 0` guard.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/__tests__/lib/export-raster-plan.test.ts`
Expected: the first new test FAILS (current implementation uses `getBBox`, which jsdom doesn't implement → returns null or misses cards). The two null-cases may already pass — fine.

- [ ] **Step 3: Implement** — replace the whole `measureNativeExtent` function body in `export-raster-plan.ts`:

```ts
/**
 * Measure the tree's native (k=1) extent.
 *
 * #225 rewrite: the previous getBBox()-based version measured only the SVG
 * connector paths — person cards are HTML `div.card_cont` SIBLINGS of
 * `svg.main_svg`, so card overhang was systematically missed (spec §6).
 * We now union getBoundingClientRect over BOTH the connector paths and the
 * cards — a single uniform screen-px space — and divide the union size by
 * the current zoom k. Translation offsets cancel in (max − min).
 *
 * Returns `null` when measurement fails — callers treat that as degraded.
 */
export function measureNativeExtent(container: HTMLElement): NativeExtent | null {
  try {
    const svg = container.querySelector<SVGSVGElement>('svg.main_svg')
    const wrapper = svg?.parentElement
    if (!svg || !wrapper) return null

    const k = readCurrentZoomK(container)
    if (k === null || k <= 0) return null

    const els: Element[] = [
      ...Array.from(svg.querySelectorAll('path')),
      ...Array.from(wrapper.querySelectorAll('.card_cont')),
    ]
    if (els.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      minX = Math.min(minX, r.left)
      minY = Math.min(minY, r.top)
      maxX = Math.max(maxX, r.right)
      maxY = Math.max(maxY, r.bottom)
    }

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      return null
    }

    const MARGIN = 80 // px at native scale
    const nativeW = (maxX - minX) / k + MARGIN * 2
    const nativeH = (maxY - minY) / k + MARGIN * 2

    return {
      nativeW: Math.max(nativeW, 400),
      nativeH: Math.max(nativeH, 300),
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/__tests__/lib/export-raster-plan.test.ts && pnpm typecheck`
Expected: ALL pass (including the pre-existing pure-math tests under jsdom).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/export-raster-plan.ts src/__tests__/lib/export-raster-plan.test.ts
git commit -m "fix(#225): measureNativeExtent unions card rects — was under-measuring (paths only)"
```

---

### Task 11: Restore the stress-seed fixtures (multi-root)

**Files:**
- Create (restored + adapted): `scripts/export-stress/tree-shape.ts`, `scripts/export-stress/synth-photo.ts`, `scripts/export-stress/seed-export-stress.ts`, `scripts/export-stress/__tests__/tree-shape.test.ts`
- Modify: `package.json` (scripts)

The #215 spike versions live on `origin/spike/215-full-tree-export-viability` under `scripts/spike-215/`. `package.json` still carries dangling `spike:seed` / `spike:capture` entries pointing at the deleted files — replace them.

- [ ] **Step 1: Restore the spike files into the new location**

```bash
mkdir -p scripts/export-stress/__tests__
for f in tree-shape.ts synth-photo.ts seed-export-stress.ts; do
  git show origin/spike/215-full-tree-export-viability:scripts/spike-215/$f > scripts/export-stress/$f
done
git show origin/spike/215-full-tree-export-viability:scripts/spike-215/__tests__/tree-shape.test.ts > scripts/export-stress/__tests__/tree-shape.test.ts
```

(Do NOT restore `capture-runner.spec.ts` / `vitest.config.ts` — Playwright spike throwaway. If `tree-shape.test.ts` carries a sibling-`vitest.config` import or relies on the spike config, adjust its import paths to plain relative `../tree-shape` and ensure it runs under the repo's root vitest config.)

- [ ] **Step 2: Multi-root `buildTreeShape`** — in `scripts/export-stress/tree-shape.ts`, change the founding-couple block. Update the function signature and docstring:

```ts
/**
 * Build `count` person specs. Generation 0 is `rootCouples` founding couples
 * (multi-root exercises the #69 super-root path — ≥2 primary roots inject
 * `__super_root__`; 1 founding couple is the #224-regression single-trunk
 * shape). Each later person is either a child of an existing couple or the
 * in-marrying spouse of an existing person. ~70% are flagged `hasPhoto`.
 */
export function buildTreeShape(count: number, rootCouples = 3): PersonSpec[] {
```

Replace the single founding-couple block:

```ts
  // Founding couples (generation 0).
  const couples: Array<[number, number, number]> = []
  for (let i = 0; i < rootCouples && people.length + 2 <= Math.max(count, 2); i++) {
    const f = push('m', 0, null, null)
    const m = push('f', 0, null, null)
    marry(f, m)
    couples.push([f.idx, m.idx, 0])
  }
```

(Keep the `mulberry32(count * 2654435761)` seeding — determinism note: add `rootCouples` to the seed so the single-trunk variant differs: `mulberry32((count * 8 + rootCouples) * 2654435761)`. Update the docstring accordingly.)

- [ ] **Step 3: Fixture list + naming in the seed script** — in `scripts/export-stress/seed-export-stress.ts`, replace the `SIZES` constant and adapt `seedTree` to take a fixture object:

```ts
const FIXTURES = [
  { name: 'Export Stress 25', count: 25, rootCouples: 3 },
  { name: 'Export Stress 50', count: 50, rootCouples: 3 },
  { name: 'Export Stress 100', count: 100, rootCouples: 3 },
  { name: 'Export Stress 150', count: 150, rootCouples: 3 },
  { name: 'Export Stress 200', count: 200, rootCouples: 3 },
  // #224 regression spot-check: single founding couple (no __super_root__).
  { name: 'Export Stress 60 single-trunk', count: 60, rootCouples: 1 },
] as const
```

Thread `fixture.name` into the tree insert, `buildTreeShape(fixture.count, fixture.rootCouples)` into the spec build, and iterate `FIXTURES` in `main`. Also fix the relative import (`./tree-shape`, `./synth-photo` — unchanged since files moved together). Update the usage header comment to `pnpm seed:export-stress` and the email constant to `export-stress@example.com` (keeps spike data separable). Keep the existing local-URL safety guard verbatim.

- [ ] **Step 4: Extend the tree-shape test** — append to `scripts/export-stress/__tests__/tree-shape.test.ts`:

```ts
describe('buildTreeShape — multi-root (#225)', () => {
  it('creates rootCouples founding couples (no parents, generation 0)', () => {
    const people = buildTreeShape(100, 3)
    const founders = people.filter((p) => p.generation === 0)
    expect(founders).toHaveLength(6) // 3 couples
    for (const f of founders) {
      expect(f.fatherIdx).toBeNull()
      expect(f.motherIdx).toBeNull()
      expect(f.spouseIdx).not.toBeNull()
    }
  })

  it('still produces exactly count people', () => {
    expect(buildTreeShape(200, 3)).toHaveLength(200)
    expect(buildTreeShape(60, 1)).toHaveLength(60)
  })

  it('is deterministic per (count, rootCouples)', () => {
    expect(buildTreeShape(100, 3)).toEqual(buildTreeShape(100, 3))
    expect(buildTreeShape(100, 3)).not.toEqual(buildTreeShape(100, 1))
  })
})
```

- [ ] **Step 5: package.json scripts** — remove `"spike:seed"` and `"spike:capture"`; add:

```json
"seed:export-stress": "tsx scripts/export-stress/seed-export-stress.ts"
```

- [ ] **Step 6: Verify**

Run: `pnpm vitest run scripts/export-stress/__tests__/tree-shape.test.ts && pnpm typecheck && pnpm lint`
Expected: ALL pass. (If the root vitest config's `include` globs exclude `scripts/`, extend the `include` to add `scripts/**/__tests__/**/*.test.ts` — check `vitest.config.*` first.)
Then a live smoke (local stack must be running — `pnpm exec supabase start`):
Run: `pnpm seed:export-stress`
Expected: prints 6 tree IDs, idempotent on re-run.

- [ ] **Step 7: Commit**

```bash
git add scripts/export-stress package.json
git commit -m "test(#225): restore export-stress seed fixtures, multi-root topology + single-trunk spot-check"
```

---

### Task 12: Ceiling validation — REAL browser, NEEDS HUMAN

**Files:**
- Modify: `docs/superpowers/specs/2026-06-09-full-tree-renderer-design.md` (append a `## 10. Ceiling validation results` section)

This is the spec §6 gate. It **cannot be done headless** (headless Chromium collapses large family-chart trees). Chrome can be driven via the browser extension/MCP; **Safari + Firefox + legibility eyeballing need the user** — pause and hand off when you reach those rows.

- [ ] **Step 1: Stand up the measurement environment**

```bash
pnpm exec supabase start
pnpm seed:export-stress
pnpm dev   # dev server — the [export:preflight] console.info is dev-gated
```

Log in as `export-stress@example.com` (magic link via Mailpit at `http://127.0.0.1:54324`).

- [ ] **Step 2: Per tree × browser, record** — open each `Export Stress *` tree, open devtools console, trigger **Export → PDF (print)**, and record from the `[export:preflight]` log + the produced file:

| tree | browser | nativeW×H | boxW×H | pixelRatio | degraded | canvas px | PDF pages | wall-time (s) | cards legible @100%? |
|---|---|---|---|---|---|---|---|---|---|

Rows: {25, 50, 100, 150, 200, 60 single-trunk} × {Chrome, Safari, Firefox}. Also one PNG export per browser at 100 + 200 (PNG regression). Mobile Safari / Android Chrome: verify the degrade dialog appears (non-gating).

- [ ] **Step 3: Verify the Task-10 measurement fix** — at 200 people in Chrome, compare the logged `nativeW/nativeH` against a manual union of card rects (paste into the console):

```js
(() => {
  const k = parseFloat(document.querySelector('svg.main_svg g.view').getAttribute('transform').match(/scale\(([\d.]+)\)/)[1])
  const rects = [...document.querySelectorAll('.card_cont')].map(c => c.getBoundingClientRect())
  const minX = Math.min(...rects.map(r => r.left)), maxX = Math.max(...rects.map(r => r.right))
  const minY = Math.min(...rects.map(r => r.top)), maxY = Math.max(...rects.map(r => r.bottom))
  console.log('card-union native:', (maxX - minX) / k + 160, (maxY - minY) / k + 160)
})()
```

Expected: matches `[export:preflight]` nativeW/H within the margin. A material gap = Task 10 regression — stop and fix.

- [ ] **Step 4: Record the verdict** — append the filled table to the spec as `## 10. Ceiling validation results`, stating per browser the people-count where `degraded` first flips true, and whether 200 stays legible. **If 200 fails the bar on a gating desktop browser:** file the offscreen/server follow-up issue under epic #60 (title: `feat: server/offscreen full-layout export for trees beyond the client ceiling`) and note the measured ceiling as #225's shipped limit.

- [ ] **Step 5: Comment on #225**

```bash
gh issue comment 225 --repo SanchitB23/meetthefam --body "<summary: verdict + per-browser ceiling + link to spec §10>"
```

(Compose the body from the actual results — verdict line first, the table second, link to the spec section last.)

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-06-09-full-tree-renderer-design.md
git commit -m "docs(#225): ceiling validation results — real-browser 25→200 curve + verdict"
```

---

### Task 13: Final gates, smoke-flow doc, draft PR

**Files:**
- Modify: `docs/qa/smoke-flows.md` (export flow)
- No code changes.

- [ ] **Step 1: Update the smoke-flow catalog** — open `docs/qa/smoke-flows.md`, find the existing export-related flow (search `export`); extend it (or add a new flow following the file's existing numbering/format) to cover: *open a tree → Export → "Download as PDF (print)" → for a small tree a 1-page A4 PDF downloads; for a seeded `Export Stress 200` tree the degrade dialog appears → Continue → a multi-page tiled A4 PDF downloads with `r{row}c{col}` labels.* Match the surrounding flow-entry style exactly.

- [ ] **Step 2: Full gates**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all clean, full suite green.

- [ ] **Step 3: Commit the doc, push the branch**

```bash
git add docs/qa/smoke-flows.md
git commit -m "docs(#225): smoke flow for smart A4 PDF export (single + tiled + degrade dialog)"
git push -u origin feat/225-full-tree-renderer
```

- [ ] **Step 4: Open the draft PR** — base **`feat/60-tree-export`** (the epic branch — NOT `qa`; this branch was cut from the epic). Follow `.github/pull_request_template.md` end-to-end: pre-tick the local gates you ran, leave manual-checklist boxes for the reviewer. Body must include a `## Closes` section with bare `Closes #225`, and set milestone `v1.2 — Export & archival`.

```bash
gh pr create --draft --base feat/60-tree-export --title "feat(#225): full-tree archival export — smart A4 PDF (single/tiled) + degrade gate" --body-file <(cat <<'EOF'
<follow .github/pull_request_template.md — fill every section; include:>
## Closes
Closes #225
EOF
)
gh pr edit --milestone "v1.2 — Export & archival"
```

(The body-file heredoc above is a placeholder shape — compose the real body from the PR template file at execution time; the template's sections are authoritative.)

- [ ] **Step 5: Hand back to the user** — the user marks the draft ready themselves (never merge a draft).

---

## Verification summary (Definition of Done)

- [ ] `RasterPlan.degraded` true ⟺ box shrunk below native (or invalid input); unit-tested.
- [ ] `pdf-page-plan` is A4-only; `fitsSingleA4` + `PDF_PRINT_DPI` + `SINGLE_PAGE_MIN_SCALE` exported and tested; A3 gone.
- [ ] `planTiles` pure geometry tested: grid, overlap, partial edge tiles, orientation choice, pixelRatio scaling.
- [ ] `treeToPdf(canvas, native, …)` branches single ⟷ tiled; tiled pages carry image-at-margin, ticks, assembly label; tested against real geometry with mocked jspdf.
- [ ] PDF export run: preflight (no DOM mutation) → degrade dialog on degraded/measure-fail/mobile → capture → smart PDF; decline aborts with zero UI residue; cancel paths intact.
- [ ] `measureNativeExtent` unions cards + paths (screen-space ÷ k); jsdom-tested; cross-checked live at 200 people.
- [ ] Stress fixtures seeded (5 multi-root + 1 single-trunk), deterministic, `pnpm seed:export-stress`.
- [ ] Ceiling validation table recorded in spec §10 + #225 comment; follow-up issue filed iff 200 fails.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green; draft PR against `feat/60-tree-export` with `Closes #225` + milestone.
