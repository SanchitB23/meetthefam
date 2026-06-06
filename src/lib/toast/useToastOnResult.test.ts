import { describe, it, expect } from 'vitest'
import { pickToast } from './useToastOnResult'

describe('pickToast', () => {
  it('returns null for null/undefined state', () => {
    expect(pickToast(null, { success: 'ok' })).toBeNull()
  })

  it('fires success for { ok: true }', () => {
    expect(pickToast({ ok: true }, { success: 'Saved' })).toEqual({ channel: 'success', message: 'Saved' })
  })

  it('fires success for legacy { success: true }', () => {
    expect(pickToast({ success: true }, { success: 'Created' })).toEqual({ channel: 'success', message: 'Created' })
  })

  it('fires error for { ok: false, error } via the mapper', () => {
    expect(pickToast({ ok: false, error: 'unknown' }, { error: (c) => `E:${c}` }))
      .toEqual({ channel: 'error', message: 'E:unknown' })
  })

  it('returns null when no matching message is configured', () => {
    expect(pickToast({ ok: true }, { error: () => 'x' })).toBeNull()
  })

  it('success accepts a function of state', () => {
    expect(
      pickToast({ ok: true, name: 'Smiths' } as never, {
        success: (s) => `Created ${(s as unknown as { name: string }).name}`,
      }),
    ).toEqual({ channel: 'success', message: 'Created Smiths' })
  })
})
