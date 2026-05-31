/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  }),
}))

// SiteFooter embeds <AuthFooterLink />, which calls the browser client +
// the `signOut` server action (also reached via SignOutButton in the (app)
// layout for the composition test). Centralised mock keeps jsdom inert.
import { mockSupabaseClient } from '@/__tests__/helpers/supabaseClientMock'
mockSupabaseClient()

import AppNotFound from '@/app/(app)/not-found'
import AppLayout from '@/app/(app)/layout'

function hrefs(container: HTMLElement) {
  return Array.from(container.querySelectorAll('a')).map((a) =>
    a.getAttribute('href'),
  )
}

describe('(app) not-found boundary', () => {
  it('shows the branded not-found heading', async () => {
    const { container } = render(await AppNotFound())
    expect(container.textContent).toMatch(/couldn.t find that page/i)
  })

  it('does NOT emit the shared footer itself — the (app) layout owns it', async () => {
    // Wrapping this boundary in StatusPageShell would double the header +
    // footer, because (app)/layout already renders both. Keep it bare.
    const { container } = render(await AppNotFound())
    expect(hrefs(container)).not.toContain('/privacy')
  })

  it('composes with (app)/layout to render exactly one footer (no doubling)', async () => {
    const { container } = render(
      AppLayout({ children: await AppNotFound() }),
    )
    const privacyLinks = hrefs(container).filter((h) => h === '/privacy')
    expect(privacyLinks).toHaveLength(1)
  })
})
