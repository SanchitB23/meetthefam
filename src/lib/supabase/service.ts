import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS entirely.
 *
 * Use ONLY for trusted server-side operations that legitimately need to read
 * data the anon key cannot access (e.g. resolving an invite token before the
 * requesting user has been verified as the correct recipient).
 *
 * Never expose this client to the browser or return its data unfiltered to
 * untrusted callers.  All call sites should be in Server Components or Server
 * Actions — never in Route Handlers that forward raw rows to clients.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'createServiceRoleClient: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set',
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      // Service-role clients must NOT persist sessions or auto-refresh tokens.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
