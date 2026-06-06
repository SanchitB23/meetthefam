# Spike #70 — App-wide Notification System (Design Spec)

> Authored via `superpowers:brainstorming` for [#70](https://github.com/SanchitB23/meetthefam/issues/70)
> (milestone **v1.1 — Post-launch polish**). This is the spike's written recommendation; the Copy column
> in §6 is the *input* to #68 (friendly error mapping), not its final strings.

---

## Context

meetthefam has **no app-wide notification surface**. Server Action feedback today is either an inline
`text-destructive` paragraph inside the host form, or **silent dismissal** — many actions close their
sheet/modal on success with no confirmation. When the resulting change isn't visible on the next render
(e.g. an orphan person created without a `linkSpec` never appears on the focus-rooted canvas), the user
can reasonably believe the action failed.

This spike decides the **surface** (the toast primitive + plumbing). It does **not** write the friendly
error copy — that's #68's job. Output: this written recommendation + a throwaway `spike/notification-system`
prototype firing one success + one warn + one error from real Server Actions.

**Decisions locked with the user:**
1. **Deliverable** — spec → plan → then actually build the prototype.
2. **Destructive actions** — confirmation toast only, **no Undo** (Undo flagged as a future ticket; no soft-delete work).
3. **Plumbing** — **one `notify` API, two call-site adapters** (no refactor of existing call sites).
4. **Library** — **sonner** (no bake-off; shadcn's own Toast is deprecated upstream in favour of sonner).

---

## §1 — Architecture overview

A **single sonner `<Toaster>`** mounted once in the **root `layout.tsx`**, fed by a thin **`notify`
wrapper module** (`src/lib/toast/notify.ts`) that is the one toast API. Existing surfaces stay and get a
clear division of labour:

| Surface | Component | When |
|---|---|---|
| **Toast** (transient) | sonner via `notify.*` | Post-action confirmation, esp. when the host sheet/modal closes on success |
| **Inline alert** (form-scoped) | existing `ErrorAlert` (`variant="inline"`) | Validation/errors while the user is still *in* the form (name required, photo too large, link-constraint violations mid-dialog) |
| **Banner** (page-level) | existing `ErrorAlert variant="banner"` | Persistent page state (access revoked while page open; "you've joined the Smiths" welcome) |

Toasts **do not replace** `ErrorAlert`. Mid-form errors stay inline — a toast is wrong when the user is
still in the form. `notify` + `ErrorAlert` share the same `color-mix` token approach so they read as one family.

## §2 — The `notify` module + two adapters

`src/lib/toast/notify.ts` (client) wraps sonner and centralizes channel → method, duration, aria:

| Channel | sonner call | aria role | duration | action affordance |
|---|---|---|---|---|
| Success | `toast.success` | `status` | 2s | rare |
| Info | `toast` / `toast.info` | `status` | 4s | no |
| Warn | `toast.warning` | `alert` | 6s | often ("Link now") |
| Error | `toast.error` | `alert` | sticky (dismiss only) | sometimes |

**Two call-site adapters — one API, matched to each existing calling convention:**
- **Imperative callers** (`createPerson`, `updatePerson`, `setSpouse`, photo, share, members):
  `const res = await action(); res.ok ? notify.success(…) : notify.error(friendly(res.error))`.
- **`useActionState` forms** (`createTree` / `renameTree` / `deleteTree`):
  a tiny `useToastOnResult(state, { success, error })` hook wrapping `useEffect` keyed on state identity.

`notify` consumes **already-friendly strings**. Code→copy mapping is #68's; a `friendlyActionError()`
helper already exists in `invite/[token]/page.tsx` and is the model to generalize.

## §3 — Mount point

Single `<Toaster />` in **root `layout.tsx`** (next to `VersionFooter`). Covers every route incl. public
ones; cheaper than per-route-group mounting. The read-only share viewer won't fire toasts but is harmless
to include.

**Auth/redirect actions** (`signInWithMagicLink`, `signInWithGoogle`, `acceptInviteAction`) can't call a
client toaster — they `redirect()` with query params. Bridge = a small `<ToastFromSearchParams>` client
component that reads `?error` / `?sent` / `joined` on mount, fires the toast, strips the param. Mechanism
defined here; full wiring lands in the rollout ticket.

## §4 — a11y, mobile, motion

- **Position**: `top-center` on mobile (dodges the bottom-right FAB *and* bottom-sheet handles), `bottom-right`
  on desktop — driven by the existing `src/components/ui/use-is-desktop.ts` hook.
- **aria**: per-channel roles above (`status` for success/info, `alert` for warn/error); verify sonner
  defaults at prototype.
- **Dismiss**: tap / swipe-to-dismiss + per-channel auto timers; errors sticky.
- **Reduced-motion**: rely on sonner's `prefers-reduced-motion` handling; verify in prototype.
- **Persistence**: none across navigation (keep simple).

## §5 — Theming

Heirloom-journal palette via `<Toaster toastOptions={{ classNames: {...} }} />` + CSS vars, mapping
`--background` / `--primary` / `--accent` / `--destructive` / `--foreground` (OKLCH, from `globals.css`).
No hard-coded hex. Reuses the `color-mix(in oklch, …)` tint pattern `ErrorAlert` already uses.

---

## §6 — Q1 catalogue (the heart of the spike)

Surface legend: **T** = toast, **I** = inline `ErrorAlert`, **B** = banner, **—** = no notification (visual change is the feedback).
Channel: **S**uccess / **I**nfo / **W**arn / **E**rror. Copy is *suggested* (final strings owned by #68).

### dashboard/actions.ts
| Action · outcome | Channel | Surface | Copy |
|---|---|---|---|
| `createTree` success | S | T | "Created '{name}'" |
| `createTree` validation (name req / too long / desc too long) | E | I | (inline, mid-form) |
| `createTree` `not_signed_in` / `unknown` | E | T | "Couldn't create the tree. Please try again." |
| `renameTree` success | S | T | "Renamed to '{name}'" |
| `renameTree` validation | E | I | (inline, mid-form) |
| `renameTree` `unknown` | E | T | "Couldn't rename. Please try again." |
| `deleteTree` success | S | T | "Deleted '{name}'" |
| `deleteTree` `unknown` | E | T | "Couldn't delete the tree. Please try again." |

### tree/[id]/actions.ts
| Action · outcome | Channel | Surface | Copy |
|---|---|---|---|
| `createPerson` success (linked) | S | T | "Added {name}" |
| `createPerson` success but **orphan** (no `linkSpec`) | W | T + action | "Added {name} — not linked yet. They won't show on the tree until you link them." · **Link now** |
| `createPerson` validation (name/nickname/bio/year/date) | E | I | (inline, mid-form) |
| `createPerson` link RPC fail (`self_spouse`/`cross_tree`/`ancestor_cycle`) — row persisted, dialog closed | E | T | mapped string (#68); e.g. "{name} was added, but the relationship couldn't be set: …" |
| `createPerson` `unknown` | E | I/T | "Couldn't add the person. Please try again." |
| `updatePerson` success | S | T | "Saved" (subtle) |
| `updatePerson` no-op (empty diff) | — | — | (nothing — nothing changed) |
| `updatePerson` validation / invalid tone | E | I | (inline, mid-form) |
| `updatePerson` `unknown` | E | T | "Couldn't save changes. Please try again." |
| `uploadPersonPhoto` success | — | — | photo swaps in — visual change IS the feedback |
| `uploadPersonPhoto` file too large / empty / wrong type | E | I | (inline, mid-form) |
| `uploadPersonPhoto` storage/DB `unknown` (form may be closed) | E | T | "Photo upload failed. Please try again." |
| `removePersonPhoto` success | — | — | photo clears — visual feedback |
| `removePersonPhoto` `unknown` | E | T | "Couldn't remove the photo. Please try again." |
| `deletePerson` success | S | T | "Deleted {name}" (no Undo) |
| `deletePerson` `unknown` | E | T | "Couldn't delete the person. Please try again." |
| `setSpouse` success | S | T | "Linked {a} & {b}" |
| `setSpouse` RPC (`self_spouse`/`cross_tree`/`ancestor_cycle`) — mid-dialog | E | I | mapped string (#68) |
| `setParents` success | S | T | "Parents set for {name}" |
| `setParents` RPC (`cross_tree`/`ancestor_cycle`) — mid-dialog | E | I | mapped string (#68) |
| `clearSpouse` success | S | T | "Removed the spouse link" |
| `clearSpouse` `unknown` | E | T | "Couldn't remove the link. Please try again." |

### tree/[id]/members/actions.ts
| Action · outcome | Channel | Surface | Copy |
|---|---|---|---|
| `inviteEditor` success | S | I + T | inline link preview (artefact) + S toast on copy-to-clipboard |
| `inviteEditor` `already_invited` (returns existing URL) | W | I | amber inline card (existing) |
| `inviteEditor` `invalid_email` | E | I | (inline, mid-form) |
| `inviteEditor` `unknown` / `not_signed_in` | E | T | "Couldn't send the invite. Please try again." |
| `revokeInvite` success | S | T | "Invite revoked" |
| `revokeInvite` `not_found_or_revoked` / `unknown` | E | T | "Couldn't revoke the invite." |
| `resendInvite` success | S | T | "Invite resent" |
| `resendInvite` `not_found` / `unknown` | E | T | "Couldn't resend the invite." |
| `acceptInvite` success (via inline action → redirect) | S | B | banner on landing: "You've joined {tree}." (first visit) |
| `acceptInvite` `not_found`/`revoked`/`expired`/`email_mismatch`/`already_accepted`/`unknown` | E | I/B | query-param-bridged; mapped string (#68) |
| `revokeMember` success | S | T | "Member removed" |
| `revokeMember` `not_found_or_not_editor` / `unknown` | E | T | "Couldn't remove the member." |
| `getMembersAndInvites` `not_authorized` / `unknown` (lazy query) | E | I | inline in the members panel (not a toast) |

### tree/[id]/share/actions.ts
| Action · outcome | Channel | Surface | Copy |
|---|---|---|---|
| `enableShareLink` success | S | T | "Share link enabled" + S toast on copy |
| `regenerateShareToken` success | W | T | "New link created — the old link no longer works" |
| `disableShareLink` success | S | T | "Share link disabled" |
| share `forbidden` / `unknown` / `not_signed_in` | E | T | "Couldn't update the share link." |

### Auth / redirect actions (query-param bridged via `<ToastFromSearchParams>`)
| Action · outcome | Channel | Surface | Copy |
|---|---|---|---|
| `signInWithMagicLink` success (`?sent=true`) | I | T/I | "Check your inbox for the sign-in link." |
| `signInWithMagicLink` `email_rate_limit` | W | I | "Too many requests — wait a few minutes and try again." |
| `signInWithMagicLink` `email_required`/`email_invalid`/`unknown` | E | I | mapped string (#68) |
| `signInWithGoogle` `unknown` | E | I | "Google sign-in failed. Please try again." |
| `auth/callback` failure (`/login?error=…`) | E | I | persistent inline (covered by #68) |
| RLS denial mid-session (editorship revoked, action returns `forbidden`) | E | B | "You no longer have access to this tree." + dashboard CTA |

## §7 — Prototype scope (`spike/notification-system`)

Throwaway branch wiring the issue's motivating cases from **real** Server Actions on a dev tree:
1. **Success** — `createPerson` ok → `notify.success("Added {name}")`
2. **Warn** — `createPerson` ok but orphan (no `linkSpec`) → `notify.warning("Added — not linked yet…", { action: "Link now" })`
3. **Error** — link RPC (`self_spouse`/`cross_tree`/`ancestor_cycle`) → `notify.error(friendly(code))`

Plus: install `sonner`, mount `<Toaster>` in root layout, ship `notify.ts` + `useToastOnResult`, theme to
heirloom tokens, verify reduced-motion + mobile `top-center` placement against the FAB.

## §8 — Implementation-ticket sketch (deliverable #5)

**Rollout ticket** (separate, post-spike):
- Files: `src/lib/toast/notify.ts`, `src/lib/toast/useToastOnResult.ts`, `<Toaster>` in `src/app/layout.tsx`,
  `<ToastFromSearchParams>` for auth, per-call-site wiring across the 4 `actions.ts` consumers per §6.
- **Depends on #68** for error copy; **complements #69** (orphan warn helps even before #69 lands).
- Sequencing: land after #68 so error strings exist. Size ≈ 1–1.5 days.

## §9 — Open questions for product (deliverable #4)

1. **Undo** — confirmed out for now; revisit as its own ticket? (delete person/tree, revoke member)
2. **`updatePerson` success toast** — show subtle "Saved", or stay silent since edits are routine + visible?
3. **"You've joined {tree}" banner** — first-visit only; where does the "first visit" flag live (session vs query param)?
4. **Copy clipboard toasts** (invite/share) — confirm we want a toast on every copy, not just enable/regen.

## Verification (prototype)
- `pnpm install` (adds sonner), `pnpm typecheck`, `pnpm lint`.
- `pnpm dev` + local Supabase; on a dev tree: add a linked person (success toast), add an orphan (warn + Link now), force a link RPC error (error toast).
- Manually confirm: mobile `top-center` clears the FAB; `prefers-reduced-motion` disables slide; aria roles via devtools.

---

## Appendix — Server Action inventory (24 actions, 120 outcomes)

Source for §6. Full per-outcome breakdown lives in the brainstorm transcript; counts:

| Action | File | Outcomes |
|---|---|---|
| `createTree` / `renameTree` / `deleteTree` | dashboard/actions.ts | 6 / 5 / 3 |
| `createPerson` / `updatePerson` | tree/[id]/actions.ts | 14 / 15 |
| `uploadPersonPhoto` / `removePersonPhoto` / `deletePerson` | tree/[id]/actions.ts | 7 / 3 / 3 |
| `setSpouse` / `setParents` / `clearSpouse` | tree/[id]/actions.ts | 3 / 3 / 3 |
| `inviteEditor` / `revokeInvite` / `resendInvite` / `acceptInvite` / `revokeMember` / `getMembersAndInvites` | tree/[id]/members/actions.ts | 5 / 4 / 4 / 8 / 4 / 3 |
| `enableShareLink` / `regenerateShareToken` / `disableShareLink` | tree/[id]/share/actions.ts | 4 / 4 / 4 |
| `acceptInviteAction` (inline) | invite/[token]/page.tsx | 3 |
| `signInWithMagicLink` / `signInWithGoogle` / `signOut` | login + lib/actions | 5 / 2 / 1 |
