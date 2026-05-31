/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// LoginPage now renders <SiteFooter>, which transitively renders
// <AuthFooterLink> — a client island that calls the browser Supabase client
// on mount and embeds the signOut server action. Mock both via the shared
// helper so jsdom doesn't try to instantiate a real Supabase client (which
// would fail without NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).
import { mockSupabaseClient } from '@/__tests__/helpers/supabaseClientMock'
mockSupabaseClient()

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}))

import LoginPage from '@/app/login/page'

async function renderPage(params: Record<string, string> = {}) {
  const searchParams = Promise.resolve(params)
  const jsx = await LoginPage({ searchParams })
  return render(jsx)
}

describe('LoginPage error rendering', () => {
  it('renders <ErrorAlert> with mapped copy for auth_callback_failed', async () => {
    await renderPage({ error: 'auth_callback_failed' })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(
      screen.getByText('Authentication could not be completed. Try signing in again.'),
    ).toBeTruthy()
  })

  it('renders <ErrorAlert> with mapped copy for email_rate_limit', async () => {
    await renderPage({ error: 'email_rate_limit' })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(
      screen.getByText('Too many sign-in attempts. Wait a few minutes and try again.'),
    ).toBeTruthy()
  })

  it('renders <ErrorAlert> with mapped copy for email_required', async () => {
    await renderPage({ error: 'email_required' })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Please enter your email address.')).toBeTruthy()
  })

  it('has role="alert" and aria-live="polite" on the error element', async () => {
    const { container } = await renderPage({ error: 'auth_callback_failed' })
    const el = container.querySelector('[role="alert"]')
    expect(el).not.toBeNull()
    expect(el?.getAttribute('aria-live')).toBe('polite')
  })

  it('renders no alert when no error param is present', async () => {
    await renderPage({})
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
