> **⚠️ FROZEN / HISTORICAL.** This document is no longer maintained. Planning moved to GitHub milestones + issues on 2026-05-29 — see [ADR 0011](../adrs/0011-github-milestones-source-of-truth.md) and the design spec at [`../superpowers/specs/2026-05-29-github-milestones-workflow-design.md`](../superpowers/specs/2026-05-29-github-milestones-workflow-design.md). The current cycle is the nearest open [GitHub milestone](https://github.com/SanchitB23/meetthefam/milestones). Kept for historical rationale only.

---

# Phase 8 — next-session resume prompt

> Paste the block below into a fresh Claude Code session in this repo to resume Phase 8 from 8b-1. The prompt is self-contained — it briefs the new session like a colleague walking in fresh.

---

## Prompt (copy-paste verbatim)

You're resuming Phase 8 ("Visual polish + landing") of the meetthefam project. Phase 8a (brand foundations, 4 sub-tasks + polish + handoff docs) has landed on the phase branch. Your job is to keep executing the canonical plan from sub-task **8b-1** onward through phase close-out + `v0.4.0` release.

### Canonical references — read these first

- **Plan**: [`docs/superpowers/plans/2026-05-16-phase-8-visual-polish-landing.md`](./../superpowers/plans/2026-05-16-phase-8-visual-polish-landing.md) — the 14-sub-task plan. Sub-task numbering, locked decisions, milestone smokes, and the close-out + release recipe are all unchanged.
- **Current state**: [`docs/tasks/current-phase.md`](./current-phase.md) — running progress, blockers, carry-forwards. The "Phase 8 progress — running draft PR #55" + "Phase 8b / 8c — next session" sections at the top describe the exact state you're inheriting.
- **Brand decisions**: [`docs/architecture/brand-decisions.md`](./../architecture/brand-decisions.md) — locked from 8a-1. Reference these tokens when 8b/8c touches palette/radius/shadow.
- **Project conventions**: [`CLAUDE.md`](./../../CLAUDE.md) + [`AGENTS.md`](./../../AGENTS.md) at the repo root.

### Starting state (verify before starting work)

- Branch: `feat/phase-8-visual-polish-landing` (already cut, pushed to origin)
- HEAD: `179b486` ("docs(phase-8): correct handoff notes — single phase branch, PR #55 is running draft")
- Working tree should be clean. If not, stop and ask the user.
- Running draft PR: **#55** at https://github.com/SanchitB23/meetthefam/pull/55. **DO NOT** open a new PR — 8b/8c commits add to this same PR. **DO NOT** mark ready — user un-drafts it after 8c-7 + close-out land.
- Test count at HEAD: 178 / 178 passing; typecheck + lint clean (only the pre-existing `PersonForm` warning).
- 14 sub-tasks: 4 of 14 landed (8a-1..8a-4), 10 remaining (8b-1..8c-7).

### How to execute

Use the **superpowers:subagent-driven-development** skill — dispatch a fresh implementer subagent per sub-task, then spec compliance review, then code quality review, then mark complete. For simple sub-tasks the spec + code-quality reviews can run in parallel after the implementer reports DONE.

Per the standing rule (`feedback_phase_4_auto_commit.md` covers Phase 4 only — Phase 8 follows the default CLAUDE.md rule): **always ask the user before each `git commit`** with a diff summary. Unless the user has already said "auto-commit Phase 8 too" — in which case ask once to confirm at the start of the session and proceed.

### Per-sub-task workflow

For each landed sub-task:

1. Implementer subagent writes tests first (TDD), implements, runs `pnpm typecheck && pnpm lint && pnpm test --run`, ticks the entries in `docs/tasks/current-phase.md` + `docs/tasks/phase-backlog.md`, stages exactly the affected files (no `git add -A`), commits with the Conventional Commits prefix.
2. Spec compliance reviewer subagent verifies the commit against the plan's sub-task text.
3. Code quality reviewer subagent verifies code quality.
4. If either review finds issues, re-dispatch the implementer to fix; re-review; repeat until both ✅.
5. **Update PR #55's progress checklist** — tick the sub-task's box in the PR body using `gh pr edit 55 --body-file <file>`. The checklist is the human-visible source of truth for "how far have we gotten" on the draft PR.
6. Move to the next sub-task.

### Sub-task order (still pending)

| # | Sub-task | Closes | Notes |
|---|---|---|---|
| 1 | 8b-1 | — | Gender-shape avatar + deceased treatment + Memoriam (3 coordinated changes in ONE commit) |
| 2 | 8b-2 | — | Tree-overview / zoom-to-fit button + floating "+" hover affordance |
| 3 | 8b-3 | — | Duplicate-card visual marker. **EXPLICIT QA GATE per locked decision #13** — push the commit, wait for the Vercel preview, ASK the user to walk it and confirm the dashed-border + ↑ badge treatment reads. If user wants the fallback ("setDuplicateBranchToggle(true)"), re-implement option 1 |
| – | 8b-done smoke | — | Background dispatch; will be BLOCKED unless infra fixed (see below) |
| 4 | 8c-1 | #45 | Shared `(app)` route group — invasive directory restructure (`git mv` heavy) |
| 5 | 8c-2 | #44 | Real landing screen + authed redirect |
| 6 | 8c-3 | part of #50 | Heirloom palette loading skeletons |
| 7 | 8c-4 | part of #50 | `<Suspense>` boundaries + `useLinkStatus()` progress bar |
| 8 | 8c-5 | part of #50 | React 19.2 `<ViewTransition>` for cross-page animations |
| 9 | 8c-6 | — | Revoke-member confirm copy + italic-Cormorant whitelist audit |
| 10 | 8c-7 | — | `APP_VERSION` footer (first consumer of ADR 0009 Amendment 4's build-time-derived version) |
| – | 8c-done smoke | — | Background dispatch; will be BLOCKED unless infra fixed |
| – | Phase close-out | — | Tick close-out section in `current-phase.md`, append `phase-8b-tree-polish` + `phase-8c-landing-and-nav` flows to `docs/qa/smoke-flows.md`, mark PR #55 ready (user does this), squash-merge → qa, then run the ADR 0009 Amendment 4 release recipe for `v0.4.0` |

### Standing rules to honour (from memory)

- **`feedback_pr_template_compliance.md`** — every PR (including agent-opened) follows `.github/pull_request_template.md` end-to-end. PR #55 already does; updates to its body must preserve the template structure.
- **`feedback_draft_prs_user_marks_ready.md`** — PR stays draft. Don't merge, don't ask the user "should I mark it ready". They do it themselves.
- **`feedback_link_closing_issues_in_pr.md`** — sub-task commits that close issues append `Closes #N.` (bare keyword) to the commit message. 8c-1 closes #45; 8c-2 closes #44; 8c-3, 8c-4, 8c-5 each contribute to #50 and the FINAL one of them (likely 8c-5) carries the `Closes #50.` line. PR #55 body already has bare `Closes #44 / #45 / #50` at the top — preserve those when editing the body for checklist ticks.
- **`feedback_update_tasks_before_commit.md`** — tick `docs/tasks/current-phase.md` + `docs/tasks/phase-backlog.md` in the SAME commit as the feature work (a `task-doc-tick-detector` PreToolUse hook will auto-nudge if forgotten).
- **`feedback_selfprojects_agent_git.md`** — agents have commit + push authority in this repo. Human reviews PR before merge.
- **`feedback_no_prod_changes_pre_v1.md`** — Phase 8 ships pure-frontend; no production DB / Vercel-config changes in v0.x.y. No-op for Phase 8 (no migrations).
- **`feedback_phase_4_auto_commit.md`** — *Phase 4 only*. Does NOT extend to Phase 8. Confirm with the user once at session start whether they want batch-approval or per-commit-approval.

### Known infrastructure blockers (already documented; don't waste time rediscovering)

These were captured during the 8a-done milestone smoke attempt. Neither is a code issue, but both block 8b-done and 8c-done milestone smokes too:

1. **Playwright MCP not attached to dispatched `e2e-smoke-tester` subagents.** The tools surface in the controller session's deferred-tool list but don't pass through to subagent dispatches. Fix: add the Playwright server to `enabledMcpjsonServers` in `.claude/settings.local.json`, then restart Claude Code so the subagent runtime re-reads the config.
2. **Vercel preview SSO gate.** Both `feat-phase-8-*` and `qa` previews return `HTTP/2 401` with `_vercel_sso_nonce` cookie. Fix: lift preview-protection on the Vercel project (Settings → Deployment Protection), OR pass an `x-vercel-protection-bypass` token through the agent's `browser_*` calls.

At session start, ASK the user whether either has been fixed. If not, dispatch milestone smokes as background agents anyway — they'll report BLOCKED quickly, you can continue to the next bundle, and the user can fix infra in parallel.

### Phase close-out + release recipe (8c-7 + after)

Once 8c-7 lands, follow the plan's § "Phase close-out + release" verbatim:

1. Tick close-out section in `current-phase.md` (`- [x] All 14 sub-tasks ticked above`).
2. Append `phase-8b-tree-polish` + `phase-8c-landing-and-nav` to `docs/qa/smoke-flows.md`.
3. Stop and tell the user: "Phase 8 is complete. Mark PR #55 ready when you're satisfied with the QA walkthrough."
4. After PR #55 merges (user does this), execute the **ADR 0009 Amendment 4 release recipe**: zero-unique-commit `release/v0.4.0` branch from `qa` → merge-commit PR into `main` → `gh release create v0.4.0 --target main` → fast-forward push `release/v0.4.0:qa`. Full step-by-step is in the plan file.
5. After release: open a `docs/phase-9-stub` branch and have the `task-doc-keeper` agent flip `current-phase.md` to Phase 9. Per `feedback_no_release_for_docs_only.md`, this docs-only branch merges into qa and rides into v0.5.0.

### First action

Start by running these checks in order:

```bash
git fetch origin feat/phase-8-visual-polish-landing
git status                            # expect clean
git log --oneline -3                  # expect 179b486 at HEAD
pnpm typecheck && pnpm lint && pnpm test --run    # expect clean + 178 / 178
```

If everything is green, ask the user one question:

> "Resuming Phase 8 from sub-task 8b-1. Per-commit approval (default CLAUDE.md rule) or batch-approve at phase close? Also: have you addressed the smoke infrastructure blockers (Vercel SSO + Playwright MCP subagent attachment), or should I dispatch milestone smokes knowing they'll BLOCK?"

After their answer, invoke the **superpowers:subagent-driven-development** skill and dispatch the 8b-1 implementer with a self-contained prompt drawing from the plan file.

---

## Prompt usage notes (for the human, not for the next session)

- The prompt above is intended to be pasted into a *new* Claude Code session. It is self-contained and does not require prior conversation context.
- If you want to pivot from "single phase branch" mid-execution, edit the prompt's "Standing rules" section before pasting.
- The "First action" section ends with a single user question — answer it once, then the session executes autonomously through phase close-out modulo per-sub-task commit approvals.
- After phase close, PR #55 will be ready for your manual review + merge.
