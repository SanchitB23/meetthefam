/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'

// Centralised mock for `@/lib/supabase/client` + `@/lib/actions/signOut`.
// `signOutMock` is the controllable handle for asserting the server action
// was invoked when the form is submitted.
import {
  mockSupabaseClient,
  signOutMock,
} from '@/__tests__/helpers/supabaseClientMock'

describe('<AuthFooterLink />', () => {
  beforeEach(() => {
    // Defaults to signed-out; per-case overrides re-call the helper below.
    mockSupabaseClient()
  })

  it('renders a Sign in link when the viewer is signed out', async () => {
    const { AuthFooterLink } = await import('@/components/layout/AuthFooterLink')
    render(<AuthFooterLink />)

    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders a Sign out form that invokes the signOut action when submitted', async () => {
    mockSupabaseClient({ user: { id: 'u_1', email: 'a@b.c' } })
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
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })
})
