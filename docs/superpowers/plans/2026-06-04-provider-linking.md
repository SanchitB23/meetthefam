# Provider Linking (OAuth + magic-link same email) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empirically confirm (and, if needed, enforce) that Google OAuth and email magic-link sign-ins with the same address resolve to one `auth.users` row, then document the behavior and audit the code that assumes one-user-per-email.

**Architecture:** This is an investigation-led change, not a feature build. A human-in-the-loop live test on QA (Claude drives the browser via the Chrome extension; the user completes the Google consent screen and clicks magic links) produces ground-truth row counts from `auth.users` / `auth.identities`. A decision tree branches on the result: the expected "merge" path is document-only; the "no-merge" path adds an auth-config or `linkIdentity()` fix. Prod parity is verified read-only and any prod change is approval-gated.

**Tech Stack:** Supabase Auth (GoTrue automatic identity linking), `@supabase/ssr`, Next.js 16 Server Actions/Route Handlers, Supabase MCP (`execute_sql`), Chrome browser extension for the interactive flow.

**Spec:** `docs/superpowers/specs/2026-06-03-provider-linking-design.md`

**Environments:**
- QA Supabase project ref: `ljjvwtpifmoshfknlbaj` (live test target)
- Prod Supabase project ref: `ycnsgkotrbjifsjkqmvn` (parity check only, approval-gated)

**Working location:** worktree `.claude/worktrees/186-provider-linking`, branch `docs/186-provider-linking` (already created + spec committed).

---

## Pre-flight inputs (gather before Task 1)

These come from the user, not the codebase:

1. **QA Vercel preview URL** for the login page (e.g. `https://meetthefam-git-qa-<...>.vercel.app/login`).
2. **A real throwaway Gmail address** the user controls and can complete a Google sign-in with (no `+` aliasing — Google OAuth and magic-link must use the *identical* address).
3. Confirmation the **Chrome extension** browser is connected (so Claude can navigate; the user takes over for consent + inbox).

If any are missing, stop and ask before Task 1.

---

## Observation queries (reused throughout)

Run via Supabase MCP `execute_sql` against `project_id = ljjvwtpifmoshfknlbaj`. Substitute `:addr` with the throwaway gmail (lowercase).

**Q-users** — how many auth rows exist for the email:
```sql
select id, email, created_at, last_sign_in_at
from auth.users
where lower(email) = lower('REPLACE_WITH_ADDR')
order by created_at;
```

**Q-identities** — which providers are linked, and to which user:
```sql
select i.user_id, i.provider, i.created_at,
       (i.identity_data->>'email') as identity_email
from auth.identities i
where lower(i.identity_data->>'email') = lower('REPLACE_WITH_ADDR')
order by i.created_at;
```

**Interpretation:**
- **MERGE (expected):** Q-users returns **1** row; Q-identities returns **2** rows (`google` + `email`) sharing the same `user_id`.
- **NO-MERGE:** Q-users returns **2** rows, OR the second sign-in errored before creating an identity (Q-identities returns 1). Either triggers the Task 5 contingency.

---

### Task 1: Pre-flight verification

**Files:** none (read-only checks).

- [ ] **Step 1: Confirm worktree + branch**

Run:
```bash
git -C .claude/worktrees/186-provider-linking branch --show-current
```
Expected: `docs/186-provider-linking`

- [ ] **Step 2: Confirm the throwaway email starts clean on QA**

Run **Q-users** and **Q-identities** with the chosen address.
Expected: both return **0 rows**. If they return rows, run the cleanup from Task 3 first, then re-check.

- [ ] **Step 3: Confirm QA preview login page loads**

Navigate the Chrome extension browser to the QA preview `/login` URL.
Expected: the login page renders with both "magic link" and "Continue with Google" affordances.

---

### Task 2: Live test — Run 1 (Google OAuth → magic-link)

**Files:** none (live + observation).

- [ ] **Step 1: Start Google OAuth**

In the browser, click "Continue with Google". **Hand off to the user** to complete the Google consent screen with the throwaway gmail.
Expected: redirect back to `/auth/callback` then `/dashboard` (signed in).

- [ ] **Step 2: Observe after OAuth**

Run **Q-users** + **Q-identities**.
Expected: Q-users = 1 row; Q-identities = 1 row, `provider = google`.
Record both outputs verbatim (used as doc evidence in Task 7).

