# PDF export + footer/watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-page PDF export option alongside the shipped PNG export — reusing the raster pipeline, embedding the image losslessly via `jspdf`, and stamping a `Generated from meetthefam · YYYY-MM-DD` footer.

**Architecture:** PNG and PDF each capture once per export run (the user picks one format from a dropdown). A new shared `rasterizeTreeCanvas` produces an `HTMLCanvasElement` via html-to-image `toCanvas`. PDF always uses it (canvas → PNG data URL → jspdf). PNG also uses it **behind a feature flag** (`EXPORT_PNG_VIA_CANVAS`, default on); flag-off reverts PNG to the untouched legacy `toBlob` 2-pass path. Page geometry (A4/A3, orientation, scale-to-fit, footer) is pure and unit-tested.

**Tech Stack:** Next.js 16 / React (client components), TypeScript strict, `html-to-image` (`toCanvas`), `jspdf@^4.2.1` (dynamic import), Base UI shadcn `DropdownMenu`, Vitest (jsdom + node), pnpm.

**Branch / integration:** Work on `feat/219-pdf-export` (cut from epic `feat/60-tree-export`). PR targets **`feat/60-tree-export`** (the epic), opened as **draft**, body carries bare `Closes #219` + the **v1.2 — Export & archival** milestone, and follows `.github/pull_request_template.md`.

**Spec:** `docs/superpowers/specs/2026-06-09-pdf-export-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/app/(app)/tree/[id]/_lib/export-config.ts` | create | `EXPORT_PNG_VIA_CANVAS` env-derived boolean flag. |
| `src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts` | create | Pure geometry: image px dims → A4/A3 + orientation + scale-to-fit + footer (mm). |
| `src/app/(app)/tree/[id]/_lib/rasterize-tree.ts` | create | `rasterizeTreeCanvas` (shared toCanvas 2-pass core) + `canvasToBlob` helper. |
| `src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts` | create | `treeToPdf(dataUrl, dims, treeName, date) → Blob` via jspdf. |
| `src/app/(app)/tree/[id]/_lib/export-filename.ts` | modify | Export the existing `isoDate` helper for reuse by the footer. |
| `src/app/(app)/tree/[id]/_lib/capture-tree.ts` | modify | Branch on `format` + flag: PDF path, PNG-canvas path, legacy PNG path (verbatim). |
| `src/app/(app)/tree/[id]/_components/ExportTreeButton.tsx` | modify | Replace direct dispatch with a PNG/PDF dropdown. |
| `src/__tests__/lib/pdf-page-plan.test.ts` | create | Geometry unit tests. |
| `src/__tests__/lib/rasterize-tree.test.ts` | create | toCanvas 2-pass + restore + abort tests. |
| `src/__tests__/lib/tree-to-pdf.test.ts` | create | jspdf-mock tests asserting plan-driven addImage/text. |
| `src/__tests__/lib/capture-tree.test.ts` | modify | Pin legacy suite to flag-off; assertions unchanged. |
| `src/__tests__/lib/capture-tree-canvas.test.ts` | create | PDF path + PNG-canvas path (flag-on). |
| `src/__tests__/components/ExportTreeButton.test.tsx` | modify | Dropdown dispatches per-format; pending still disables. |

No event-contract change (`ExportFormat = 'png' \| 'pdf'` already exists). No DB / RLS / migration surface. No new dependency (`jspdf` already installed).

---

## Task 1: Feature flag (`export-config.ts`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/export-config.ts`
- Test: `src/__tests__/lib/export-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/export-config.test.ts
// Pure env-flag read. Uses vi.stubEnv + module reset so each case re-evaluates
// the const against a fresh process.env.
import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFlag() {
  vi.resetModules()
  const mod = await import('@/app/(app)/tree/[id]/_lib/export-config')
  return mod.EXPORT_PNG_VIA_CANVAS
}

describe('EXPORT_PNG_VIA_CANVAS', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('defaults to true when the env var is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS', '')
    expect(await loadFlag()).toBe(true)
  })

  it('is false only when explicitly set to the string "false"', async () => {
    vi.stubEnv('NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS', 'false')
    expect(await loadFlag()).toBe(false)
  })

  it('is true for any other value', async () => {
    vi.stubEnv('NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS', 'true')
    expect(await loadFlag()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- export-config`
