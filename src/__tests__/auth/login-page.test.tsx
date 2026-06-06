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

// next/navigation mock: include useSearchParams / useRouter / usePathname so
// <ToastFromSearchParams> (which LoginPage now embeds) can mount in jsdom.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/login',
}))

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
  // Errors are now surfaced via <ToastFromSearchParams> (client toast), not an
  // inline <ErrorAlert>. These tests verify that the inline alert element is
  // NOT rendered — the toast path is covered by the bridge's own test suite.

  it('does not render an inline alert for auth_callback_failed (toast path)', async () => {
    await renderPage({ error: 'auth_callback_failed' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not render an inline alert for email_rate_limit (toast path)', async () => {
    await renderPage({ error: 'email_rate_limit' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not render an inline alert for email_required (toast path)', async () => {
    await renderPage({ error: 'email_required' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders no alert when no error param is present', async () => {
    await renderPage({})
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