- [ ] **Step 3: Sign out**

Navigate to the app's sign-out (or clear the session): in the browser, trigger logout so the next flow starts unauthenticated.
Expected: redirected to `/login`.

- [ ] **Step 4: Request a magic link (same email)**

Enter the **same** gmail in the magic-link form and submit. **Hand off to the user** to open the email and click the link.
Expected: redirect back through `/auth/callback` to `/dashboard` (signed in).
Note: magic-link is rate-limited (~3–4/hr per project) — if it errors with `email rate limit exceeded`, pause and resume after the window.

- [ ] **Step 5: Observe after magic-link**

Run **Q-users** + **Q-identities**.
Expected (MERGE): Q-users = **1** row (same `id` as Step 2); Q-identities = **2** rows (`google` + `email`) sharing that `user_id`.
Record both outputs verbatim.

- [ ] **Step 6: Capture Run 1 verdict**

Note in scratch: `Run 1 = MERGE` or `Run 1 = NO-MERGE` per the Interpretation rules.

---

### Task 3: Reset QA throwaway user (between runs)

**Files:** none (destructive QA cleanup — throwaway account only).

- [ ] **Step 1: Delete the auth user**

Run via `execute_sql` against `ljjvwtpifmoshfknlbaj`:
```sql
delete from auth.users
where lower(email) = lower('REPLACE_WITH_ADDR');
```
Expected: 1 row affected (cascade removes its `auth.identities`).

- [ ] **Step 2: Verify clean slate**

Run **Q-users** + **Q-identities**.
Expected: both 0 rows. Do not proceed to Task 4 until both are empty.

---

### Task 4: Live test — Run 2 (magic-link → Google OAuth)

**Files:** none (live + observation).

- [ ] **Step 1: Request a magic link (clean email)**

In the browser at `/login`, submit the magic-link form with the same gmail. **Hand off to the user** to click the link.
Expected: signed in, on `/dashboard`.

- [ ] **Step 2: Observe after magic-link**

Run **Q-users** + **Q-identities**.
Expected: Q-users = 1 row; Q-identities = 1 row, `provider = email`.
Record verbatim.

- [ ] **Step 3: Sign out**

Trigger logout. Expected: back at `/login`.

- [ ] **Step 4: Sign in with Google (same email)**

Click "Continue with Google". **Hand off to the user** for the consent screen with the same gmail.
Expected: signed in, on `/dashboard`.

- [ ] **Step 5: Observe after OAuth**

Run **Q-users** + **Q-identities**.
Expected (MERGE): Q-users = **1** row (same `id` as Step 2); Q-identities = **2** rows (`email` + `google`) sharing that `user_id`.
Record verbatim.

- [ ] **Step 6: Capture Run 2 verdict**

Note: `Run 2 = MERGE` or `Run 2 = NO-MERGE`.

---

### Task 5: Decision-tree evaluation

**Files:** none unless the contingency fires (see sub-steps).

- [ ] **Step 1: Evaluate both verdicts**

If **Run 1 = MERGE and Run 2 = MERGE** → behavior is correct. Skip to Task 6. Record: "Automatic linking confirmed both orderings."

If **either run = NO-MERGE** → proceed to Step 2 (contingency).

- [ ] **Step 2 (contingency): Diagnose the failure mode**

Run, against `ljjvwtpifmoshfknlbaj`:
```sql
select id, email, email_confirmed_at, created_at
from auth.users
where lower(email) = lower('REPLACE_WITH_ADDR')
order by created_at;
```
- If the first user's `email_confirmed_at` is **null** → the identity was unverified, so auto-linking was correctly skipped. Fix path = **A** (email confirmation).
- If both rows are confirmed yet a second user exists → automatic linking is not firing. Fix path = **B** (manual linking).

Stop and report the diagnosis to the user before applying any fix.

- [ ] **Step 3 (contingency path A): Enable email confirmation on QA**

Confirm/enable "Confirm email" in the QA project's Auth settings (Supabase Dashboard → Authentication → Providers/Email, or Management API auth config). Document the exact setting changed.
Then re-run Task 3 (reset) + Tasks 2 and 4 (both orderings). Expected: now MERGE.

- [ ] **Step 4 (contingency path B): Enable manual identity linking + add `linkIdentity()`**

