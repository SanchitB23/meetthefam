// src/__tests__/lib/capture-tree.test.ts
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { captureTree } from '@/app/(app)/tree/[id]/_lib/capture-tree'

describe('captureTree (stub)', () => {
  it('resolves without producing a file (placeholder for #218)', async () => {
    const el = document.createElement('div')
    await expect(captureTree(el, 'png')).resolves.toBeUndefined()
  })
})