Expected: FAIL — cannot resolve `@/app/(app)/tree/[id]/_lib/export-config`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/export-config.ts
// Feature flag for tree export paths (#219).
//
// EXPORT_PNG_VIA_CANVAS routes PNG export through the unified `toCanvas`
// rasteriser (Approach 2, shared with PDF). Set
// NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS="false" in Vercel to revert PNG to the
// legacy 2-pass `toBlob` pipeline if the canvas path regresses (e.g. a Safari
// surprise). Default (unset) = true.
//
// Caveat: capture is client-side, so this is a NEXT_PUBLIC var inlined at
// build time — flipping it in Vercel requires a redeploy to take effect
// (no code change). PDF export is NOT gated by this flag.
export const EXPORT_PNG_VIA_CANVAS =
  process.env.NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS !== 'false'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- export-config`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/export-config.ts src/__tests__/lib/export-config.test.ts
git commit -m "feat(#219): EXPORT_PNG_VIA_CANVAS feature flag

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: PDF page geometry (`pdf-page-plan.ts`)

Pure math — no DOM. Mirrors the existing `export-raster-plan.ts` pattern.

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts`
- Test: `src/__tests__/lib/pdf-page-plan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/pdf-page-plan.test.ts
// Pure geometry for single-page PDF layout (#219). No DOM; node env is fine.
import { describe, expect, it } from 'vitest'
import {
  planPdfPage,
  PDF_A3_LONG_EDGE_PX,
  PDF_MARGIN_MM,
  PDF_FOOTER_STRIP_MM,
} from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'

// A4 = 210x297, A3 = 297x420 (mm).
describe('planPdfPage — orientation', () => {
  it('chooses landscape when the image is wider than tall', () => {
    const plan = planPdfPage({ width: 4000, height: 2000 })
    expect(plan.orientation).toBe('l')
  })

  it('chooses portrait when the image is taller than wide', () => {
    const plan = planPdfPage({ width: 2000, height: 4000 })
    expect(plan.orientation).toBe('p')
  })

  it('treats a square image as portrait (not wider than tall)', () => {
    expect(planPdfPage({ width: 3000, height: 3000 }).orientation).toBe('p')
  })
})

describe('planPdfPage — page size threshold', () => {
  it('uses A4 when the long edge is at or below the A3 threshold', () => {
    expect(planPdfPage({ width: PDF_A3_LONG_EDGE_PX, height: 1000 }).pageFormat).toBe('a4')
  })

  it('uses A3 when the long edge exceeds the threshold', () => {
    expect(planPdfPage({ width: PDF_A3_LONG_EDGE_PX + 1, height: 1000 }).pageFormat).toBe('a3')
  })
})

describe('planPdfPage — scale-to-fit within margins + footer strip', () => {
  it('width-bounds a very wide image to the printable width', () => {
    // A4 landscape: pageW=297, availW = 297 - 2*10 = 277.
    const plan = planPdfPage({ width: 10000, height: 1000 }) // long edge 10000 > 8000 → A3
    // A3 landscape: pageW=420, availW = 420 - 20 = 400.
    expect(plan.orientation).toBe('l')
    expect(plan.pageFormat).toBe('a3')
    expect(plan.imgW).toBeCloseTo(400, 5)
    // height preserves aspect: 400 * (1000/10000) = 40.
    expect(plan.imgH).toBeCloseTo(40, 5)
    // centered horizontally: (420 - 400)/2 = 10.
    expect(plan.imgX).toBeCloseTo(10, 5)
    expect(plan.imgY).toBeCloseTo(PDF_MARGIN_MM, 5)
  })

  it('height-bounds a tall image to the printable height (minus footer strip)', () => {
    // 1000x4000 → portrait, long edge 4000 ≤ 8000 → A4 (210x297).
    const plan = planPdfPage({ width: 1000, height: 4000 })
    expect(plan.orientation).toBe('p')
    expect(plan.pageFormat).toBe('a4')
    // availH = 297 - 2*10 - 8 = 269. availW = 210 - 20 = 190.
    // availAspect = 190/269 = 0.706 ; imgAspect = 1000/4000 = 0.25.
    // availAspect > imgAspect → height-bound: imgH = 269, imgW = 269*0.25 = 67.25.
    expect(plan.imgH).toBeCloseTo(269, 5)
    expect(plan.imgW).toBeCloseTo(67.25, 5)
    expect(plan.imgX).toBeCloseTo((210 - 67.25) / 2, 5)
  })

  it('never lets the image overlap the footer strip', () => {
    const plan = planPdfPage({ width: 3000, height: 3000 }) // portrait A4
    const pageH = 297
    const footerTop = pageH - PDF_MARGIN_MM - PDF_FOOTER_STRIP_MM
    expect(plan.imgY + plan.imgH).toBeLessThanOrEqual(footerTop + 0.01)
  })
})

describe('planPdfPage — footer position', () => {
  it('puts the footer baseline left-aligned in the bottom margin', () => {
    const plan = planPdfPage({ width: 3000, height: 2000 }) // landscape A4 (297x210)
    expect(plan.footer.x).toBeCloseTo(PDF_MARGIN_MM, 5)
    expect(plan.footer.y).toBeCloseTo(210 - PDF_MARGIN_MM, 5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- pdf-page-plan`
Expected: FAIL — cannot resolve `pdf-page-plan`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/pdf-page-plan.ts
// Pure single-page PDF layout geometry (#219). Given the embedded image's pixel
// dimensions, decide page size + orientation and scale-to-fit the image inside
// the printable box, reserving a bottom strip for the footer. No DOM, no jspdf.
//
// jspdf works in mm here. A4 = 210x297, A3 = 297x420 (portrait short x long).

/** Native long-edge (px) above which we step up from A4 to A3 for more print area. */
export const PDF_A3_LONG_EDGE_PX = 8000
/** Page margin on all sides (mm). */
export const PDF_MARGIN_MM = 10
/** Extra bottom space reserved for the footer line (mm). */
export const PDF_FOOTER_STRIP_MM = 8

const PAGE_MM = {
  a4: { short: 210, long: 297 },
  a3: { short: 297, long: 420 },
} as const

export interface PdfImageDims {
  /** Embedded image width in pixels. */
  width: number
  /** Embedded image height in pixels. */
  height: number
}

