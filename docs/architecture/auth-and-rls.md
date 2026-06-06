# Auth + Row-Level Security

## Auth mechanisms

- **Email magic link** — primary login + signup. No password fields.
- **Google OAuth** — secondary, one-click.
- No password-reset flows because there are no passwords. See [`../adrs/0004-magic-link-only-no-passwords.md`](../adrs/0004-magic-link-only-no-passwords.md).

## Provider linking — same email across providers

When a user authenticates with **Google OAuth** and **email magic link** using the
*same* email address, Supabase Auth always resolves them to **one `auth.users`
row** — never a duplicate account. This is GoTrue's default; manual identity
linking (`linkIdentity()`) is **disabled and unused**. Linking is gated on a
**verified email** — Google returns verified emails and the magic-link/OTP click
sets `email_confirmed_at`.

The *mechanism* depends on which provider arrives second (both verified live on QA
in issue #186):

- **Google first, then magic-link:** the OTP **signs into the existing user by
  email** — `last_sign_in_at` bumps, no new identity row is created (the account
  keeps its single `google` identity). No `email` identity is minted.
- **Magic-link first, then Google:** the Google sign-in **automatically links** a
  new `google` identity onto the existing email user — one `auth.users` row, **two
  `auth.identities`** (`email` + `google`).

Either ordering yields **one email = one `user_id`**, which is what the rest of the
app depends on.

**Why it's load-bearing.** `accept_invite` (the SECURITY DEFINER RPC in
`supabase/migrations/20260513211135_tree_invites.sql`) attaches
`tree_members.user_id` to `auth.uid()` and gates on
`auth.users.email = tree_invites.email`. Because both providers resolve to one
`user_id`, an invitee who later switches login provider keeps the same membership —
no orphaned second account. The `/invite/[token]` page's email-mismatch gate and
`profiles.id = auth.users.id` keying rely on the same guarantee.

**Settings state:** QA (`ljjvwtpifmoshfknlbaj`) and prod (`ycnsgkotrbjifsjkqmvn`)
both have email confirmation on and manual linking off.