Only if path A does not resolve it. Enable "Manual linking" in QA Auth settings, then add a post-login link step. **File to modify:** `src/app/auth/callback/route.ts` — after a successful `exchangeCodeForSession`, when the signed-in user's email already exists under a different provider, call `supabase.auth.linkIdentity(...)`. Show the exact diff in the report, get user approval, then implement with a focused test in `src/__tests__/` covering the link path. Re-run Tasks 3/2/4. Expected: MERGE.

- [ ] **Step 5: Record final behavior**

Note the confirmed end-state and the fix applied (if any) for the Task 7 documentation.

---

### Task 6: Prod parity check (`ycnsgkotrbjifsjkqmvn`) — approval-gated

**Files:** none (read-only unless the user approves a prod change).

- [ ] **Step 1: Read prod auth config**

Compare prod's email-confirmation + linking settings against the QA settings that produced MERGE. GoTrue auth config is **not** a migration — read it via the Supabase Dashboard (Authentication → Settings) or the Management API auth-config endpoint for `ycnsgkotrbjifsjkqmvn`.

- [ ] **Step 2: Compare + report**

If prod matches QA → record "prod parity confirmed, no change". Done.
If prod differs → **stop and present the exact prod setting change to the user for explicit approval.** Do not change prod config without it. After approval, apply via Dashboard/Management API and note the change.

- [ ] **Step 3: (No prod live test)**

Do not create throwaway users on prod. Parity is established by config equivalence + the QA empirical result.

---

### Task 7: Document the behavior

**Files:**
- Modify: `docs/architecture/auth-and-rls.md` (insert a new section after "Auth mechanisms", before "Session management")

- [ ] **Step 1: Insert the "Provider linking" section**

Add the following after the "Auth mechanisms" block (current `auth-and-rls.md:3-7`). Replace the **Evidence** bullet's `<...>` with the actual `user_id` / provider / timestamp values captured in Tasks 2 & 4. If Task 5 took a contingency path, adjust the first paragraph to state the fix applied and link the setting.

```markdown
## Provider linking — same email across providers

A user can authenticate with **Google OAuth** and **email magic link**. When both
use the *same* email address, **Supabase Auth automatically links them into a
single `auth.users` row** with one `auth.identities` row per provider. Automatic
linking is GoTrue's default and is gated on a **verified email** — Google returns
verified emails and magic-link verifies via the click, so both produce confirmed
identities and merge. We do **not** use manual identity linking (`linkIdentity()`);
it stays disabled.

This is load-bearing for membership: `accept_invite` (the SECURITY DEFINER RPC in
`supabase/migrations/20260513211135_tree_invites.sql`) attaches `tree_members.user_id`
to `auth.uid()` and gates on `auth.users.email = tree_invites.email`. Because both
providers resolve to **one** `user_id`, an invitee who later switches login provider
keeps the same membership — no orphaned second account.

**Settings state:** QA (`ljjvwtpifmoshfknlbaj`) and prod (`ycnsgkotrbjifsjkqmvn`) both
have email confirmation on and manual linking off (verified during issue #186).

**Evidence (issue #186, QA, 2026-06):** Google-then-magic-link and magic-link-then-Google
both produced 1 `auth.users` row + 2 `auth.identities`. Linked `user_id` `<id>`,
providers `<google, email>`.
```

- [ ] **Step 2: Verify the doc renders + links resolve**

Run:
```bash
grep -n "Provider linking" .claude/worktrees/186-provider-linking/docs/architecture/auth-and-rls.md
```
Expected: one match for the new heading.

- [ ] **Step 3: Commit**

