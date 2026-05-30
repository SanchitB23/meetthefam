import { describe, expect, it } from 'vitest'
import { isPublicPath } from '@/lib/public-routes'

describe('isPublicPath', () => {
  it('treats the legal / marketing pages as public (no login required)', () => {
    expect(isPublicPath('/privacy')).toBe(true)
    expect(isPublicPath('/terms')).toBe(true)
    expect(isPublicPath('/contact')).toBe(true)
  })

  it('keeps landing, login, and auth callbacks public', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it('still gates authenticated app routes', () => {
    expect(isPublicPath('/dashboard')).toBe(false)
    expect(isPublicPath('/tree/abc-123')).toBe(false)
    expect(isPublicPath('/invite/some-token')).toBe(false)
  })

  it('does not treat `/` as a prefix of every route', () => {
    // `/` matches only exactly — otherwise it would make the whole app public.
    expect(isPublicPath('/dashboard')).toBe(false)
  })
})
