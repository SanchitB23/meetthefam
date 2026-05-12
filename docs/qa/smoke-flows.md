# QA smoke flows

Named end-to-end flows that the `e2e-smoke-tester` agent (see [`.claude/agents/e2e-smoke-tester.md`](../../.claude/agents/e2e-smoke-tester.md)) knows how to execute. Each phase appends its golden-path flows here; the agent reads this file at dispatch time, runs the requested subset, and reports PASS / FAIL / SKIPPED per flow.

## Conventions

- **Flow ID**: lowercase-with-hyphens (`signin-magic-link`). Stable across phases.
- **Environment**: `local` (against `http://localhost:3000` + the local Supabase stack on `54321`) or `qa` (against the Vercel preview + the QA Supabase project).
- **Auth method**: `magic-link-mailpit` (local only — Mailpit at `:54324` catches the email), `google-oauth` (QA), `pre-authed-cookie` (QA — caller provides a session cookie from a pre-signed-in browser).
- **Idempotency**: every flow must clean up after itself (delete the tree it created, sign out, etc.) so re-runs stay green. If cleanup fails, that's a fail.
- **Viewport**: default 1280×800 desktop. Flows that test mobile resize explicitly.

## Agent contract

When a caller dispatches the agent, they pass:
- `env`: `local` or `qa`
- `flow_ids`: subset of the IDs below, in order. Empty = run all flows valid for the env.
- `email` + `password` (optional, for password-based test accounts) OR `session_cookie` (QA pre-authed)

The agent returns one bullet per flow: `✅ flow-id (time) | ⚠️ flow-id — skipped because … | ❌ flow-id — failed at step N: <reason>` plus any captured console errors / failed network requests.

---

## Catalog

### Phase 1 — auth flows

#### `signin-magic-link` *(env: local)*

Tests: magic-link sign-in works end-to-end via Mailpit.

1. Navigate to `http://localhost:3000/login`.
2. Snapshot — verify the page contains the email input and the "Continue with Google" button.
3. Fill the email field with a deterministic local-only address (e.g. `e2e-${randomId}@test.local`).
4. Click "Sign in with email" (or the equivalent submit button on the magic-link form).
5. Wait for the confirmation card showing "Check your email — we sent a link to <email>".
6. Open `http://localhost:54324` (Mailpit) in a new tab. Find the most recent message to that email. Extract the magic-link URL.
7. Navigate to the magic-link URL.
8. Assert the browser ends up on `/dashboard` and the page shows "Signed in as <email>" (Phase 0 placeholder) OR the post-Phase-2 dashboard.
9. **Cleanup:** click sign-out, assert redirect to `/login`.

**Pass:** all 9 steps complete; no console errors.

#### `signin-google-oauth` *(env: qa)*

Tests: Google OAuth one-click sign-in works on the QA preview.

