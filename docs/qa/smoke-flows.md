# QA smoke flows

Named end-to-end flows that the `e2e-smoke-tester` agent (see [`.claude/agents/e2e-smoke-tester.md`](../../.claude/agents/e2e-smoke-tester.md)) knows how to execute. Each phase appends its golden-path flows here; the agent reads this file at dispatch time, runs the requested subset, and reports PASS / FAIL / SKIPPED per flow.

## Conventions

- **Flow ID**: lowercase-with-hyphens (`signin-magic-link`). Stable across phases.
- **Environment**: `local` (against `http://localhost:3000` + the local Supabase stack on `54321`) or `qa` (against the Vercel preview + the QA Supabase project).
- **Auth method**: `magic-link-mailpit` (local only — Mailpit at `:54324` catches the email), `google-oauth` (QA), `pre-authed-cookie` (QA — caller provides a session cookie from a pre-signed-in browser).
- **Idempotency**: every flow must clean up after itself (delete the tree it created, sign out, etc.) so re-runs stay green. If cleanup fails, that's a fail.
- **Viewport**: default 1280×800 desktop. Flows that test mobile resize explicitly.

## Vercel preview deployment protection

When running against a Vercel preview URL that has deployment protection enabled, the `_vercel_sso_nonce` gate blocks all browser requests with HTTP 401. Bypass it once per browser session via the protection-bypass-for-automation query string:

```
<preview-url>/?x-vercel-protection-bypass=$VERCEL_PROTECTION_BYPASS&x-vercel-set-bypass-cookie=true
```

- `VERCEL_PROTECTION_BYPASS` is the secret set in Vercel project settings under **Settings > Deployment Protection > Protection Bypass for Automation**. Store it in `.env.local` (gitignored); never commit the value.
- Pass this as the FIRST `browser_navigate` call. Vercel sets a `_vercel_jwt` cookie; subsequent navigations within the same browser session use the cookie automatically — no query string needed on subsequent steps.
- For `curl`-based pre-flight checks, pass the value via HTTP header instead: `-H "x-vercel-protection-bypass: $VERCEL_PROTECTION_BYPASS"`.
- If the curl pre-flight still returns 401 after supplying the header/query, the bypass secret is wrong, expired, or scoped to a different project — STOP and report BLOCKED to the controller.

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

---

### Phase 4 — tree visualization flows

All Phase 4 flows assume the agent is already signed in (use `signin-magic-link` first on local, or a `pre-authed-cookie` on QA). The flow creates and tears down its own tree so it can run idempotently.

#### `phase-4-tree-visualization` *(env: local | qa)*

Tests: the Phase 4 ship gate — family-chart renders a real tree from real data, custom PersonNode card, tap → detail sheet, long-press → action menu, "Re-center here" updates the URL hash, context-aware FAB.

1. From `/dashboard`, click `+ New tree`. Fill name `Phase 4 E2E ${randomId}`, submit. Wait for the new card.
2. Click the new tree card. Land on `/tree/<id>`. Assert empty state ("No people yet" + "+ Add the first person" CTA visible).
3. Click "+ Add the first person". Add `Grandma Smith` (gender `f`, birth year `1930`). Submit.
4. Click the floating `+` FAB (bottom-right). Aria-label reads `Add a person` (no focus yet). Add `Grandpa Smith` (gender `m`, birth year `1928`). Submit.
5. Long-press Grandma's node for ~600 ms. Assert: action menu opens; haptic vibration fires (no-op on Safari iOS — acceptable). Click "Set spouse" → PersonPicker → pick Grandpa → confirm. Snapshot — assert Grandma's node and Grandpa's node now sit horizontally adjacent in the canvas (family-chart's spouse layout).
6. Long-press Grandma → "Add relative…" → form pre-seeds "Child of Grandma Smith". Add `Mom Smith` (gender `f`, birth year `1955`). Submit. Assert Mom appears below the spouse pair.
7. Tap Mom's node (single tap, < 500 ms). Assert: PersonDetailSheet slides in (bottom on mobile, right on desktop). Header shows large avatar + serif `Mom Smith` + dates `b. 1955`. Relations summary reads `Child of Grandma Smith` (or `& Grandpa Smith` if both parents set). Click the "Edit" button. The detail sheet closes; PersonForm opens prefilled. Cancel.
8. Tap Mom's three-dot icon (top-right corner of the card). Same action menu opens — assert it appears at the icon's position (not at the long-press point).
9. From the menu: click "Re-center here". Assert: (a) tree pans + animates to center on Mom; (b) URL hash updates to `#p=<mom-uuid>`; (c) FAB aria-label changes to `Add a relative to Mom Smith`.
10. Copy the current URL (with the hash). Open it in a new tab. Assert the chart paints **already centered on Mom Smith** (SSR `?p=` mirror via `searchParams` would do the same; the hash test exercises the runtime path).
11. Pan with a one-finger drag across the canvas. Assert the canvas pans. Scroll-wheel (or pinch) to zoom — assert zoom works. Tap an empty area of the canvas — assert any open sheet closes.
12. Long-press Grandpa → "Delete" → confirm in the destructive dialog. Assert: Grandpa's node disappears; Grandma's spouse-pair link is gone (inbound spouse_id nulled); Mom's relations summary loses Grandpa.
13. **Cleanup:** navigate back to `/dashboard`. Open the `…` menu on the `Phase 4 E2E ${randomId}` card → Delete → confirm. The tree disappears.

