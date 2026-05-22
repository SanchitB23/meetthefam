import { describe, expect, it } from 'vitest'
import { mapErrorCode } from '@/lib/errors'

const TYPED_CODES = [
  'auth_error',
  'auth_callback_failed',
  'email_required',
  'email_invalid',
  'email_rate_limit',
  'not_signed_in',
  'forbidden',
  'not_found',
  'not_found_or_revoked',
  'self_spouse',
  'cross_tree',
  'ancestor_cycle',
  'unknown',
] as const

describe('mapErrorCode', () => {
  it('returns mapped copy for a known code', () => {
    const result = mapErrorCode('auth_error')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toBe('Something went wrong.')
  })

  it('returns the provided fallback for an unknown code', () => {
    const result = mapErrorCode('totally_unknown_xyz', 'Custom fallback.')
    expect(result).toBe('Custom fallback.')
  })

  it('returns default "Something went wrong." when code unknown and no fallback given', () => {
    const result = mapErrorCode('totally_unknown_xyz')
    expect(result).toBe('Something went wrong.')
  })

  it('returns the "unknown" entry for the unknown code key', () => {
    const result = mapErrorCode('unknown')
    expect(result).toBe('Something went wrong.')
  })

  it('covers all typed error codes — every seeded tag has a mapped entry', () => {
    for (const code of TYPED_CODES) {
      const result = mapErrorCode(code)
      expect(result, `mapErrorCode('${code}') should return a non-empty string`).toBeTruthy()
      expect(result, `mapErrorCode('${code}') should not fall back to default`).not.toBe(
        mapErrorCode('__unmapped__'),
      )
    }
  })

  it('returns a string without exclamation marks for every seeded code', () => {
    for (const code of TYPED_CODES) {
      const result = mapErrorCode(code)
      expect(result, `'${code}' copy should not contain exclamation marks`).not.toContain('!')
    }
  })
})
