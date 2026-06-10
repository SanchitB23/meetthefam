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

  it('defaults to true when the env var is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS', '')
    expect(await loadFlag()).toBe(true)
  })

  it('defaults to true when the env var is absent', async () => {
    delete process.env.NEXT_PUBLIC_EXPORT_PNG_VIA_CANVAS
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
