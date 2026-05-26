import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture redirect calls — redirect() throws to stop execution, so tests
// wrap the action call in try/catch and inspect `lastRedirect` afterwards.
let lastRedirect: string | null = null

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    lastRedirect = url
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;push;${url}` })
  },
}))

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'origin' ? 'http://localhost:3000' : null),
  }),
}))

const otpMock = vi.fn()
const oauthMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signInWithOtp: otpMock,
      signInWithOAuth: oauthMock,
    },
  }),
}))

import { signInWithMagicLink, signInWithGoogle } from '@/app/login/actions'

function makeForm(fields: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('signInWithMagicLink', () => {
  beforeEach(() => {
    lastRedirect = null
    otpMock.mockReset()
  })

  it('redirects to email_required when email is missing', async () => {
    try { await signInWithMagicLink(makeForm()) } catch {}
    expect(lastRedirect).toBe('/login?error=email_required')
  })

  it('redirects to email_rate_limit for rate-limit OTP errors', async () => {
    otpMock.mockResolvedValue({
      error: { message: 'For security purposes, you can only request this after 60 seconds — rate limit exceeded' },
    })
    try { await signInWithMagicLink(makeForm({ email: 'test@example.com' })) } catch {}
    expect(lastRedirect).toBe('/login?error=email_rate_limit')
  })

  it('redirects to email_invalid for invalid-email OTP errors (message match)', async () => {
    otpMock.mockResolvedValue({ error: { message: 'invalid email address provided' } })
    try { await signInWithMagicLink(makeForm({ email: 'bad-email' })) } catch {}
    expect(lastRedirect).toBe('/login?error=email_invalid')
  })

  it('redirects to email_invalid for OTP errors with status 422', async () => {
    otpMock.mockResolvedValue({ error: { message: 'Unprocessable entity', status: 422 } })
    try { await signInWithMagicLink(makeForm({ email: 'bad@' })) } catch {}
    expect(lastRedirect).toBe('/login?error=email_invalid')
  })

  it('redirects to unknown for unrecognized OTP errors', async () => {
    otpMock.mockResolvedValue({ error: { message: 'Internal server error' } })
    try { await signInWithMagicLink(makeForm({ email: 'test@example.com' })) } catch {}
    expect(lastRedirect).toBe('/login?error=unknown')
  })

  it('redirects to /login?sent=true on success', async () => {
    otpMock.mockResolvedValue({ error: null })
    try { await signInWithMagicLink(makeForm({ email: 'test@example.com' })) } catch {}
    expect(lastRedirect).toContain('/login?sent=true')
    expect(lastRedirect).toContain('email=test%40example.com')
  })
})

describe('signInWithGoogle', () => {
  beforeEach(() => {
    lastRedirect = null
    oauthMock.mockReset()
  })

  it('redirects to unknown when OAuth returns an error', async () => {
    oauthMock.mockResolvedValue({ data: null, error: { message: 'Provider error' } })
    try { await signInWithGoogle(makeForm()) } catch {}
    expect(lastRedirect).toBe('/login?error=unknown')
  })

  it('redirects to unknown when OAuth returns no URL', async () => {
    oauthMock.mockResolvedValue({ data: { url: null }, error: null })
    try { await signInWithGoogle(makeForm()) } catch {}
    expect(lastRedirect).toBe('/login?error=unknown')
  })
})
