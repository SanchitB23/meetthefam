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
