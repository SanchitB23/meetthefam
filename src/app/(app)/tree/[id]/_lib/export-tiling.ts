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
  /** Bleed between adjacent tiles (native px). Must be < the page content box. */
  overlapPx?: number
  /** Print resolution for mm ↔ px conversion. Keep in sync with pdf-page-plan. */
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
  /**
   * Printable content box of each page (mm). NOTE: the LAST tile in a row /
   * column usually covers less than this box — consumers must size each
   * placed image from the tile itself (pxToMm(sw / pixelRatio)), never from
   * this box, or partial tiles will stretch.
   */
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

/**
 * Plan a row-major grid of canvas-px source rects for slicing one rendered
 * canvas into A4 pages. Evaluates both orientations; fewest pages wins,
 * tie → landscape.
 */
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

  // A bleed as large as the content box would make the grid step ≤ 0 —
  // Infinity columns (browser hang) or negative counts. Fail loudly instead.
  if (overlapPx >= best.contentWpx || overlapPx >= best.contentHpx) {
    throw new RangeError(
      `overlapPx (${overlapPx}) must be smaller than the page content box ` +
        `(${best.contentWpx.toFixed(0)}×${best.contentHpx.toFixed(0)} px at ${dpi} DPI)`,
    )
  }

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