export interface PdfPagePlan {
  pageFormat: 'a4' | 'a3'
  orientation: 'l' | 'p'
  /** Image placement (mm). */
  imgX: number
  imgY: number
  imgW: number
  imgH: number
  /** Footer text baseline (mm). */
  footer: { x: number; y: number }
}

export function planPdfPage(dims: PdfImageDims): PdfPagePlan {
  const longEdge = Math.max(dims.width, dims.height)
  const pageFormat: 'a4' | 'a3' = longEdge > PDF_A3_LONG_EDGE_PX ? 'a3' : 'a4'
  const orientation: 'l' | 'p' = dims.width > dims.height ? 'l' : 'p'

  const { short, long } = PAGE_MM[pageFormat]
  const pageW = orientation === 'l' ? long : short
  const pageH = orientation === 'l' ? short : long

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

  return { pageFormat, orientation, imgX, imgY, imgW, imgH, footer }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- pdf-page-plan`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/pdf-page-plan.ts src/__tests__/lib/pdf-page-plan.test.ts
git commit -m "feat(#219): pure PDF page-layout geometry (A4/A3, orientation, fit)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Export the `isoDate` helper for footer reuse

The footer date must match the filename date (`YYYY-MM-DD`, UTC). `isoDate` already
exists in `export-filename.ts` as a module-private function — export it so
`tree-to-pdf.ts` reuses it (DRY) instead of duplicating the formatting.

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/export-filename.ts`

- [ ] **Step 1: Make the helper exported**

Change the existing line:

```ts
function isoDate(date: Date): string {
```

to:

```ts
export function isoDate(date: Date): string {
```

(Leave the body unchanged: `return date.toISOString().slice(0, 10)`.)

- [ ] **Step 2: Verify existing filename tests still pass**

Run: `pnpm test -- export-filename`
Expected: PASS (unchanged behaviour; only visibility changed).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/export-filename.ts
git commit -m "refactor(#219): export isoDate helper for footer reuse

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: PDF builder (`tree-to-pdf.ts`)

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts`
- Test: `src/__tests__/lib/tree-to-pdf.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/tree-to-pdf.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock jspdf: capture constructor options + method calls. We use the REAL
// planPdfPage so the assertions verify integration (right page, right coords).
const { jsPDFMock, doc } = vi.hoisted(() => {
  const doc = {
    addImage: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    output: vi.fn(() => new Blob(['%PDF'], { type: 'application/pdf' })),
  }
  return { jsPDFMock: vi.fn(() => doc), doc }
})
vi.mock('jspdf', () => ({ jsPDF: jsPDFMock }))

import { treeToPdf } from '@/app/(app)/tree/[id]/_lib/tree-to-pdf'
import { planPdfPage } from '@/app/(app)/tree/[id]/_lib/pdf-page-plan'

const DATA_URL = 'data:image/png;base64,AAAA'

describe('treeToPdf', () => {
  beforeEach(() => {
    jsPDFMock.mockClear()
    doc.addImage.mockClear()
    doc.text.mockClear()
    doc.setFontSize.mockClear()
    doc.setTextColor.mockClear()
    doc.output.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('constructs jsPDF with the planned orientation/format in mm', async () => {
    const dims = { width: 4000, height: 2000 } // landscape A4
    const plan = planPdfPage(dims)
    await treeToPdf(DATA_URL, dims, 'Smith Family', new Date('2026-06-09T00:00:00Z'))
    expect(jsPDFMock).toHaveBeenCalledWith({
      orientation: plan.orientation,
      unit: 'mm',
      format: plan.pageFormat,
    })
  })

  it('adds the PNG image at the planned coordinates', async () => {
    const dims = { width: 4000, height: 2000 }
    const plan = planPdfPage(dims)
    await treeToPdf(DATA_URL, dims, 'Smith Family', new Date('2026-06-09T00:00:00Z'))
    expect(doc.addImage).toHaveBeenCalledWith(
      DATA_URL, 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH,
    )
  })

  it('draws the footer with the UTC date at the planned baseline', async () => {
    const dims = { width: 4000, height: 2000 }
    const plan = planPdfPage(dims)
    await treeToPdf(DATA_URL, dims, 'Smith Family', new Date('2026-06-09T23:30:00Z'))
    expect(doc.text).toHaveBeenCalledWith(
      'Generated from meetthefam · 2026-06-09', plan.footer.x, plan.footer.y,
    )
  })

  it('returns the pdf blob from output("blob")', async () => {
    const blob = await treeToPdf(DATA_URL, { width: 1000, height: 1000 }, 'X')
    expect(doc.output).toHaveBeenCalledWith('blob')
    expect(blob).toBeInstanceOf(Blob)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tree-to-pdf`
Expected: FAIL — cannot resolve `tree-to-pdf`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/tree-to-pdf.ts
// Builds a single-page PDF from a captured tree image (#219). Dynamic-imports
// jspdf (code-split: only loaded when the user picks PDF). The image is
// embedded losslessly as PNG — PDF is the archival/high-quality artifact;
// the PNG download is the lightweight shareable one.
import { isoDate } from './export-filename'
import { planPdfPage, type PdfImageDims } from './pdf-page-plan'

/** Footer font size (pt) and muted grey RGB. */
const FOOTER_FONT_PT = 9
const FOOTER_RGB: [number, number, number] = [120, 120, 120]

export async function treeToPdf(
  pngDataUrl: string,
  dims: PdfImageDims,
  treeName: string,
  date: Date = new Date(),
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const plan = planPdfPage(dims)

  const doc = new jsPDF({
    orientation: plan.orientation,
    unit: 'mm',
    format: plan.pageFormat,
  })

  doc.addImage(pngDataUrl, 'PNG', plan.imgX, plan.imgY, plan.imgW, plan.imgH)

  doc.setFontSize(FOOTER_FONT_PT)
  doc.setTextColor(...FOOTER_RGB)
  doc.text(`Generated from meetthefam · ${isoDate(date)}`, plan.footer.x, plan.footer.y)

  return doc.output('blob')
}
```

Note: `treeName` is accepted for symmetry with the capture API and future
footer/metadata use; the filename is applied by the caller via `exportFilename`.
If `pnpm lint` flags it as unused, prefix with `_` (`_treeName`) — do not remove
it from the signature (the caller passes it positionally).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tree-to-pdf`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/tree-to-pdf.ts src/__tests__/lib/tree-to-pdf.test.ts
git commit -m "feat(#219): treeToPdf — jspdf single-page builder with footer

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Shared canvas rasteriser (`rasterize-tree.ts`)

A self-contained copy of the capture core (so the legacy `toBlob` path in
`capture-tree.ts` stays untouched and can't drift toward the new code). Produces
an `HTMLCanvasElement` via html-to-image `toCanvas`, 2-pass for Safari warm-up.

**Files:**
- Create: `src/app/(app)/tree/[id]/_lib/rasterize-tree.ts`
- Test: `src/__tests__/lib/rasterize-tree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/rasterize-tree.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CaptureOpts = { filter: (n: HTMLElement) => boolean; pixelRatio: number }

const { toCanvas } = vi.hoisted(() => ({
  toCanvas: vi.fn<(node: HTMLElement, opts: CaptureOpts) => Promise<HTMLCanvasElement>>(
    async () => document.createElement('canvas'),
  ),
}))
vi.mock('html-to-image', () => ({ toCanvas }))

const { inlineImages } = vi.hoisted(() => ({
  inlineImages: vi.fn<(t: HTMLElement) => Promise<() => void>>(async () => () => undefined),
}))
const { inlineLinkStrokes } = vi.hoisted(() => ({
  inlineLinkStrokes: vi.fn<(t: HTMLElement) => () => void>(() => () => undefined),
}))
vi.mock('@/app/(app)/tree/[id]/_lib/inline-images', () => ({ inlineImages }))
vi.mock('@/app/(app)/tree/[id]/_lib/inline-link-strokes', () => ({ inlineLinkStrokes }))

import { rasterizeTreeCanvas } from '@/app/(app)/tree/[id]/_lib/rasterize-tree'

function buildTree() {
  const container = document.createElement('div')
  const wrapper = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'main_svg')
  const card = document.createElement('div')
  card.className = 'card_cont'
  const excluded = document.createElement('button')
  excluded.setAttribute('data-export-exclude', '')
  wrapper.append(svg, card, excluded)
  container.append(wrapper)
  document.body.append(container)
  return { container, wrapper, card, excluded }
}

describe('rasterizeTreeCanvas', () => {
  beforeEach(() => {
    toCanvas.mockClear()
    inlineImages.mockClear()
    inlineLinkStrokes.mockClear()
    inlineImages.mockResolvedValue(() => undefined)
    inlineLinkStrokes.mockReturnValue(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('captures svg.main_svg.parentElement, twice (Safari 2-pass)', async () => {
    const { container, wrapper } = buildTree()
    await rasterizeTreeCanvas(container, 2)
    expect(toCanvas).toHaveBeenCalledTimes(2)
    expect(toCanvas.mock.calls[0][0]).toBe(wrapper)
    expect(toCanvas.mock.calls[1][0]).toBe(wrapper)
  })

  it('forwards the pixelRatio and filters [data-export-exclude]', async () => {
    const { container, card, excluded } = buildTree()
    await rasterizeTreeCanvas(container, 2.5)
    const opts = toCanvas.mock.calls[1][1]
    expect(opts.pixelRatio).toBe(2.5)
    expect(opts.filter(excluded)).toBe(false)
    expect(opts.filter(card)).toBe(true)
  })

  it('returns the SECOND canvas', async () => {
    const first = document.createElement('canvas')
    const second = document.createElement('canvas')
    toCanvas.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const { container } = buildTree()
    const result = await rasterizeTreeCanvas(container, 2)
    expect(result).toBe(second)
  })

  it('calls inline helpers before toCanvas and restores them after', async () => {
    const order: string[] = []
    const restoreImgs = vi.fn(() => order.push('restoreImgs'))
    const restoreStrokes = vi.fn(() => order.push('restoreStrokes'))
    inlineImages.mockImplementation(async () => { order.push('inlineImages'); return restoreImgs })
    inlineLinkStrokes.mockImplementation(() => { order.push('inlineLinkStrokes'); return restoreStrokes })
    toCanvas.mockImplementation(async () => { order.push('toCanvas'); return document.createElement('canvas') })
    const { container } = buildTree()
    await rasterizeTreeCanvas(container, 2)
    expect(order[0]).toBe('inlineImages')
    expect(order[1]).toBe('inlineLinkStrokes')
    expect(restoreImgs).toHaveBeenCalled()
    expect(restoreStrokes).toHaveBeenCalled()
  })

  it('returns null and skips raster when aborted before capture', async () => {
    const { container } = buildTree()
    const result = await rasterizeTreeCanvas(container, 2, { aborted: true })
    expect(result).toBeNull()
    expect(toCanvas).not.toHaveBeenCalled()
  })

  it('restores inline helpers even if toCanvas throws', async () => {
    const restoreImgs = vi.fn()
    const restoreStrokes = vi.fn()
    inlineImages.mockResolvedValue(restoreImgs)
    inlineLinkStrokes.mockReturnValue(restoreStrokes)
    toCanvas.mockRejectedValue(new Error('raster fail'))
    const { container } = buildTree()
    await expect(rasterizeTreeCanvas(container, 2)).rejects.toThrow('raster fail')
    expect(restoreImgs).toHaveBeenCalled()
    expect(restoreStrokes).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- rasterize-tree`
Expected: FAIL — cannot resolve `rasterize-tree`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(app)/tree/[id]/_lib/rasterize-tree.ts
// Shared raster core for the unified export path (#219). Produces an
// HTMLCanvasElement from the rendered family tree via html-to-image `toCanvas`,
// applying the same Safari fixes + 2-pass warm-up as the PNG pipeline.
//
// Deliberately self-contained: the legacy `toBlob` path in capture-tree.ts is
// the flag-off fallback and must NOT share code with this file, so a regression
// here can't leak into the known-good path. The small helper duplication is
// intentional (see EXPORT_PNG_VIA_CANVAS in export-config.ts).
import { inlineImages } from './inline-images'
import { inlineLinkStrokes } from './inline-link-strokes'
import type { CaptureSignal } from './capture-tree'

const FALLBACK_BG = '#fdfbf3' // heirloom cream; used if the live bg is transparent

function captureTargetOf(container: HTMLElement): HTMLElement {
  const svg = container.querySelector<SVGSVGElement>('svg.main_svg')
  const parent = svg?.parentElement
  return parent instanceof HTMLElement ? parent : container
}

async function awaitPhotoDecode(target: HTMLElement): Promise<void> {
  const imgs = Array.from(target.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve(),
    ),
  )
}

function resolveBackground(target: HTMLElement): string {
  const bg = getComputedStyle(target).backgroundColor
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return FALLBACK_BG
  return bg
}

/** Promisified canvas.toBlob (PNG). Rejects if the browser yields a null blob. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Tree export failed: empty canvas'))),
      'image/png',
    )
  })
}

/**
 * Rasterise the tree to a canvas. Returns null if aborted before capture.
 * Caller derives PNG blob (canvasToBlob) or PDF data URL (canvas.toDataURL).
 */
export async function rasterizeTreeCanvas(
  container: HTMLElement,
  pixelRatio = 3,
  signal?: CaptureSignal,
): Promise<HTMLCanvasElement | null> {
  const target = captureTargetOf(container)
  await awaitPhotoDecode(target)
  if (signal?.aborted) return null

  const restoreImgs = await inlineImages(target)
  const restoreStrokes = inlineLinkStrokes(target)

  try {
    const { toCanvas } = await import('html-to-image')
    const opts = {
      pixelRatio,
      backgroundColor: resolveBackground(target),
      cacheBust: true,
      filter: (node: HTMLElement) =>
        !(node instanceof HTMLElement && node.hasAttribute('data-export-exclude')),
    }
    await toCanvas(target, opts) // first pass — discard (Safari warm-up)
    return await toCanvas(target, opts) // second pass — use this
  } finally {
    restoreStrokes()
    restoreImgs()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- rasterize-tree`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/rasterize-tree.ts src/__tests__/lib/rasterize-tree.test.ts
git commit -m "feat(#219): shared toCanvas rasteriser + canvasToBlob helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Orchestrate format + flag in `capture-tree.ts`

Add the PDF and PNG-canvas paths; keep the legacy `toBlob` body verbatim as the
flag-off fallback. The `CaptureSignal` type stays exported here (rasterize-tree
imports it).

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/capture-tree.ts`
- Modify: `src/__tests__/lib/capture-tree.test.ts` (pin legacy suite to flag-off)
- Test: `src/__tests__/lib/capture-tree-canvas.test.ts` (new — flag-on + PDF)

- [ ] **Step 1: Pin the existing legacy suite to flag-off**

At the TOP of `src/__tests__/lib/capture-tree.test.ts` (before other imports/mocks),
add a mock so the existing `toBlob`-asserting tests still exercise the legacy path:

```ts
// Legacy PNG path is the flag-off fallback; pin the flag so these assertions
// (which expect the toBlob 2-pass pipeline) keep exercising it.
vi.mock('@/app/(app)/tree/[id]/_lib/export-config', () => ({
  EXPORT_PNG_VIA_CANVAS: false,
}))
```

(`vi` is already imported in that file. No other change to existing tests.)

- [ ] **Step 2: Run the legacy suite to confirm it still passes against current code**

Run: `pnpm test -- capture-tree.test`
Expected: PASS — current `captureTree` ignores the flag today, so the mock is a
no-op until Step 4. (Confirms the mock import path resolves.)

- [ ] **Step 3: Write the failing test for the new paths**

```ts
// src/__tests__/lib/capture-tree-canvas.test.ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Flag ON: PNG should go through the canvas path.
vi.mock('@/app/(app)/tree/[id]/_lib/export-config', () => ({
  EXPORT_PNG_VIA_CANVAS: true,
}))

// Fake canvas with the two derivation methods capture-tree uses.
const fakeCanvas = {
  width: 1234,
  height: 567,
  toDataURL: vi.fn(() => 'data:image/png;base64,ZZZ'),
} as unknown as HTMLCanvasElement

const { rasterizeTreeCanvas, canvasToBlob } = vi.hoisted(() => ({
  rasterizeTreeCanvas: vi.fn(async () => fakeCanvas),
  canvasToBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))
vi.mock('@/app/(app)/tree/[id]/_lib/rasterize-tree', () => ({ rasterizeTreeCanvas, canvasToBlob }))

const { treeToPdf } = vi.hoisted(() => ({
  treeToPdf: vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' })),
}))
vi.mock('@/app/(app)/tree/[id]/_lib/tree-to-pdf', () => ({ treeToPdf }))

import { captureTree } from '@/app/(app)/tree/[id]/_lib/capture-tree'

function buildContainer() {
  const container = document.createElement('div')
  document.body.append(container)
  return container
}

describe('captureTree — canvas PNG path (flag on)', () => {
  let clickSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    rasterizeTreeCanvas.mockClear(); canvasToBlob.mockClear(); treeToPdf.mockClear()
    ;(fakeCanvas.toDataURL as ReturnType<typeof vi.fn>).mockClear()
    clickSpy = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

  it('rasterises to a canvas, derives a blob, and downloads a .png', async () => {
    vi.setSystemTime(new Date('2026-06-09T10:00:00Z'))
    const anchor = document.createElement('a')
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tag: string) => (tag === 'a' ? anchor : document.body)) as typeof document.createElement,
    )
    await captureTree(buildContainer(), 'png', 'Smith Family', undefined, 2.5)
    expect(rasterizeTreeCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), 2.5, undefined)
    expect(canvasToBlob).toHaveBeenCalledWith(fakeCanvas)
    expect(treeToPdf).not.toHaveBeenCalled()
    expect(anchor.download).toBe('Smith Family-tree-2026-06-09.png')
    expect(clickSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('skips download when aborted (canvas path returns null)', async () => {
    rasterizeTreeCanvas.mockResolvedValueOnce(null)
    await captureTree(buildContainer(), 'png', 'Smith Family', { aborted: true })
    expect(canvasToBlob).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })
})

describe('captureTree — PDF path', () => {
  let clickSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    rasterizeTreeCanvas.mockClear(); canvasToBlob.mockClear(); treeToPdf.mockClear()
    ;(fakeCanvas.toDataURL as ReturnType<typeof vi.fn>).mockClear()
    clickSpy = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

  it('rasterises, hands the data URL + canvas dims to treeToPdf, downloads .pdf', async () => {
    vi.setSystemTime(new Date('2026-06-09T10:00:00Z'))
    const anchor = document.createElement('a')
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tag: string) => (tag === 'a' ? anchor : document.body)) as typeof document.createElement,
    )
    await captureTree(buildContainer(), 'pdf', 'Smith Family', undefined, 2.5)
    expect(rasterizeTreeCanvas).toHaveBeenCalledWith(expect.any(HTMLElement), 2.5, undefined)
    expect(fakeCanvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect(treeToPdf).toHaveBeenCalledWith(
      'data:image/png;base64,ZZZ',
      { width: 1234, height: 567 },
      'Smith Family',
    )
    expect(canvasToBlob).not.toHaveBeenCalled()
    expect(anchor.download).toBe('Smith Family-tree-2026-06-09.pdf')
    expect(clickSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('skips the PDF download when aborted before raster', async () => {
    rasterizeTreeCanvas.mockResolvedValueOnce(null)
    await captureTree(buildContainer(), 'pdf', 'Smith Family', { aborted: true })
    expect(treeToPdf).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run new test to verify it fails**

Run: `pnpm test -- capture-tree-canvas`
Expected: FAIL — captureTree still always runs the legacy `toBlob` path; it never
calls `rasterizeTreeCanvas` / `treeToPdf`.

- [ ] **Step 5: Refactor `capture-tree.ts` — add branches, keep legacy verbatim**

Update the imports at the top of `capture-tree.ts`:

```ts
import type { ExportFormat } from './export-events'
import { exportFilename } from './export-filename'
import { inlineImages } from './inline-images'
import { inlineLinkStrokes } from './inline-link-strokes'
import { EXPORT_PNG_VIA_CANVAS } from './export-config'
import { rasterizeTreeCanvas, canvasToBlob } from './rasterize-tree'
import { treeToPdf } from './tree-to-pdf'
```

Keep `FALLBACK_BG`, `captureTargetOf`, `awaitPhotoDecode`, `resolveBackground`,
`triggerDownload`, and the `CaptureSignal` interface exactly as they are.

Rename the **current body** of `captureTree` to a private `captureTreePngLegacy`
with the same parameters (this is the verbatim flag-off path):

```ts
/** Legacy PNG path (#218): html-to-image 2-pass toBlob. Flag-off fallback. */
async function captureTreePngLegacy(
  container: HTMLElement,
  treeName: string,
  signal: CaptureSignal | undefined,
  pixelRatio: number,
): Promise<void> {
  // <-- the existing captureTree body goes here UNCHANGED, except it always
  //     downloads as 'png': exportFilename(treeName, 'png').
}
```

Add the canvas PNG path:

```ts
/** Canvas PNG path (#219): shared rasteriser → canvas.toBlob → download. */
async function captureTreePngViaCanvas(
  container: HTMLElement,
  treeName: string,
  signal: CaptureSignal | undefined,
  pixelRatio: number,
): Promise<void> {
  const canvas = await rasterizeTreeCanvas(container, pixelRatio, signal)
  if (!canvas || signal?.aborted) return
  const blob = await canvasToBlob(canvas)
  if (signal?.aborted) return
  triggerDownload(blob, exportFilename(treeName, 'png'))
}
```

Add the PDF path:

```ts
/** PDF path (#219): shared rasteriser → PNG data URL → jspdf → download. */
async function captureTreePdf(
  container: HTMLElement,
  treeName: string,
  signal: CaptureSignal | undefined,
  pixelRatio: number,
): Promise<void> {
  const canvas = await rasterizeTreeCanvas(container, pixelRatio, signal)
  if (!canvas || signal?.aborted) return
  const dataUrl = canvas.toDataURL('image/png')
  const blob = await treeToPdf(dataUrl, { width: canvas.width, height: canvas.height }, treeName)
  if (signal?.aborted) return
  triggerDownload(blob, exportFilename(treeName, 'pdf'))
}
```

Replace the public `captureTree` with the dispatcher:

```ts
export async function captureTree(
  container: HTMLElement,
  format: ExportFormat,
  treeName: string,
  signal?: CaptureSignal,
  pixelRatio = 3,
): Promise<void> {
  if (format === 'pdf') {
    return captureTreePdf(container, treeName, signal, pixelRatio)
  }
  if (EXPORT_PNG_VIA_CANVAS) {
    return captureTreePngViaCanvas(container, treeName, signal, pixelRatio)
  }
  return captureTreePngLegacy(container, treeName, signal, pixelRatio)
}
```

Note: in `captureTreePngLegacy`, the download line becomes
`triggerDownload(blob, exportFilename(treeName, 'png'))` (the old body used
`format`; it's now always `'png'` on this path).

- [ ] **Step 6: Run both capture suites**

Run: `pnpm test -- capture-tree`
Expected: PASS — `capture-tree.test` (legacy, flag mocked false) and
`capture-tree-canvas.test` (flag mocked true + PDF) both green.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/capture-tree.ts \
  src/__tests__/lib/capture-tree.test.ts \
  src/__tests__/lib/capture-tree-canvas.test.ts
git commit -m "feat(#219): branch capture on format + EXPORT_PNG_VIA_CANVAS flag

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: PNG/PDF dropdown (`ExportTreeButton.tsx`)

**Files:**
- Modify: `src/app/(app)/tree/[id]/_components/ExportTreeButton.tsx`
- Modify: `src/__tests__/components/ExportTreeButton.test.tsx`

- [ ] **Step 1: Rewrite the button test for the dropdown**

The Base UI menu opens via pointer events + a portal, which is brittle under
jsdom with no `user-event` dep. Mock the dropdown primitives to render inline so
the test focuses on this component's wiring (which item dispatches which format),
not Base UI internals.

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EXPORT_TREE_EVENT,
  emitExportPending,
  type ExportTreeDetail,
} from '@/app/(app)/tree/[id]/_lib/export-events'
import { ExportTreeButton } from '@/app/(app)/tree/[id]/_components/ExportTreeButton'

// Render the Base UI dropdown inline (no portal / open state) so both the
// trigger button and the menu items are always present and clickable.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ render }: { render: React.ReactElement }) => render,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

describe('ExportTreeButton', () => {
  afterEach(() => vi.restoreAllMocks())

  it('dispatches png from the PNG item and pdf from the PDF item', () => {
    const seen: ExportTreeDetail[] = []
    const handler = (e: Event) => seen.push((e as CustomEvent<ExportTreeDetail>).detail)
    window.addEventListener(EXPORT_TREE_EVENT, handler)

    render(<ExportTreeButton treeName="Smith Family" />)
    fireEvent.click(screen.getByRole('button', { name: /download as png/i }))
    fireEvent.click(screen.getByRole('button', { name: /download as pdf/i }))

    expect(seen).toEqual([
      { format: 'png', treeName: 'Smith Family' },
      { format: 'pdf', treeName: 'Smith Family' },
    ])
    window.removeEventListener(EXPORT_TREE_EVENT, handler)
  })

  it('disables the trigger while a capture is pending and re-enables after', async () => {
    render(<ExportTreeButton treeName="Smith Family" />)
    const trigger = screen.getByRole('button', { name: /export tree/i })
    expect(trigger).toBeEnabled()

    emitExportPending({ pending: true })
    await screen.findByRole('button', { name: /exporting/i })
    expect(screen.getByRole('button', { name: /exporting/i })).toBeDisabled()

    emitExportPending({ pending: false })
    await screen.findByRole('button', { name: /export tree/i })
    expect(screen.getByRole('button', { name: /export tree/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- ExportTreeButton`
Expected: FAIL — current button has no "Download as PNG/PDF" items.

- [ ] **Step 3: Rewrite the component**

```tsx
'use client'
// Header trigger for tree export (#217/#219). A PNG/PDF dropdown that never
// touches the tree DOM: picking a format fires `mtf-export-tree`; FamilyTree
// (via useExportTrigger) does the capture and round-trips `mtf-export-pending`
// so this trigger can disable + spinner while a capture runs.
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { dispatchExportTree, onExportPending } from '../_lib/export-events'

export function ExportTreeButton({ treeName }: { treeName: string }) {
  const [pending, setPending] = useState(false)

  useEffect(() => onExportPending(({ pending }) => setPending(pending)), [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={pending ? 'Exporting tree…' : 'Export tree'}
            title={pending ? 'Exporting tree…' : 'Export tree'}
            disabled={pending}
            className="inline-flex items-center justify-center h-10 w-10 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? (
              <svg
                className="animate-spin h-5 w-5 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <Download className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem onClick={() => dispatchExportTree({ format: 'png', treeName })}>
          Download as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => dispatchExportTree({ format: 'pdf', treeName })}>
          Download as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- ExportTreeButton`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_components/ExportTreeButton.tsx \
  src/__tests__/components/ExportTreeButton.test.tsx
git commit -m "feat(#219): PNG/PDF export dropdown chooser

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Full verification + manual print test

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + lint + full test suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass, zero errors. Fix any TS/lint issues before proceeding
(watch for the unused-`treeName` lint in `tree-to-pdf.ts` — see Task 4 note).

- [ ] **Step 2: Manual smoke — PDF on a photo tree (issue requirement)**

Run the dev stack and exercise the real flow:

Run: `pnpm dev` (and ensure the local Supabase stack is up: `pnpm exec supabase start`)

Verify in the browser on a tree **with photos**:
1. Header Download icon opens a menu with "Download as PNG" / "Download as PDF".
2. **Download as PDF** → a `<TreeName>-tree-YYYY-MM-DD.pdf` downloads.
3. Open the PDF: photos are crisp (lossless), the tree fits on one page,
   orientation matches the tree's shape, and the footer reads
   `Generated from meetthefam · <today UTC>` in the bottom margin.
4. **Download as PNG** still works and is unchanged.
5. Print or print-preview the PDF and confirm it fits A4/A3 sensibly.

- [ ] **Step 3: Cross-browser + flag-off check**

1. Repeat the PDF export in **Safari** — confirm photos + connector lines render
   (the inline-images / inline-strokes fixes carry through the canvas path).
2. Set `NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS=false` in `.env.local`, restart `pnpm dev`,
   and confirm **PNG** export still works (legacy path) and PDF is unaffected.
   Remove/reset the var afterwards.

- [ ] **Step 4: Open the draft PR**

Push the branch and open a **draft** PR targeting the **epic** branch, following
`.github/pull_request_template.md` (pre-tick local gates, leave manual-checklist
boxes for the reviewer):

```bash
git push -u origin feat/219-pdf-export
gh pr create --draft --base feat/60-tree-export \
  --title "feat: PDF export + footer/watermark (#219)" \
  --body "$(cat <<'EOF'
## Summary
Adds a single-page PDF export option alongside PNG, layering on the #218 PNG
pipeline. PNG/PDF dropdown chooser; shared `toCanvas` rasteriser feeding either
`canvas.toBlob` (PNG, behind the `EXPORT_PNG_VIA_CANVAS` flag) or jspdf (PDF);
pure A4/A3 + orientation + scale-to-fit geometry; `Generated from meetthefam ·
YYYY-MM-DD` footer; lossless image embed.

## Closes
Closes #219

## Test plan
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test`
- [ ] Manual: PDF export on a photo tree (crisp, one page, footer) — see plan Task 8
- [ ] Manual: Safari export (photos + lines)
- [ ] Manual: `EXPORT_PNG_VIA_CANVAS=false` reverts PNG to legacy path
EOF
)"
```

Set the **v1.2 — Export & archival** milestone on the PR (via the GitHub UI or
`gh pr edit --milestone "v1.2 — Export & archival"`). Do not mark ready / merge —
the user reviews and marks ready.

---

## Self-Review (completed during planning)

- **Spec coverage:** dropdown chooser (Task 7) ✓; dynamic jspdf + addImage from PNG pipeline (Tasks 4–6) ✓; single-page A4/A3 fit (Task 2) ✓; footer `Generated from meetthefam · YYYY-MM-DD` (Tasks 3–4) ✓; filename `<TreeName>-tree-YYYY-MM-DD.pdf` (reused `exportFilename`, Task 6) ✓; print test on a photo tree (Task 8) ✓; feature flag (Task 1) ✓; lossless embed (Task 4, `addImage(..., 'PNG', ...)`) ✓.
- **Out of scope** (tiled full-tree, templates, SSR) — not planned. ✓
- **Type consistency:** `CaptureSignal` exported from `capture-tree.ts`, imported by `rasterize-tree.ts`; `PdfImageDims`/`PdfPagePlan` from `pdf-page-plan.ts` consumed by `tree-to-pdf.ts`; `rasterizeTreeCanvas(container, pixelRatio, signal)` + `canvasToBlob(canvas)` signatures match across Tasks 5/6; `treeToPdf(dataUrl, dims, treeName, date?)` matches between Tasks 4/6; `EXPORT_PNG_VIA_CANVAS` boolean consistent across Tasks 1/6. ✓
- **Placeholders:** none — every code/test step contains full content.
