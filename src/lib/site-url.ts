/**
 * Canonical base URL for sitemap / robots / og-image absolute URLs.
 *
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL (set manually in Vercel env vars)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (auto-injected by Vercel, server-side only)
 *   3. http://localhost:3000 (local dev)
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
