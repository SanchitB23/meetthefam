'use client'
// src/app/(app)/tree/[id]/_lib/export-events.ts
// Trigger-seam event contract for tree export (#217). Mirrors the existing
// `mtf-add-pending` / `mtf-add-relative` CustomEvent patterns in this folder.
// The capture work lives in FamilyTree (via useExportTrigger); the header
// button is a dumb trigger. `format` rides the contract from day one even
// though #217's stub ignores it — #218 reads it without a contract change.

export const EXPORT_TREE_EVENT = 'mtf-export-tree' as const
export const EXPORT_PENDING_EVENT = 'mtf-export-pending' as const

export type ExportFormat = 'png' | 'pdf'
// treeName rides the contract so the capture step can build the download
// filename (`<TreeName>-tree-YYYY-MM-DD.<ext>`) without re-reading the DOM/page.
export type ExportTreeDetail = { format: ExportFormat; treeName: string }
export type ExportPendingDetail = { pending: boolean }

export function dispatchExportTree(detail: ExportTreeDetail): void {
  window.dispatchEvent(new CustomEvent(EXPORT_TREE_EVENT, { detail }))
}

export function onExportTree(cb: (detail: ExportTreeDetail) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ExportTreeDetail>).detail)
  window.addEventListener(EXPORT_TREE_EVENT, handler)
  return () => window.removeEventListener(EXPORT_TREE_EVENT, handler)
}

export function emitExportPending(detail: ExportPendingDetail): void {
  window.dispatchEvent(new CustomEvent(EXPORT_PENDING_EVENT, { detail }))
}

export function onExportPending(cb: (detail: ExportPendingDetail) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ExportPendingDetail>).detail)
  window.addEventListener(EXPORT_PENDING_EVENT, handler)
  return () => window.removeEventListener(EXPORT_PENDING_EVENT, handler)
}