**Pass:** all 13 steps complete; tap vs. long-press differentiation observable at steps 5–8; URL hash sync visible at steps 9–10; FAB context-awareness visible at steps 4 & 9; spouse-symmetry-on-delete visible at step 12; no console errors; no orphan tree on dashboard.

**Skip rules:**
- Running on `local` without `supabase start` → SKIP with reason "needs-local-supabase".

---

### Phase 5 — photo upload flows

All Phase 5 flows assume the agent is already signed in (use `signin-magic-link` first on local, or a `pre-authed-cookie` on QA). The flow creates and tears down its own tree so it can run idempotently.

#### `phase-5-photo-upload` *(env: local | qa)*

Tests: the Phase 5 ship gate — client-side resize, upload to the `photos` bucket via the `uploadPersonPhoto` Server Action, avatar refresh in both the tree canvas and the detail sheet, "Remove photo" path, and best-effort Storage cleanup on delete-person + delete-tree.

The flow needs a fixture JPEG ≥5 MB (a phone-photo-sized file) so the client-side resize path actually has work to do. On `local`, place one at `tmp/fixtures/phone-photo.jpg` before the run; on `qa`, the caller provides the file via Playwright's `setInputFiles`.

1. From `/dashboard`, click `+ New tree`. Fill name `Phase 5 E2E ${randomId}`, submit. Wait for the new card.
2. Click the new tree card. Land on `/tree/<id>`. Assert empty state ("No people yet").
3. Click "+ Add the first person". Add `Mom Smith` (gender `f`, birth year `1955`). Submit. Assert Mom's tree-canvas node renders **tone-tinted initials** (no `<img>` inside the avatar wrapper).
4. Tap Mom's node → detail sheet opens → click "Edit". Assert PersonForm opens with the photo section visible above the name field (avatar + "Add photo" button).
5. Click "Add photo" → file picker → select the ≥5 MB fixture JPEG.
   - **(a)** Within ~300 ms, the form's avatar updates to an object-URL preview (no network round-trip yet — this is the optimistic local-blob preview from sub-task 3).
   - **(b)** Within ~2 s, the avatar URL flips to a `*.supabase.co/storage/v1/object/public/photos/trees/<treeId>/people/<momId>/avatar.jpg` URL (the upload completed and `refresh()` re-fetched).
   - **(c)** Open DevTools → Network tab → confirm the resized payload size is **under 200 KB** (sanity check on `resizeToJpeg`; ~150 KB target per the spec).
