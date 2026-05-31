/**
 * Shared vitest mock for `@/lib/supabase/client` + `@/lib/actions/signOut`.
 *
 * Six tests (the four status-page renderers in `src/__tests__/app/` +
 * `StatusPageShell` + the two `SiteFooter`/`AuthFooterLink` component tests)
 * each transitively render `<AuthFooterLink />`, which calls the browser
 * Supabase client on mount and embeds the `signOut` server action via a
 * `<form action={signOut}>`. Under jsdom we don't want either to hit the
 * real network / server-action runtime — so every test ends up declaring the
 * same ~11-line `vi.mock` block.
 *
 * This helper centralises that boilerplate. Import it before the SUT (the
 * `vi.mock` calls below run at module-load time and the helper is hoisted by
 * the test file's own `import` ordering):
 *
 * ```ts
 * import { mockSupabaseClient } from '@/__tests__/helpers/supabaseClientMock'
 * mockSupabaseClient() // signed-out default; no-op signOut
 *
 * // …or, for tests that need to assert calls / override per case:
 * import {
 *   mockSupabaseClient,
 *   getUserMock,
 *   signOutMock,
 * } from '@/__tests__/helpers/supabaseClientMock'
 *
 * beforeEach(() => {
 *   mockSupabaseClient({ user: { id: 'u_1', email: 'a@b.c' } as User })
 * })
 * ```
 *
 * NOTE: `vi.mock` is hoisted to the top of the file that contains it, so the
 * `vi.mock(...)` calls in this module run when the helper is first imported.
 * That means **the test file must import this helper before importing the
 * code under test** — otherwise the real `@/lib/supabase/client` module will
 * already be in the registry and the mock won't take effect.
 */
import { vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

// `vi.hoisted` runs before any `vi.mock` factory below, so the mock fns exist
// at the time the factories are invoked. Keeps a single shared instance per
// test file that both this helper and consuming tests can poke.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  clientSignOut: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.clientSignOut,
    },
  }),
}))

vi.mock('@/lib/actions/signOut', () => ({
  signOut: mocks.signOut,
}))

/** Mock for `supabase.auth.getUser()`. Exposed for `expect(...).toHaveBeenCalled()`. */
export const getUserMock = mocks.getUser

/** Mock for the `signOut` server action imported from `@/lib/actions/signOut`. */
export const signOutMock = mocks.signOut

/** Mock for the browser-client's `auth.signOut()`. Rarely asserted on, but exposed for parity. */
export const clientSignOutMock = mocks.clientSignOut

/**
 * Reset both mocks and default-configure `getUser()` for the given user
 * (defaults to a signed-out viewer). Call at the top of the file for tests
 * that don't need per-case overrides, or in `beforeEach` for tests that do.
 *
 * Returns the controllable mock handles for convenience (same instances as
 * the named exports — the choice is purely stylistic).
 */
export function mockSupabaseClient(
  opts: { user?: Partial<User> | null } = {},
) {
  const { user = null } = opts
  mocks.getUser.mockReset()
  // Tests rarely care about the full `User` shape — components only check
  // truthiness / `id` / `email`. Cast the partial through `unknown` so the
  // mock return preserves the real `getUser` return type for type-aware
  // assertions, without forcing each test to construct a complete `User`.
  mocks.getUser.mockResolvedValue({
    data: { user: user as User | null },
    error: null,
  })
  mocks.signOut.mockReset()
  mocks.clientSignOut.mockReset()
  return {
    getUserMock: mocks.getUser,
    signOutMock: mocks.signOut,
    clientSignOutMock: mocks.clientSignOut,
  }
}
