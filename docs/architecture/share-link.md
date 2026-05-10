# Share link mechanics

Read-only public access to a tree via an unguessable URL. Owner-controlled toggle, no signup required for the viewer.

## States

A tree's `share_token` column has three meaningful states:

| `share_token` value | What it means |
|---|---|
| `NULL` | Sharing **off**. `/share/<anything>` returns 404. |
| `<32-byte random>` | Sharing **on**. The URL `/share/<that-token>` works for anyone with the link. |

## Owner controls (in tree settings modal)

- **"Enable read-only share link"** → mints a 32-byte random token, sets `share_token`.
- **Copy URL** → returns `https://meetthefam.app/share/<token>`.
- **"Regenerate token"** → mints a new random value; the old URL stops working immediately.
- **"Disable sharing"** → sets `share_token = NULL`; URL stops working.

All four flows are Server Actions on the owner-only path (RLS allows `UPDATE trees` for owner only).

## Token generation

```ts
const token = crypto.randomBytes(32).toString('base64url')  // 43 chars, URL-safe
```

256 bits of entropy. Brute-forcing a valid token is computationally infeasible.

## `/share/[token]` Route Handler

```
GET /share/<token>
  │
  ▼
Server-side handler with createClient using SUPABASE_SERVICE_ROLE_KEY
  │
  ▼
SELECT id, name, description FROM trees WHERE share_token = $1
  │
  ├── no row → return 404
  │
  ▼
SELECT * FROM people WHERE tree_id = <id>
  │
  ▼
Transform to family-chart shape
  │
  ▼
Render <FamilyTree readOnly={true} /> + signup banner
```

## Why service_role and not anon-key

- **anon key** is RLS-checked. The viewer has no session, so `auth.uid() IS NULL`, and the `trees` SELECT policy fails. Nothing returns.
- **service_role** bypasses RLS entirely. We can SELECT any tree in the table.

Trade-off: this Route Handler is the *only* place service_role runs against the people / trees tables. The token check is the gate. Any code path that uses service_role must verify a token before returning data.

This is documented in [`../adrs/0005-three-environments.md`](../adrs/0005-three-environments.md) — the service_role secret is environment-scoped and never crosses the browser.

## Read-only banner

The shared view shows a sticky top banner:

> "You're viewing a shared family tree. **[Create your own]** ↗"

Click → `/signup`. Conversion path from share recipients to new users is the only growth loop in v1.0.

## What the share link does NOT include

- **Editor controls** — no add / edit / delete buttons even visible. Read-only `<FamilyTree>`.
- **Member list** — share viewers don't see who's in `tree_members`.
- **Audit trail** — viewers don't see who created what.
- **Photos** — yes, photos are visible (they're already on a public-read bucket; the share token gates the *tree*, not the storage).