6. Submit the form. Form closes. Assert the tree-canvas node's avatar AND a re-tapped detail sheet's avatar both show the photo (not initials).
7. Click the FAB (`+`) → "Add a person" or "Add a relative to Mom Smith" depending on focus state. Before submit, click "Add photo" → pick the same fixture JPEG → preview shows → submit. Assert the new person row appears with the photo already visible (no second click required — the create-then-upload sequencing from sub-task 3).
8. Long-press Mom's node → "Edit" → "Remove photo" → form's avatar reverts to initials immediately → submit. Assert tree-canvas + detail-sheet both fall back to initials. **Storage check (manual / Studio):** the file `trees/<treeId>/people/<momId>/avatar.jpg` is gone from the Storage browser.
9. Re-upload a photo on Mom (steps 4–6 abbreviated). Long-press Mom → "Delete" → confirm in the destructive dialog. Assert Mom's node disappears. **Storage check:** `trees/<treeId>/people/<momId>/avatar.jpg` is gone (sub-task 4 cleanup).
10. Back on `/dashboard`. Open the `…` menu on the `Phase 5 E2E ${randomId}` card → Delete → confirm. The tree disappears. **Storage check:** the entire `trees/<treeId>/` prefix is empty (the second person from step 7 still had a photo — sub-task 4's `deleteTree` purge proves the batch path).
11. **Cross-tenant negative (manual, optional on QA):** in a new private tab signed in as a different user, attempt to fetch the now-deleted-tree's `photos/trees/<treeId>/...` path. Expect 404. Also attempt to PUT to a stranger's `photos/trees/<some_other_tree>/people/<...>/avatar.jpg` — expect 403 (RLS `photos_insert_editor` rejects).

**Pass:** all 10 steps complete; resize keeps the upload under 200 KB; the avatar refresh in step 6 visibly updates without a full page reload; Storage state matches DB state after both delete paths; no console errors.

**Skip rules:**
- Running on `local` without `supabase start` → SKIP with reason "needs-local-supabase".
- Fixture JPEG missing → SKIP with reason "needs-large-jpeg-fixture".

---

---

### Phase 6 — collaboration flows

All Phase 6 flows assume local dev server (`pnpm dev`) running at `http://localhost:3000` and local Supabase stack (`pnpm exec supabase start`).  An incognito / private-browsing window is used to simulate the invited editor.  Mailpit at `http://localhost:54324` is needed only if magic-link sign-up is used for the second account.

#### `phase-6-collaboration` *(env: local)*

Tests: the Phase 6 ship gate — owner mints invite → copy URL → second account accepts in incognito → editor adds a person → owner sees it → owner revokes → ex-editor loses access.

1. **Pre-condition** — local dev server + local Supabase running.  Owner account A is signed in (normal browser window).  A second incognito / private-browsing window is open and not signed in.  Two test email addresses ready: `owner-a@local.test` and `editor-b@local.test`.
2. As A: open the Smith demo tree (or any tree on the dashboard).  In the top bar, click the `Users2` icon button.  Assert: the MembersSheet panel opens.  The Members section shows the owner (A) as the sole member.
3. As A: in the MembersSheet invite form at the bottom, enter `editor-b@local.test`.  Click **Invite**.  Assert: an invite URL renders inline with a **Copy** button next to it.  No page reload occurs.
4. Copy the invite URL (click the Copy button).  Open the incognito window and paste the URL into the address bar.  Assert: the browser is redirected to `/login?next=/invite/<token>` (the proxy's auth boundary fires because the user is not signed in).
5. In the incognito window: sign up / sign in as `editor-b@local.test` (magic-link via Mailpit, or password if the account already exists).  After successful auth, the browser follows the `next=` redirect and lands on `/invite/<token>`.  Assert: a confirm card renders showing the tree name and invited-by name.
6. As B (incognito): click **Accept**.  Assert: the browser redirects to `/tree/<id>`.  The tree page loads.  The top-bar Members icon is visible.  Opening the MembersSheet shows two members: A (owner) and B (editor, read-only list in editor view).
7. As B (incognito): open the FAB (floating `+` button).  Select **Add a person**.  Fill `Full name = B's Test Person`.  Submit.  Assert: the new person appears on the canvas without a full page reload.
8. In the original browser (as A): reload / revalidate the tree page.  Assert: `B's Test Person` appears on the canvas (the `revalidatePath('/tree/<id>')` call from B's insert propagated).
9. As A: open the MembersSheet.  The Members section shows B with an editor badge and a trash/remove icon.  Click the trash icon on B's row.  Confirm the removal in the confirmation prompt.  Assert: B's row disappears from the Members list.
10. As B (incognito): refresh the tree page.  Assert: B no longer has access — the page shows a 404 / access-denied state (the `notFound()` guard for non-members fires).  Additionally, if B attempts a write (e.g. via DevTools → `fetch('/tree/<id>/people', { method:'POST', ... })`), the Server Action returns an RLS rejection (no row written).
11. **(Negative / re-invite)** As A: in the MembersSheet invite form, enter `editor-b@local.test` again (the original invite is consumed; the partial unique index on open invites allows a new row).  Click Invite.  Assert: a NEW invite URL renders (different token from step 3).  As B: open the new URL → accept → land on the tree → B's editor row reappears in the Members list.

**Pass:** all 11 steps complete; step 8 proves read-your-writes across accounts; step 10 proves immediate RLS revocation; step 11 proves re-invite works after revocation; no console errors; no orphan data left after cleanup.

**Skip rules:**
- Running on `local` without `supabase start` → SKIP with reason "needs-local-supabase".
- Mailpit not accessible at `:54324` and no password-based test accounts pre-created → SKIP with reason "needs-local-mailpit".
- `e2e-smoke-tester` agent tools-grant fix still unresolved → SKIP with reason "needs-tools-grant-fix"; manual QA on the local preview stands in.

---

### Phase 7 — share link flows

All Phase 7 flows assume local dev server (`pnpm dev`) running at `http://localhost:3000` and local Supabase stack (`pnpm exec supabase start`). An incognito / private-browsing window is used to simulate the anonymous viewer.

#### `phase-7-share-link` *(env: local)*

Tests the Phase 7 ship gate — owner enables share link → copy URL → anon viewer in incognito sees read-only tree → owner regenerates → old URL 404s → owner disables → URL 404s.

1. **Pre-condition** — local dev server + Supabase running. Owner A is signed in (normal browser). An incognito window is open and not signed in. The Smith Family demo tree (or any owned tree with people) exists.
2. As A: open the tree (`/tree/<id>`). In the top bar, click the new `Share2` icon button (next to Members). Assert: the ShareLinkSheet opens with an "Enable read-only share link" button.
3. As A: click **Enable read-only share link**. Assert: a read-only URL input appears with a Copy button. The URL matches the pattern `http://localhost:3000/share/<43-char-token>`.
4. Copy the URL. In the incognito window, paste into the address bar and load. Assert: the page renders with a sticky banner ("You're viewing a shared family tree. Sign up to create your own ↗"), the tree-name heading, and the family-tree canvas below. NO FAB visible. NO three-dot button on cards. NO top-nav with Logo or profile menu.
5. As incognito viewer: tap any person. Assert: the PersonDetailSheet opens showing avatar, name, bio, dates, location, occupation, relations. NO "Edit" button visible at the bottom. Pan + pinch-zoom on the canvas: works.
6. As incognito viewer: click "Sign up to create your own" in the banner. Assert: lands at `/login`.
7. As A: go back to the tree's ShareLinkSheet. Click **Regenerate** → **Confirm regenerate**. Assert: the URL changes (token differs). The "Cancel regenerate" affordance dismisses correctly if clicked before Confirm.
8. As incognito viewer: reload the original (pre-regenerate) URL. Assert: 404 page renders ("Tree not found. This share link is no longer active.").
9. As A: copy the NEW URL. Paste into the incognito tab. Assert: tree loads again with all chrome from step 4.
10. As A: click **Disable sharing** → **Confirm disable**. Assert: the URL input disappears and the "Enable read-only share link" button reappears.
11. As incognito viewer: reload the (just-disabled) URL. Assert: 404 page renders.

**Pass:** all 11 steps complete; step 4 + 5 prove read-only lockdown; step 8 proves the regenerate kills the old URL; step 11 proves disable kills all URLs; no console errors; no orphan rows left after cleanup.

**Skip rules:**
- Running on `local` without `supabase start` → SKIP with reason "needs-local-supabase".
- `e2e-smoke-tester` agent tools-grant fix still unresolved → SKIP with reason "needs-tools-grant-fix"; manual QA on the local preview stands in.

---

### Phase 8 — visual polish + landing flows

Phase 8 ships three coordinated bundles (8a brand foundations, 8b person + tree canvas polish, 8c landing + nav + animations). The flows below cover the **8c-done** milestone — the cumulative gate before the `v0.4.0` release. Earlier milestone gates (8a-done, 8b-done) ran against the existing Phase 1–7 catalog plus curl-verifiable brand-asset checks; both reported partial-pass with Playwright MCP runtime still blocked (see PR #55 notes).

#### `phase-8c-full` *(env: qa)*

End-to-end visual walk against the QA Vercel preview after 8c-1 through 8c-7 land. Covers the new chrome split (route group), the heirloom landing, perceived-perf wins (skeletons + LinkProgress), the revoke-member copy, and the global version footer. Interactive flows that need Playwright MCP runtime may still SKIP — report PARTIAL_PASS with reason `playwright-runtime-blocked` and call out which steps were curl-verifiable vs. interactive.

1. **Pre-condition** — QA Vercel preview is reachable with `VERCEL_PROTECTION_BYPASS` set per the project's QA-preview unblock pattern (the env var is documented at the top of this file). The QA Supabase project has a known test account with at least one tree containing ≥1 person.
2. **Landing (unauthed)** — visit `/` in an incognito session. Assert: heirloom hero renders (Logo + Cormorant italic kicker "meet the people who already know each other" + serif H1 "Build a family tree that feels like home." + primary-color "Sign in to begin" CTA). Below: three-card features grid using the brand icons (Family / Heart / Leaf) with Branch SVG dividers above + below. Below that: footer with Cormorant italic tagline + sign-in link. NO top-nav chrome. The bottom-right corner shows the `v…` micro-version.
3. **Landing → login** — click "Sign in to begin". Assert: navigates to `/login`. (LinkProgress bar may flash at the top during the navigation; ViewTransition morph is DEFERRED post-Phase-8 — `react@19.2.6` stable does not export it.)
4. **Authed redirect** — sign in, then visit `/` directly. Assert: the page redirects to `/dashboard` server-side (no flash of the landing markup).
5. **Route-group chrome** — visit `/dashboard`, `/tree/<id>`, and `/invite/<token>` (a known pending invite). Assert: each shows the SAME top-nav (Logo + "meetthefam" wordmark on the left, "Sign out" link on the right). Public surfaces (`/`, `/login`, `/auth/*`, `/share/<token>`) show NO top-nav chrome.
6. **Loading shimmer (dashboard)** — hard-refresh `/dashboard` (clear cache to force a cold SSR fetch). Assert: a heirloom-palette skeleton paints immediately (cream `bg-background` outer `<main>`, `bg-secondary/60` shimmer rows). NO black flash.
7. **LinkProgress bar** — from `/dashboard` click a tree card. Assert: a thin accent-coloured bar animates at the very top of the viewport while the navigation is in flight; the bar disappears after `/tree/<id>` finishes painting.
8. **Loading shimmer (tree)** — from `/dashboard` open a tree, then re-visit it (or open in a new tab to force a cold render). Assert: heirloom skeleton paints (cream `bg-background` + `bg-secondary/60` shimmer for back-arrow + name + Members + Share + a dashed-border canvas block).
9. **Suspense order** — visit `/tree/<id>` with a path that 404s for the current user (e.g. someone else's tree id). Assert: the 404 page renders immediately, NOT a loading skeleton followed by 404 (the auth+permission gates run before Suspense).
10. **Revoke-member copy** — as the owner on `/tree/<id>`, open MembersSheet, click the Trash icon next to an editor member. Assert: the row expands vertically — the chip-row stays inline, and a `text-sm text-muted-foreground` paragraph appears below: `"<editor name> will lose access. The people they added stay in your tree."`. Click "Cancel revoke" → the paragraph disappears.
11. **Italic-Cormorant whitelist** — visual sweep. Confirm italic Cormorant appears ONLY in: landing kicker, landing footer tagline, not-found tagline ("Lost in the family tree?"), ShareBanner pull-quote, PersonDetailSheet nickname. Nowhere else.
12. **VersionFooter** — on every page visited above, confirm the `v…` micro-version sits in the bottom-right corner at `fixed bottom-2 right-3`, muted (`opacity: 0.4`), and does NOT block the AddRelativeFab on `/tree/<id>` (the FAB at `bottom-6 right-6` remains clickable).

**Pass:** all 12 steps complete; no console errors; the heirloom palette persists across light + dark mode (toggle `prefers-color-scheme: dark` in DevTools and re-walk steps 2 + 5 + 6 + 12).

**Skip rules:**
- ViewTransition cross-page morph is OUT OF SCOPE for this flow (8c-5 deferred; documented in `docs/tasks/current-phase.md`). Don't assert ViewTransition behavior.
- Playwright MCP at runtime still blocked → SKIP steps 2 through 11 with reason `playwright-runtime-blocked`; agent still curl-verifies `/`, `/login`, the favicon, the global CSS for the heirloom tokens, and the rendered `v…` micro-version on the public landing as a partial pass.

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
