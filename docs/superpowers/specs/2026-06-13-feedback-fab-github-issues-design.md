# In-App Feedback / Bug Reporter → GitHub Issues — Design Spec

> Authored via `superpowers:brainstorming` on 2026-06-13. Tracking issue: [#238](https://github.com/SanchitB23/meetthefam/issues/238).
> Status: **approved, not yet scheduled** — picked up via the normal milestone process; an implementation plan (`superpowers:writing-plans`) is written when the issue enters a cycle.

## Context

Users (tree owners, invited editors, and share-link relatives) have no in-app way to report bugs or send feedback — it arrives out-of-band (chat, word of mouth) and gets lost. This feature adds a lightweight feedback FAB that captures useful app context automatically and files each submission as a GitHub issue, landing user reports directly in the existing triage workflow (labels → milestones → issue-anchored branches).

## Decisions locked during brainstorming

| Decision | Choice | Why |
|---|---|---|
| Destination | Main repo (`SanchitB23/meetthefam`) + `user-feedback` label | One triage surface; repo is flipping private, which removes the PII-in-public-issues concern |
| Audience | Signed-in users in `(app)`; share-link viewers too, with **required name + email** | Relatives viewing shared trees are real users; identity requirement keeps signal usable |
| Auto-captured data | Metadata only — no console errors, no screenshots | Covers ~90% of triage needs at half the complexity; escalators stay out of scope |
| Form shape | Bug/Feedback toggle + single message textarea | Family-app users won't write structured reports; title auto-derived from first line |
| Anonymous throttle | Supabase counter table + honeypot | Free, per-share-token, reliable on serverless (state in Postgres, not per-instance memory) |

## Feasibility & complexity verdict

**Very feasible. Small** — one issue, one branch. Everything except the outbound GitHub API call and the throttle table is assembly of existing patterns (FAB, responsive Dialog/Sheet, Server Action + `useActionState`, toast system).

## Design

### UI — `FeedbackFab` + `FeedbackForm`

- FAB mirrored from `src/app/(app)/tree/[id]/_components/AddRelativeFab.tsx`: `fixed bottom-6 left-6 z-40`, visually quieter (secondary/ghost treatment) so it doesn't compete with the primary Add FAB. Lucide icon verified against 1.x before import.
- Rendered in **two layouts**: the authed `(app)` layout (dashboard + tree) and the share-link view layout.
- Opens the same responsive overlay pattern as `PersonForm`: `Dialog` (desktop) / `Sheet` (mobile) via `use-is-desktop`.
- Form fields:
  - Type toggle: **Bug** / **Feedback** (drives GH label `bug` / `enhancement`)
  - Message textarea (required)
  - **Share-link variant only:** Name + Email (required) + hidden honeypot field
- Submit via `useActionState`; success/error toast through existing `useToastOnResult` / `notify`. On failure the user's text stays in the form (sticky error toast).

### Server — one Server Action `submitFeedback`

1. **Identity branching:**
   - Supabase session exists → identity from `auth.getUser()` (id + email).
   - No session → require a valid share token (validated the same way the share-link page validates it) + name/email from the form. Honeypot filled → silently accept-and-drop.
   - Neither → reject.
2. **Throttle (anonymous path only):** check/update a `feedback_throttle` counter table — max ~3 submissions/hour per share token (window-based upsert; no cron cleanup needed). Migration follows `docs/dev/migrations.md` conventions and the per-environment apply policy.
3. **Compose issue body** from a template: user message, then a metadata block — app version (`APP_VERSION` from `src/lib/generated/version.ts`), route, tree id (when in tree context), reporter (user email, or name+email), user agent, viewport, timestamp.
4. **Create issue:** plain `fetch` POST to `api.github.com/repos/SanchitB23/meetthefam/issues` with labels `user-feedback` + (`bug` | `enhancement`). Auth via new env var `GITHUB_FEEDBACK_TOKEN` — a fine-grained PAT scoped to this repo, issues read/write only. Lives in `.env.local` + Vercel env. **No octokit dependency.**
5. Return `{ ok, error? }` for the toast hook.

### Privacy gate

Submissions attach reporter email; issues are visible to anyone with repo access. **Ship only after the repo flips private** — tracked as a checklist item on #238.

### Error handling

- GitHub API failure → `{ ok: false }`, sticky error toast, form state preserved.
- Throttle exceeded → friendly "too many submissions, try again later" error.
- Never expose the PAT or GitHub response details to the client.

### Testing

- Vitest on `submitFeedback`: identity branching (session / share-token / neither), honeypot drop, throttle window, GitHub API mocked (success + failure).
- No new Playwright happy-path flow needed.

## Rate-limiting alternatives considered

| Option | Cost | Why not |
|---|---|---|
| **Supabase counter table (chosen)** | Free | — reliable, per-share-token, doubles as audit log |
| Vercel WAF rate-limit rule | Paid (Pro plan + usage) | Per-IP not per-token; config lives outside the repo; costs money on a Hobby project |
| In-memory token bucket | Free | Per-instance state on serverless → trivially bypassable; a speed bump, not a limit |

## Out of scope (YAGNI)

- Console-error buffering, screenshots/attachments
- In-app "my submissions" view (would require Supabase-first storage — revisit only if wanted)
- Rate limiting for authed users (identity attached; abuse handled socially)
- Duplicate detection / GitHub issue search
