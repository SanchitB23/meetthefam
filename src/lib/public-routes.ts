/**
 * Routes reachable WITHOUT a session.
 *
 * The auth proxy (src/proxy.ts) redirects signed-out visitors to /login for
 * any path NOT matched here. Public legal / marketing pages — the `(legal)`
 * route group (/privacy, /terms, /contact, /about, /childrens-privacy, /dmca
 * today; /faq, /cookies, /accessibility, … as the #56 children ship) — must
 * stay reachable without logging in. Route groups don't appear in the URL, so
 * the proxy can't infer "this is a public page" from the pathname; the
 * allowlist is explicit. Add new public pages here as they land.
 *
 * Note: the `/share/[token]` route is kept public a different way — it's
 * excluded from the proxy matcher entirely (see src/proxy.ts config).
 */
export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/auth',
  '/privacy',
  '/terms',
  '/contact',
  '/about',
  '/childrens-privacy',
  '/dmca',
  '/faq',
  '/_spike', // SPIKE #215 — remove with the probe
] as const

/**
 * True when `pathname` is a public route (exact match, or a sub-path of one,
 * e.g. `/auth/callback`). `/` only matches exactly — it is never treated as a
 * prefix of every route.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}
