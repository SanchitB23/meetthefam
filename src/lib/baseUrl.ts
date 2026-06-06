import { headers } from 'next/headers'

/**
 * Returns the origin (e.g. https://meetthefam.com) for building absolute
 * URLs in server contexts — Server Components, Server Actions, Route
 * Handlers. Reads from the `origin` request header; falls back to
 * `http://localhost:3000` for local dev / tests that don't supply one.
 *
 * Replaces the three previously-duplicated copies in
 * tree/[id]/members/actions.ts, tree/[id]/share/actions.ts, and
 * tree/[id]/page.tsx.
 */
export async function getBaseUrl(): Promise<string> {
  const headersList = await headers()
  return headersList.get('origin') ?? 'http://localhost:3000'
}
