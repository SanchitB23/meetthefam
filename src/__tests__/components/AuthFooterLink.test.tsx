/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const signOutActionMock = vi.fn()
vi.mock('@/app/(app)/_actions/signOut', () => ({
  signOut: signOutActionMock,
}))

// Mock the browser Supabase client at module-load time.
const getUserMock = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
      signOut: vi.fn(),
    },
  }),
}))

describe('<AuthFooterLink />', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    signOutActionMock.mockReset()
  })

  it('renders a Sign in link when the viewer is signed out', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const { AuthFooterLink } = await import('@/components/layout/AuthFooterLink')
    render(<AuthFooterLink />)

    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders a Sign out form when the viewer is signed in', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_1', email: 'a@b.c' } },
      error: null,
    })
    const { AuthFooterLink } = await import('@/components/layout/AuthFooterLink')
    render(<AuthFooterLink />)

    const button = await screen.findByRole('button', { name: /sign out/i })
    // The button lives inside a <form action={signOut}> — its enclosing form
    // exists and has action wired. We only assert the button is rendered and
    // submittable here; the actual signOut() call is exercised by the
    // existing signOut action's own tests.
    expect(button).toBeInTheDocument()
    expect(button.closest('form')).not.toBeNull()
  })
})
