// src/app/(app)/tree/[id]/_lib/export-filename.ts
// Builds the download filename for an exported tree: `<TreeName>-tree-YYYY-MM-DD.<ext>`.
// Pure + side-effect-free so it's unit-testable away from the DOM capture path.
import type { ExportFormat } from './export-events'

// Characters illegal in filenames across Windows / macOS / Linux.
const PATH_UNSAFE = /[/\\:*?"<>|]/g

function sanitiseTreeName(name: string): string {
  const cleaned = name
    .replace(PATH_UNSAFE, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'family'
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

export function exportFilename(
  treeName: string,
  format: ExportFormat,
  date: Date = new Date(),
): string {
  return `${sanitiseTreeName(treeName)}-tree-${isoDate(date)}.${format}`
}
