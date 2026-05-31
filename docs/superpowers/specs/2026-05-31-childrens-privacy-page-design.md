# Children's Privacy standalone page — design

> Spec for [#139](https://github.com/SanchitB23/meetthefam/issues/139) — splitting the interim
> children's-privacy section (`/privacy` §7) into a standalone COPPA-style notice with an explicit
> delete-on-request path. Child of the [#56](https://github.com/SanchitB23/meetthefam/issues/56)
> umbrella; deferred from the launch-gate subset ([#137](https://github.com/SanchitB23/meetthefam/issues/137)).
> Authored via `superpowers:brainstorming` on 2026-05-31. Builds on the launch-gate routing +
> styling pattern in [`2026-05-30-legal-pages-design.md`](2026-05-30-legal-pages-design.md).

## Goal

Lift the short interim children's-privacy section that currently lives in `/privacy` §7 into a
dedicated `/childrens-privacy` page — a fuller, COPPA-style children's notice — and reduce `/privacy`
§7 to a brief pointer so there is a single canonical source of children's-privacy text.

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **`/privacy` §7 relationship** | Shrink §7 to a 1–2 sentence pointer that links to `/childrens-privacy` | Avoids two copies of children's-privacy legal text drifting apart; the new page is canonical. |
| **Legal framing** | COPPA-style *structure*, framing consistent with the India/DPDP Privacy Policy | The issue says "COPPA-style"; the rest of the site is DPDP-flavored. We adopt the dedicated-children's-notice structure (no child accounts, relative-responsible consent, no profiling, delete-on-request) without citing US COPPA by name. Under-13 is mentioned explicitly. |
| **Footer link** | Leave `SiteFooter` as-is (Privacy · Terms · Contact · Sign in) | Discoverable via the §7 cross-link; avoids touching `SiteFooter` + its test while sibling legal-page branches (`/dmca`, `/about`) are in flight. |
| **Content format** | Plain TSX Server Component + `<Prose>` wrapper, mirroring `privacy/page.tsx` | Matches the launch-gate pattern; zero new deps. |
| **Effective date** | 30 May 2026 | Consistent with the other legal pages (same content cycle). |

> **Content caveat (spec-level, not an on-page banner):** the copy is operator-adapted boilerplate,
> **not** lawyer-reviewed. It reflects the app's current practices to the best of our knowledge. Have
> counsel review before relying on it. (Standard "Last updated" date present; no heavy disclaimer banner,
> consistent with the sibling legal pages.)

## Architecture

```
src/app/(legal)/
  childrens-privacy/page.tsx   # NEW — /childrens-privacy: exports metadata + page
  privacy/page.tsx             # EDIT — §7 body shrunk to a pointer
src/lib/public-routes.ts       # EDIT — add '/childrens-privacy' to PUBLIC_PATHS
src/__tests__/components/
  childrens-privacy-page.test.tsx  # NEW — lightweight render guard
src/__tests__/lib/
  public-routes.test.ts        # EDIT — assert /childrens-privacy is public
```

**Public-route allowlist:** route groups don't appear in the URL, so the auth proxy
(`src/proxy.ts`) can't infer that a `(legal)` page is public from its pathname — the
allowlist in `src/lib/public-routes.ts` is explicit. `/childrens-privacy` must be added
there, or signed-out visitors are bounced to `/login`.

The new page is a Server Component (no client interactivity). It renders inside the existing
`(legal)/layout.tsx` (logo header + shared `<SiteFooter>`) and inherits that layout's
`export const dynamic = 'force-static'`, so it ships as cached HTML. Page remains indexable
(no `noindex`).

## Page content — `/childrens-privacy`

**Metadata**

- `title`: `Children's Privacy · meetthefam`
- `description`: `How meetthefam handles information about children in family trees, and how to request its removal.`

**Sections** (wrapped in `<Prose>`, visible **"Last updated: 30 May 2026"**):

Intro — family trees naturally include children, sometimes under 13; this notice supplements the
[Privacy Policy](/privacy).

1. **Who this applies to** — children, including under-13s, whose info a relative adds to a tree;
   meetthefam is used by the adults who build trees, is not directed to children, and does not
   knowingly let under-13s create their own accounts.
2. **The uploading relative is responsible for consent** — by adding a child's details you confirm
   you are a parent or entitled relative and are responsible for any consent required under
   applicable law; you decide what is shared and with whom (including share-link recipients).
3. **What information about a child may appear** — only what a relative enters: name, optional photo,
   optional dates (e.g. birth date), optional short bio, parent / child / spouse relationships.
4. **How we use it** — only to display the tree to its owner and invited editors; no advertising,
   no profiling, no sale, no use to contact the child.
5. **How to have a child's data removed (delete-on-request)** — any editor can delete a person or a
   whole tree in-app (removes records + uploaded photos from storage); a parent/guardian who is not
   an editor can email `hello.mtf@sanchitb23.in` to request removal, and we action it.
6. **How we protect it** — Row-Level Security tenant isolation; encryption at rest; hashed,
   revocable share-link tokens (consistent with `/privacy` §8).
7. **Contact** — `hello.mtf@sanchitb23.in`.

## `/privacy` §7 rewrite

Heading text ("7. Children's data") unchanged so the 1–10 section numbering stays intact; only the
body paragraph changes to:

> Family trees often include children, including those under 13. The relative who adds a child's
> information is responsible for any consent required under applicable law. See our **Children's
> Privacy notice** (`/childrens-privacy`) for the full detail, including how to request removal of a
> child's data.

The internal link uses a plain `<a href="/childrens-privacy">` to match the file's existing anchor
style (the page imports no `next/link`).

## Testing

Static content, no business logic. Gate: `pnpm typecheck && pnpm lint && pnpm test` all pass.
One lightweight Vitest render test (mirroring `Prose.test.tsx`) asserts the new page renders its
"Children's Privacy" heading and links back to `/privacy`. `SiteFooter` untouched, so
`SiteFooter.test.tsx` is unaffected.

## Constraints honored

- **No prod changes pre-v1.0** — app-code page only; no DB, no Vercel-config, no migrations.
  Ships to local + QA and rides the next feature release.
- **Issue-anchored workflow** — branch `feat/139-childrens-privacy-page`; PR `Closes #139` with the
  `v1.0 — Launch` milestone; #56 remains the open umbrella tracker.