Currently requires a `pre-authed-cookie` (the agent can't drive the real Google consent screen automatically without browser automation in a real session). If `session_cookie` is provided, the flow becomes:

1. Inject the cookie into the browser context.
2. Navigate to `<qa_url>/dashboard`.
3. Assert no redirect to `/login`.
4. Snapshot the page; confirm the dashboard renders (`Your Trees` heading or empty state).
5. Click sign-out; assert redirect to `/login`.

If no cookie is provided, **SKIP** with reason "google-oauth-needs-manual-consent".

#### `proxy-redirect-unauth` *(env: local | qa)*

Tests: hitting `/dashboard` while unauthenticated triggers a 307 from `proxy.ts`.

1. Clear all cookies.
2. Navigate to `<base_url>/dashboard`.
3. Assert the response chain includes a 307 from `/dashboard` to `/login`.
4. Assert the final page URL is `/login`.

#### `proxy-skip-share-link` *(env: local | qa)*

Tests: hitting `/share/<random-token>` does NOT trigger the auth boundary (matcher skips it).

1. Clear all cookies.
2. Navigate to `<base_url>/share/abc123-not-a-real-token`.
3. Assert the response is NOT a 307 to `/login` (a 404 from the Route Handler is acceptable until Phase 7 ships the real route).

---

### Phase 2 — tree CRUD flows

All Phase 2 flows assume the agent is already signed in (use `signin-magic-link` first on local).

#### `dashboard-empty-state` *(env: local | qa)*

Tests: a user with no trees sees the empty state.

1. From a freshly-signed-in user that has no trees: navigate to `/dashboard`.
2. Snapshot — assert visible "No trees yet" text + "Create your first family tree to get started." copy.
3. Assert the `+ New tree` button is visible and ENABLED (not disabled — sub-task 2 is live).

#### `tree-create-renames-deletes` *(env: local | qa)*

Tests: full CRUD round-trip, no hard reload.

1. Click `+ New tree`. Wait for the modal.
2. Snapshot the modal — assert it has "Create a new tree" title + a name input + a description textarea.
3. Fill name `E2E Tree ${randomId}` and description `Created by e2e-smoke-tester`.
4. Click "Create tree". Wait for the modal to close.
5. Assert the new card appears in the grid WITHOUT a page reload (use Playwright's `page.on('load')` listener — if it fires, FAIL).
6. Click the `…` menu on the new card. Click "Rename".
7. Fill the rename input with `E2E Tree ${randomId} (renamed)`. Click Save.
8. Assert the modal closes and the card name updates in place.
9. Click `…` → Delete. Read the destructive confirmation (must include the tree name in quotes). Click Delete.
10. Assert the card disappears.
11. Assert the trees count in the grid decreased by 1 (use the card-list aria-described attribute or count `[data-testid="tree-card"]` if added; otherwise count by name).

**Pass:** 11 steps, no `load` event between steps 4–10, no console errors.

#### `dashboard-readyourwrites-two-tab` *(env: local | qa)*

Tests: `revalidatePath('/dashboard')` delivers read-your-writes across tabs.

1. Open tab A at `/dashboard`. Record the count of `tree-card` elements (call it `N`).
2. Open tab B at `/dashboard`. Create a tree (steps 1–5 of `tree-create-renames-deletes`).
3. In tab A, reload. Assert the count is now `N + 1` and the new tree name appears.
4. **Cleanup:** delete the tree from either tab.

#### `dashboard-mobile-1-col` *(env: local | qa)*

Tests: at 375px (iPhone SE width) the card grid is single-column with no horizontal overflow.

1. Resize the viewport to 375×667.
2. Navigate to `/dashboard` (assumes ≥2 trees exist; if not, create two temporary trees first).
3. Snapshot. Assert cards stack vertically (Tailwind: at this width `sm:grid-cols-2` is off, so grid is implicit 1-col).
4. Assert no horizontal scrollbar (compare `document.documentElement.scrollWidth` to viewport width — must be equal).
5. **Cleanup:** resize back to 1280×800; delete any temporary trees created in step 2.

#### `editor-card-no-menu` *(env: local — requires test setup)*

Tests: non-owner (`editor` role) cards hide the `…` menu.

Setup: needs two test accounts. The agent should accept `--editor-fixture` mode that:
- Signs in as user A, creates a tree, signs out.
- Uses the Supabase service-role admin API to insert user A's tree into `tree_members` with user B as editor.
- Signs in as user B.

Then:
1. Navigate to `/dashboard`.
2. Find the card for the tree owned by A. Assert its role badge says "editor".
3. Snapshot the card — assert the `…` button is NOT present.
4. **Cleanup:** sign out, sign in as A, delete the tree.

If service-role admin API is not available in env (e.g. QA without a fixture loader), **SKIP** with reason "needs-service-role-admin".

---

### Phase 3 — people CRUD + linking flows

All Phase 3 flows assume the agent is already signed in (use `signin-magic-link` first on local, or a `pre-authed-cookie` on QA). The flow creates and tears down its own tree so it can run idempotently.

#### `people-crud-and-link` *(env: local | qa)*

Tests: the Phase 3 ship gate — add / edit / delete people, set spouse / parents, bidirectional spouse sync, ancestor-cycle detection, inbound-FK cleanup on delete.

1. From `/dashboard`, click `+ New tree`. Fill name `Phase 3 E2E ${randomId}`, leave description blank. Submit. Wait for the new card.
2. Click the new tree card. Land on `/tree/<id>`. Snapshot — assert the empty state ("No people yet" + "+ Add the first person" CTA enabled).
3. Click "+ Add the first person". The PersonForm opens (Sheet on mobile, Dialog on desktop). Fill `Full name = Alice Allen`. Submit. Form closes; the Alice card appears in the list.
4. Click the floating `+` FAB (bottom-right). Fill `Full name = Bob Brown`, `Gender = m`. Submit. Bob card appears.
5. Click the `…` menu on Bob's card → "Add relative…". The PersonForm opens with a "How is this person related?" radiogroup at the top, defaulting to "Child of Bob Brown". Fill `Full name = Charlie Brown`. Submit. Charlie's card appears with a relations summary reading `Child of Bob Brown` (or "Son of Bob Brown" if the UI distinguishes gender — match whichever the live build renders).
6. Click `…` on Alice's card → "Set spouse". The PersonPicker opens. Pick Bob Brown. Confirm. Snapshot — assert Alice's card now reads `Spouse of Bob Brown` AND Bob's card reads `Spouse of Alice Allen` (bidirectional sync).
7. Click `…` on Charlie's card → "Set parents". The dialog shows two pickers. Father stays as Bob (existing). Pick Alice as Mother. Confirm. Charlie's relations summary updates to `Child of Bob Brown & Alice Allen` (order may vary — both names must appear).
8. Click `…` on Alice's card → "Set parents". Pick Bob as Father. Confirm. Assert: an inline error appears mentioning "circular" / "ancestry" (the DB rejects the cycle Bob → Alice → Charlie? Actually Bob's only descendant chain is Bob→Charlie; Bob→Alice would NOT close a cycle yet. To force a cycle: Set Bob's parents to Charlie. Try Set parents on Bob → Father = Charlie → assert the error). **NOTE for the agent**: pick whichever pair currently forms a cycle in the seeded state — Bob→Charlie means setting Charlie as Bob's parent closes the loop Bob→Charlie→Bob. If the UI guard blocks the picker before the DB call (descendant exclusion), accept that as PASS too — the assertion is *the user cannot complete the action and an explanation is shown*.
9. Click Alice's card body (or the Edit menu item) → PersonForm opens in edit mode prefilled with `Alice Allen`. Tap a non-default tone swatch (e.g. `indigo` if current is `sage`). Save. Alice's avatar tint changes; no row jump in the list.
10. Click `…` on Bob's card → "Edit" (or click card body) → in the form, click the destructive "Delete" CTA. Confirm in the destructive-styled dialog. Bob's card disappears. Assert: Alice's card no longer shows `Spouse of Bob Brown` (inbound spouse_id nulled); Charlie's relations summary loses Bob and now reads `Child of Alice Allen` (inbound father_id nulled).
11. **Cleanup:** navigate back to `/dashboard`. Open the `…` menu on the `Phase 3 E2E ${randomId}` card → Delete → confirm. The tree disappears; cascade deletes the remaining people rows.

**Pass:** all 11 steps complete; spouse symmetry visible at step 6; cycle rejection visible at step 8; inbound-FK cleanup visible at step 10; no console errors; no orphan tree left on dashboard.

**Skip rules:** if running on `local` without `supabase start`, SKIP with reason "needs-local-supabase".

---

## Adding a new flow

When closing out a phase:

1. Append a new section under the phase header (or create one).
2. Use a stable Flow ID. Existing IDs MUST NOT change.
3. Specify env support, auth requirements, viewport assumptions.
4. List concrete numbered steps with assertions and cleanup.
5. Update the agent's "flows it knows about" list in [`.claude/agents/e2e-smoke-tester.md`](../../.claude/agents/e2e-smoke-tester.md) if the agent's catalog index needs adjustment (most edits won't need this — the agent reads this file at dispatch).

## What this file is NOT

- Not a test runner. It's a flow definition document. The agent reads it and executes Playwright MCP calls.
- Not a unit-test suite. Vitest in `src/__tests__/` covers DB-layer (RLS) tests.
- Not exhaustive coverage. Smoke flows cover the **golden path** of each phase, not every edge case. Edge cases are caught by the human-in-the-loop review at PR time.
