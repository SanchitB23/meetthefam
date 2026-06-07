import { describe, expect, it } from 'vitest'
import { exportFilename } from '@/app/(app)/tree/[id]/_lib/export-filename'

describe('exportFilename', () => {
  const date = new Date('2026-06-07T10:30:00Z')

  it('builds <TreeName>-tree-YYYY-MM-DD.<ext>', () => {
    expect(exportFilename('Smith Family', 'png', date)).toBe(
      'Smith Family-tree-2026-06-07.png',
    )
  })

  it('uses the format as the extension', () => {
    expect(exportFilename('Smith Family', 'pdf', date)).toBe(
      'Smith Family-tree-2026-06-07.pdf',
    )
  })

  it('strips path-unsafe characters from the tree name', () => {
    expect(exportFilename('A/B:C*?"<>|D', 'png', date)).toBe(
      'ABCD-tree-2026-06-07.png',
    )
  })

  it('collapses whitespace and trims', () => {
    expect(exportFilename('  My   Big\tTree  ', 'png', date)).toBe(
      'My Big Tree-tree-2026-06-07.png',
    )
  })

  it('falls back to "family" when the name is empty after sanitising', () => {
    expect(exportFilename('   ///   ', 'png', date)).toBe(
      'family-tree-2026-06-07.png',
    )
  })
})
