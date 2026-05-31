/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders a Sign out form that invokes the signOut action when submitted', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u_1', email: 'a@b.c' } },
      error: null,
    })
    const { AuthFooterLink } = await import('@/components/layout/AuthFooterLink')
    render(<AuthFooterLink />)

    const button = await screen.findByRole('button', { name: /sign out/i })
    const form = button.closest('form')
    expect(form).not.toBeNull()

    // Submit the form. We use submit() rather than click() so React's form-action
    // dispatch (which would otherwise call the real server action) gives the
    // mocked function instead. jsdom's HTMLFormElement.requestSubmit + the
    // <form action={signOut}> binding together result in signOut being called
    // with the form's FormData.
    fireEvent.submit(form!)
    expect(signOutActionMock).toHaveBeenCalledTimes(1)
  })
})
