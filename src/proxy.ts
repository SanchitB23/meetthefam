import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from '@/lib/public-routes'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // IMPORTANT: do not run code between createServerClient and getUser().
  // Mistakes here cause silent random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  // Public routes (landing, login, auth callbacks, and the legal / marketing
  // pages) must reach the page even when signed out — see src/lib/public-routes.
  // The landing's Server Component itself handles the "if authed, redirect to
  // /dashboard" branch, so unauthed hits must NOT be bounced to /login here.
  const isPublic = isPublicPath(pathname)

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    // Preserve the intended destination so the login page can redirect back
    // after authentication.  This is especially important for /invite/* routes
    // where the token is part of the path and must survive the round-trip.
    const next = request.nextUrl.pathname
    url.pathname = '/login'
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // Protected routes: everything except:
  //   _next   — Next.js internals
  //   .*\..*  — static assets (files with a dot in the name)
  //   share   — public share-link route (Phase 7, anon-readable by design)
  //
  // /invite/* is intentionally NOT in the skip-list — unauthenticated visits
  // are redirected to /login?next=<path> so the user returns to the invite
  // after signing in (per Phase 6 accept-invite-flow spec).
  matcher: ['/((?!_next|.*\\..*|share).*)'],
}
