# Provider linking — OAuth + magic-link with the same email

> **Issue:** [#186](https://github.com/SanchitB23/meetthefam/issues/186) — _question: does OAuth + magic-link with the same email merge into one Supabase auth user?_
> **Milestone:** v1.1 — Post-launch polish
> **Date:** 2026-06-03
> **Type:** Investigation + documentation + conditional config/code fix

## Problem

A user can authenticate two ways (per [`auth-and-rls.md`](../../architecture/auth-and-rls.md)): **email magic link** (primary) and **Google OAuth** (secondary). If someone signs in with Google using `x@example.com` and later requests a magic link for the same `x@example.com` (or vice-versa), Supabase Auth must resolve both to **one `auth.users` row** for the rest of the app to be correct.

Why it matters: `tree_members.user_id`, the `tree_invites` accept flow, and `profiles.id` all assume **one user per email**. If the second sign-in created a *separate* `auth.users` row (or rejected the login), an invite sent to `x@example.com` would attach to whichever auth row the invitee happened to log into — a silent data-integrity bug in a multi-tenant app.

## Expected behavior (hypothesis)

Per current Supabase docs (`/supabase/supabase`, identity-linking guide):

> "Supabase Auth automatically links identities with the same email address to a single user… When a new user signs in with OAuth, Supabase Auth will attempt to look for an existing user that uses the same email address. If a match is found, the new identity is linked to the user… it would be insecure to automatically link an identity to a user with an **unverified** email address."

Two consequences:

1. **Automatic linking is the default and is not a toggle.** The "Allow same email for different providers" wording in the issue is dated. What *is* toggleable is **manual** linking (`linkIdentity()`), which is **disabled by default** and which this app does not use.
2. **Linking is gated on a verified email.** Google returns verified emails; magic-link verifies via the click. Both our flows produce confirmed identities, so the docs predict a **merge**: one `auth.users` row with two `auth.identities` rows.

Expected answer: **merged.** The live test exists to *prove* it and to catch any surprise.

## Goal & success criteria

A user authenticating with Google OAuth and magic-link using the **same email** resolves to **one `auth.users` row** (multiple `auth.identities`), keeping `tree_members.user_id`, `tree_invites`, and `profiles.id` stable.

Done when:

- [ ] Merge proven empirically on QA for **both orderings**.
- [ ] Behavior documented in `auth-and-rls.md` under a new "Provider linking" section.
- [ ] Prod (`ycns…`) auth config confirmed to match QA (parity).
- [ ] Code audited for one-user-per-email assumptions; fix applied only if the live test contradicts the hypothesis.

## Test plan — QA, interactive browser

Run against the **QA Vercel preview + QA Supabase (`ljjvwtpifmoshfknlbaj`)**. Claude drives the browser via the Chrome extension; the user completes the Google consent screen and clicks magic links in their inbox.

**Observation** — after each auth step, query QA Supabase:

```sql
select id, email, created_at from auth.users where email = :addr;
select user_id, provider, created_at from auth.identities
  where identity_data->>'email' = :addr order by created_at;
```

Merge = **1** `auth.users` row + **2** `auth.identities` rows.

**Matrix — both orderings** (the data-integrity worry hinges on which provider arrives second):

| Run | Step 1 | Step 2 | Expected |
|-----|--------|--------|----------|
| 1 | Google OAuth (real gmail) | Magic-link, same gmail | 1 user, 2 identities |
| 2 | Magic-link (same gmail) | Google OAuth, same gmail | 1 user, 2 identities |

Constraints:

- Google OAuth must use the **real** gmail address (no `+` aliasing — the addresses must match for linking to be tested).
- Magic-link is rate-limited (~3–4/hr per project — see SMTP rate-limit note). We send ~2–3 links total; within budget but pace accordingly.
- Between Run 1 and Run 2, delete the throwaway QA user so the second ordering starts clean:
  `delete from auth.users where email = :addr;` (QA only, throwaway account).

## Decision tree

- **Merge (expected):** document as confirmed; verify manual linking stays disabled (no `linkIdentity()` in our flow); **no config change**.
- **No-merge** (2nd attempt creates a new `auth.users` row, or errors "already registered"): diagnose the failure mode —
  - **Unverified email on one side** → enable/confirm email-confirmation so both identities are verified; automatic linking then engages. Least code.
  - **Automatic linking genuinely not firing** → enable **manual identity linking** in QA Auth settings **and** add a post-login `linkIdentity()` step to attach the second provider to the existing user.
  - Re-run the full matrix to confirm linking now occurs. Document the chosen fix + rationale.

The desired end state is **automatic linking works** — the contingency exists to reach it, not to accept a non-linking world.

## Prod parity (`ycnsgkotrbjifsjkqmvn`)

After QA behavior is settled, read prod's auth config and confirm it matches QA. v1.0 has launched, so prod config changes are now permitted — but GoTrue auth settings are **not migrations** (they are set via the Dashboard / Management API), so any prod config change is an **explicit, approval-gated step** surfaced to the user before touching prod.

## Documentation deliverable

New **"Provider linking"** section in `docs/architecture/auth-and-rls.md`, covering:

- The confirmed merge behavior and the verified-email gating.
- That automatic linking is the default and manual linking stays off.
- The QA/prod auth-setting state.
- The test evidence (row counts from both orderings).

## Code audit

Verify the one-user-per-email assumption holds across:

- `tree_members.user_id` resolution.
- The `tree_invites` accept flow — how an emailed invite attaches to a user on accept.
- `profiles.id` (= auth user id).

If merge holds, expect **no code change**. If the live test contradicts the hypothesis, the §"Decision tree" fix lands here.

## Out of scope

- A user-facing "merge my two existing accounts" UI (no evidence such accounts exist; revisit only if found during the audit).
- Adding/removing OAuth providers.
- Custom SMTP ([#25](https://github.com/SanchitB23/meetthefam/issues/25)).

## Verification

The live QA matrix **is** the verification — automatic identity linking is Supabase platform behavior, not app logic, so no new automated test is added for the happy path. The documented row-count evidence is the artifact. If the contingency fix adds a `linkIdentity()` code path, that path gets a focused test.