```bash
cd .claude/worktrees/186-provider-linking
git add docs/architecture/auth-and-rls.md
git commit -m "docs(#186): document automatic provider linking behavior

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: One-user-per-email code audit

**Files (read + confirm; edit only if Task 5 found NO-MERGE):**
- `supabase/migrations/20260513211135_tree_invites.sql:153-228` — `accept_invite` RPC
- `src/app/(app)/invite/[token]/page.tsx:224-250` — email-mismatch gate
- `src/app/(app)/tree/[id]/members/actions.ts` — `acceptInvite` / `inviteEditor`
- `src/app/(app)/tree/[id]/page.tsx`, `.../members/actions.ts` — `profiles` / `tree_members` keying

- [ ] **Step 1: Confirm `accept_invite` keys on a single user**

Re-read `supabase/migrations/20260513211135_tree_invites.sql:153-228`. Verify: `v_user_id := auth.uid()`, `v_user_email := select email from auth.users where id = v_user_id`, email-match gate against `v_invite.email`, insert `tree_members(user_id = v_user_id)` with `on conflict (tree_id, user_id) do nothing`.
Expected conclusion: membership is stable **iff** one email = one `user_id` (the merge guarantee). No code change needed when MERGE holds.

- [ ] **Step 2: Confirm the invite page email gate**

Re-read `src/app/(app)/invite/[token]/page.tsx:224-250`. Verify the mismatch check compares `user.email` to `invite.email` case-insensitively. Confirm this is consistent with the RPC gate (both email-based).
Expected: consistent; no change.

- [ ] **Step 3: Confirm `profiles` is keyed by auth id**

Confirm `profiles.id = auth.users.id` (1:1) across `members/actions.ts` and `tree/[id]/page.tsx` reads — a merged user has exactly one `profiles` row, so display-name/avatar resolution is unaffected.
Expected: consistent; no change.

- [ ] **Step 4: Write the audit conclusion into the doc**

If the audit found no issues (expected), append a one-line note under the "Provider linking" section's evidence bullet:
`Code audit (issue #186): accept_invite, the invite-page email gate, and profiles keying all rely on one-user-per-email, which the merge guarantee satisfies — no code change required.`
If the audit found a gap (only possible under a NO-MERGE end-state that wasn't fully fixed), file it and stop.

- [ ] **Step 5: Commit (doc note)**

```bash
cd .claude/worktrees/186-provider-linking
git add docs/architecture/auth-and-rls.md
git commit -m "docs(#186): record one-user-per-email code-audit conclusion

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Cleanup + PR

**Files:** none (cleanup + PR).

- [ ] **Step 1: Delete QA throwaway users**

Run against `ljjvwtpifmoshfknlbaj`:
```sql
delete from auth.users where lower(email) = lower('REPLACE_WITH_ADDR');
```
Expected: throwaway account(s) removed. Verify with **Q-users** = 0 rows.

- [ ] **Step 2: Push the branch**

```bash
cd .claude/worktrees/186-provider-linking
git push -u origin docs/186-provider-linking
```

- [ ] **Step 3: Open a draft PR (follows the repo PR template, `Closes #186`)**

```bash
gh pr create --draft --base qa --head docs/186-provider-linking \
  --title "docs(#186): document + verify provider linking (OAuth + magic-link)" \
  --body "$(cat <<'EOF'
## Closes
Closes #186

## Summary
Verified on QA that Google OAuth + email magic-link with the same address merge
into one auth.users row (two auth.identities), both orderings. Documented the
behavior in docs/architecture/auth-and-rls.md and audited the one-user-per-email
assumption in accept_invite, the invite-page email gate, and profiles keying.

## Test plan
- [x] Live QA test, Google→magic-link: 1 user / 2 identities
- [x] Live QA test, magic-link→Google: 1 user / 2 identities
- [x] Prod (ycns…) auth-config parity confirmed
- [ ] Reviewer: confirm doc reads correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
(Adjust the Test plan boxes if a contingency fix was applied. Leave the PR as a draft; the user marks it ready.)

- [ ] **Step 4: Close out**

Report the PR URL. Once merged, #186 auto-closes via `Closes #186`. Docs-only changes ride the next feature release — no standalone tag.

---

## Self-Review (completed during authoring)

- **Spec coverage:** live test both orderings (Tasks 2/4) ✓; no-merge contingency (Task 5) ✓; prod parity approval-gated (Task 6) ✓; "Provider linking" doc section (Task 7) ✓; code audit of `tree_members.user_id` / `tree_invites` accept flow / `profiles.id` (Task 8) ✓; out-of-scope items not added ✓.
- **Placeholder scan:** the only `<...>` substitutions are runtime-captured evidence values (user_id/providers) and the email address, which are inherently collected during execution — each is flagged with an explicit "replace with captured value" instruction, not a vague TODO.
- **Consistency:** project refs (`ljjvwtpifmoshfknlbaj` QA, `ycnsgkotrbjifsjkqmvn` prod), the observation queries, and the `accept_invite` line references are used identically across tasks.
