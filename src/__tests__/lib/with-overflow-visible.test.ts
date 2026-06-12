// src/__tests__/lib/with-overflow-visible.test.ts
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { withOverflowVisible } from '@/app/(app)/tree/[id]/_lib/with-overflow-visible'

describe('withOverflowVisible', () => {
  it('forces overflow visible during the callback and restores it after', async () => {
    const el = document.createElement('div')
    el.style.overflow = 'hidden'

    let seenDuring = ''
    const result = await withOverflowVisible(el, () => {
      seenDuring = el.style.overflow
      return 42
    })

    expect(seenDuring).toBe('visible')
    expect(el.style.overflow).toBe('hidden') // restored
    expect(result).toBe(42)
  })

  it('restores overflow even if the callback throws', async () => {
    const el = document.createElement('div')
    el.style.overflow = 'hidden'
    await expect(
      withOverflowVisible(el, () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(el.style.overflow).toBe('hidden')
  })
})