**Evidence (issue #186, QA, 2026-06-03):**
- Run 1 (Google → magic-link), user `09c335e2…`: stayed **1 user / 1 `google`
  identity**; OTP authenticated the same user.
- Run 2 (magic-link → Google), user `c1bc423f…`: **1 user / 2 identities**
  (`email` created 21:47, `google` linked 21:48).
- Prod parity: 3 users / 3 distinct emails / **0 duplicate-email rows**, and 1
  prod user already carries multiple linked identities — automatic linking is live
  on prod.

**Code audit (issue #186):** `accept_invite`, the invite-page email gate, and
`profiles` keying all rely on one-user-per-email, which the merge guarantee
satisfies — **no code change required**.

## Session management

- Supabase session lives in a secure `httpOnly` cookie, set by `@supabase/ssr`.
- Server Components and Server Actions read the session via `createServerClient(...)` from `@supabase/ssr`. **In Next.js 16 `cookies()` and `headers()` from `next/headers` are async** — every server-side Supabase client must `await` them when wiring the cookie adapter. Use Context7 MCP for the current snippet.
- Client Components that need the session use `createBrowserClient(...)`.

## Auth boundary — `proxy.ts`, not `middleware.ts`

Phase 1 introduces the auth gate that protects `/dashboard`, `/tree/*`, etc. **Use `proxy.ts` at the repo root, not `middleware.ts`.** Reasons:

- Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts` to make the network boundary explicit.
- `proxy.ts` runs on the Node.js runtime — required for `@supabase/ssr` (Edge runtime can't reach our Supabase URL with full functionality).
- The exported function is `proxy`, not `middleware`. Same `NextRequest` / `NextResponse` API.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  // ...refresh session, redirect unauthenticated traffic to /login
}

export const config = {
  matcher: ['/((?!_next|.*\\..*|share).*)'],  // skip /share/[token] — auth not required there
}
```

See [`../adrs/0007-nextjs-16-and-async-idioms.md`](../adrs/0007-nextjs-16-and-async-idioms.md) for the broader rationale.

## Auth UI

- **Custom form**, not `@supabase/auth-ui-react`. The prebuilt component is dated and hard to style; a custom form is ~50 lines and matches the rest of the app.

## Row-Level Security (RLS) — multi-tenancy enforcement

RLS policies are the single source of truth for "who can read / write what." Every table has RLS enabled. Below is the policy intent — actual SQL lives in `supabase/migrations/` once Phase 0 lands.

### `trees`

```
SELECT  → caller owns the tree, OR caller is in tree_members for it
UPDATE  → caller owns the tree
DELETE  → caller owns the tree
INSERT  → caller is the owner_id (you can only create trees you own)
```

### `tree_members`

```
SELECT  → caller is the user_id of the row, OR caller owns the tree
INSERT  → caller owns the tree
UPDATE  → caller owns the tree (changing roles)
DELETE  → caller owns the tree, OR caller is the user_id (leaving the tree)
```

### `people`

```
SELECT  → caller owns the tree OR is a member of it
INSERT  → caller is owner or editor on the tree
UPDATE  → caller is owner or editor on the tree
DELETE  → caller is owner or editor on the tree
```

### `profiles`

```
SELECT  → public (so we can show display_name / avatar of any user shown in members list)
INSERT  → caller is creating their own row (caller.id = profiles.id)
UPDATE  → caller is updating their own row
DELETE  → caller is deleting their own row
```

### Storage (the `photos` bucket)

```
SELECT (row-level, storage.objects)   → caller is owner or editor on the tree referenced in the path prefix
INSERT                                → same
UPDATE                                → same
DELETE                                → same
```

**Two layers of SELECT.** The `photos` bucket has `public = true`, which means anyone with the file URL can GET the file via storage-api's HTTP path — that's the "public photo URL" property the product needs. That public-read happens at the HTTP layer and bypasses `storage.objects` RLS entirely.

The row-level SELECT policy above is separate: it controls who can SELECT rows from the `storage.objects` table over Postgres / the REST API. It's needed because `supabase-js`'s `storage.from('photos').upload(...)` runs `INSERT ... RETURNING` under the hood, and PostgreSQL requires a permissive SELECT policy for the RETURNING clause even on a successful INSERT. The tighter (per-tree-membership) shape — vs a broad `bucket_id = 'photos'` shape — clears the Supabase advisor's `public_bucket_allows_listing` warning by blocking cross-tree listing, while still letting the upload-and-return path succeed (the just-inserted row is on a tree the user is an editor of).

The path convention `trees/<tree_id>/people/<person_id>/avatar.jpg` lets every policy parse the tree_id from the path and check membership via `public.is_tree_editor(((storage.foldername(name))[2])::uuid)`. See [`photo-upload.md`](photo-upload.md).

## Read-only share link — bypasses RLS

`/share/[token]` is a Route Handler that uses the **`service_role`** Supabase key (server-only env var, never exposed to the client). With service_role, RLS is bypassed.

The 256-bit random `share_token` *is* the credential. The handler:

1. Reads the token from the URL.
2. `SELECT * FROM trees WHERE share_token = $1` — if no row, return 404.
3. `SELECT * FROM people WHERE tree_id = <found-tree-id>`.
4. Renders `<FamilyTree>` in read-only mode.

See [`share-link.md`](share-link.md) for token generation, regeneration, and revocation.

## Testing RLS — non-skippable

Every multi-tenant SaaS gets bitten by RLS holes. Per the spec's testing strategy, RLS tests are the **one tier we don't skip**:

- User A creates a tree with people.
- User B (not a member) is verified to be unable to SELECT, UPDATE, or DELETE any of A's rows.
- User C (an editor) is verified to be unable to UPDATE the tree's `owner_id` or membership rows.

These live in Vitest + a Supabase test client (uses three separate user sessions to simulate roles).
