// src/app/(app)/tree/[id]/_lib/capture-tree.ts
// STUB for #217. The trigger seam (button → event → FamilyTree → this fn)
// is fully wired and tested, but the actual rasterisation is deferred to
// #218, which will dynamic-import `html-to-image`, embed photos as data
// URLs (CORS handled by #216), and trigger the download. Until then this
// resolves immediately so the seam is observable end-to-end.
import type { ExportFormat } from './export-events'

export async function captureTree(
  _container: HTMLElement,
  _format: ExportFormat,
): Promise<void> {
  // #218: replace with real html-to-image capture + download.
  await Promise.resolve()
}
