import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Must be hoisted before the route import
const exchangeMock = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [],
    set: vi.fn(),
    setAll: vi.fn(),
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: exchangeMock,
    },
  }),
}))

import { GET } from '@/app/auth/callback/route'

describe('auth/callback GET', () => {
  beforeEach(() => {
    exchangeMock.mockReset()
  })

  it('redirects to auth_callback_failed on exchange failure', async () => {
    exchangeMock.mockResolvedValue({ error: { message: 'Invalid code' } })
    const req = new NextRequest('http://localhost:3000/auth/callback?code=bad')
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('error=auth_callback_failed')
  })

  it('does NOT use the old auth_error tag', async () => {
    exchangeMock.mockResolvedValue({ error: { message: 'Invalid code' } })
    const req = new NextRequest('http://localhost:3000/auth/callback?code=bad')
    const res = await GET(req)
    expect(res.headers.get('location')).not.toContain('auth_error')
  })

  it('redirects to auth_callback_failed when no code param is provided', async () => {
    const req = new NextRequest('http://localhost:3000/auth/callback')
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('error=auth_callback_failed')
  })

  it('redirects to /dashboard on successful exchange', async () => {
    exchangeMock.mockResolvedValue({ error: null })
    const req = new NextRequest('http://localhost:3000/auth/callback?code=good')
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('respects the ?next param on success', async () => {
    exchangeMock.mockResolvedValue({ error: null })
    const req = new NextRequest(
      'http://localhost:3000/auth/callback?code=good&next=%2Ftree%2F123',
    )
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/tree/123')
  })
})
